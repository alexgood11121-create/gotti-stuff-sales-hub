import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const saleItemSchema = z.object({
  product_id: z.string().uuid().nullable(),
  product_name: z.string(),
  variant_size: z.string().nullable().optional(),
  qty: z.number().positive(),
  unit_price: z.number().nonnegative(),
  cost_price: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Только для админа");
}

const saleSchema = z.object({
  client_uuid: z.string().uuid(),
  total: z.number().nonnegative(),
  cash_amount: z.number().nonnegative(),
  card_amount: z.number().nonnegative(),
  given_amount: z.number().nonnegative(),
  change_amount: z.number().nonnegative(),
  payment_method: z.enum(["cash", "card", "mixed", "debt"]),
  debt_amount: z.number().nonnegative().optional().default(0),
  debtor_name: z.string().nullable().optional(),
  items: z.array(saleItemSchema).min(1),
});

export type SaleInput = z.infer<typeof saleSchema>;

export const submitSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Идемпотентность: проверить, есть ли уже такой чек
    const { data: existing } = await supabase
      .from("sales")
      .select("id")
      .eq("client_uuid", data.client_uuid)
      .maybeSingle();
    if (existing) return { id: existing.id, duplicate: true };

    // Получаем branch_id кассира
    const { data: prof } = await supabase
      .from("profiles")
      .select("branch_id")
      .eq("id", userId)
      .maybeSingle();
    const branch_id = prof?.branch_id ?? null;

    const { data: sale, error } = await supabase
      .from("sales")
      .insert({
        client_uuid: data.client_uuid,
        branch_id,
        cashier_id: userId,
        total: data.total,
        cash_amount: data.cash_amount,
        card_amount: data.card_amount,
        given_amount: data.given_amount,
        change_amount: data.change_amount,
        payment_method: data.payment_method,
        debt_amount: data.debt_amount ?? 0,
        debtor_name: data.debtor_name ?? null,
        status: "paid",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const items = data.items.map((it) => ({ ...it, sale_id: sale.id }));
    const { error: itErr } = await supabase.from("sale_items").insert(items);
    if (itErr) throw new Error(itErr.message);

    // Уведомление админа при оплате картой/смешанной
    if (data.payment_method === "card" || data.payment_method === "mixed") {
      try {
        await createCardPaymentNotification(supabase, sale.id, branch_id, data, userId);
      } catch (e) {
        console.error("notify error", e);
      }
    }

    return { id: sale.id, duplicate: false };
  });

async function createCardPaymentNotification(
  supabase: any,
  saleId: string,
  branchId: string | null,
  data: SaleInput,
  cashierId: string,
) {
  const [{ data: branch }, { data: cashier }] = await Promise.all([
    branchId
      ? supabase.from("branches").select("name").eq("id", branchId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("profiles").select("nickname,email").eq("id", cashierId).maybeSingle(),
  ]);

  const branchName = branch?.name ?? "—";
  const cashierName = cashier?.nickname ?? cashier?.email ?? "—";
  const methodLabel =
    data.payment_method === "card"
      ? `Карта: ${data.card_amount.toLocaleString("ru-RU")} UZS`
      : `Наличные: ${data.cash_amount.toLocaleString("ru-RU")} UZS + Карта: ${data.card_amount.toLocaleString("ru-RU")} UZS`;

  const itemsList = data.items
    .map((it) => `• ${it.product_name} × ${it.qty} = ${it.total.toLocaleString("ru-RU")} UZS`)
    .join("\n");

  const title = `Оплата картой — ${branchName} — ${data.total.toLocaleString("ru-RU")} UZS`;
  const body = `Филиал: ${branchName}\nКассир: ${cashierName}\nИтого: ${data.total.toLocaleString("ru-RU")} UZS\n${methodLabel}\n\nТовары:\n${itemsList}`;

  await supabase.from("notifications").insert({
    sale_id: saleId,
    branch_id: branchId,
    title,
    body,
  });
}

export const getSaleDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sale_id: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: sale, error } = await supabase
      .from("sales")
      .select(
        "id, created_at, total, payment_method, cash_amount, card_amount, given_amount, change_amount, cashier_id, branch_id",
      )
      .eq("id", data.sale_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sale) throw new Error("Чек не найден");
    const { data: items, error: itErr } = await supabase
      .from("sale_items")
      .select("id, product_id, product_name, variant_size, qty, unit_price, cost_price, total")
      .eq("sale_id", data.sale_id)
      .order("id");
    if (itErr) throw new Error(itErr.message);
    return { sale, items: items ?? [] };
  });

async function recomputeSaleTotal(supabase: any, saleId: string) {
  const { data: items } = await supabase
    .from("sale_items")
    .select("total")
    .eq("sale_id", saleId);
  const total = (items ?? []).reduce((s: number, r: any) => s + Number(r.total ?? 0), 0);
  await supabase.from("sales").update({ total }).eq("id", saleId);
  return total;
}

export const updateSaleItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { item_id: string; qty: number; unit_price: number }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.qty <= 0 || data.unit_price < 0) throw new Error("Некорректные значения");
    const { data: cur, error: e1 } = await supabase
      .from("sale_items")
      .select("id, sale_id, product_id, qty")
      .eq("id", data.item_id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!cur) throw new Error("Позиция не найдена");
    const qtyDiff = data.qty - Number(cur.qty);
    const newTotal = data.qty * data.unit_price;
    const { error: e2 } = await supabase
      .from("sale_items")
      .update({ qty: data.qty, unit_price: data.unit_price, total: newTotal })
      .eq("id", data.item_id);
    if (e2) throw new Error(e2.message);
    if (cur.product_id && qtyDiff !== 0) {
      const { data: p } = await supabase
        .from("products")
        .select("stock, sales_count")
        .eq("id", cur.product_id)
        .maybeSingle();
      if (p) {
        await supabase
          .from("products")
          .update({
            stock: Number(p.stock ?? 0) - qtyDiff,
            sales_count: Math.max(0, Number(p.sales_count ?? 0) + qtyDiff),
          })
          .eq("id", cur.product_id);
      }
    }
    const total = await recomputeSaleTotal(supabase, cur.sale_id);
    return { ok: true, total };
  });

export const deleteSaleItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { item_id: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: cur, error: e1 } = await supabase
      .from("sale_items")
      .select("id, sale_id, product_id, qty")
      .eq("id", data.item_id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!cur) throw new Error("Позиция не найдена");
    const { error: e2 } = await supabase.from("sale_items").delete().eq("id", data.item_id);
    if (e2) throw new Error(e2.message);
    if (cur.product_id) {
      const { data: p } = await supabase
        .from("products")
        .select("stock, sales_count")
        .eq("id", cur.product_id)
        .maybeSingle();
      if (p) {
        await supabase
          .from("products")
          .update({
            stock: Number(p.stock ?? 0) + Number(cur.qty),
            sales_count: Math.max(0, Number(p.sales_count ?? 0) - Number(cur.qty)),
          })
          .eq("id", cur.product_id);
      }
    }
    const total = await recomputeSaleTotal(supabase, cur.sale_id);
    return { ok: true, total };
  });

export const deleteSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sale_id: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: items } = await supabase
      .from("sale_items")
      .select("product_id, qty")
      .eq("sale_id", data.sale_id);
    for (const it of items ?? []) {
      if (!it.product_id) continue;
      const { data: p } = await supabase
        .from("products")
        .select("stock, sales_count")
        .eq("id", it.product_id)
        .maybeSingle();
      if (p) {
        await supabase
          .from("products")
          .update({
            stock: Number(p.stock ?? 0) + Number(it.qty),
            sales_count: Math.max(0, Number(p.sales_count ?? 0) - Number(it.qty)),
          })
          .eq("id", it.product_id);
      }
    }
    await supabase.from("sale_items").delete().eq("sale_id", data.sale_id);
    const { error } = await supabase.from("sales").delete().eq("id", data.sale_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

