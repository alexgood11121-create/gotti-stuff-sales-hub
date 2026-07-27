// Клиентские аналоги src/lib/sales.functions.ts.
// В Capacitor-сборке этот файл подменяет server-функции через resolve.alias:
// весь код исполняется в браузере и ходит в Supabase напрямую под JWT кассира.
import { supabase } from "@/integrations/supabase/client";
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

const saleSchema = z.object({
  client_uuid: z.string().uuid(),
  total: z.number().nonnegative(),
  cash_amount: z.number().nonnegative(),
  card_amount: z.number().nonnegative(),
  given_amount: z.number().nonnegative(),
  change_amount: z.number().nonnegative(),
  payment_method: z.enum(["cash", "card", "mixed"]),
  items: z.array(saleItemSchema).min(1),
});

export type SaleInput = z.infer<typeof saleSchema>;

async function currentUser() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Не авторизован");
  return data.user;
}

async function assertAdmin(userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Только для админа");
}

export const submitSale = async ({ data: raw }: { data: unknown }) => {
  const data = saleSchema.parse(raw);
  const user = await currentUser();

  const { data: existing } = await supabase
    .from("sales")
    .select("id")
    .eq("client_uuid", data.client_uuid)
    .maybeSingle();
  if (existing) return { id: existing.id, duplicate: true };

  const { data: prof } = await supabase
    .from("profiles")
    .select("branch_id")
    .eq("id", user.id)
    .maybeSingle();
  const branch_id = prof?.branch_id ?? null;

  const { data: sale, error } = await supabase
    .from("sales")
    .insert({
      client_uuid: data.client_uuid,
      branch_id,
      cashier_id: user.id,
      total: data.total,
      cash_amount: data.cash_amount,
      card_amount: data.card_amount,
      given_amount: data.given_amount,
      change_amount: data.change_amount,
      payment_method: data.payment_method,
      status: "paid",
    } as any)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const items = data.items.map((it) => ({ ...it, sale_id: sale.id }));
  const { error: itErr } = await supabase.from("sale_items").insert(items as any);
  if (itErr) throw new Error(itErr.message);

  if (data.payment_method === "card" || data.payment_method === "mixed") {
    try {
      const branchName = branch_id
        ? (await supabase.from("branches").select("name").eq("id", branch_id).maybeSingle()).data?.name ?? "—"
        : "—";
      const cashierName =
        (await supabase.from("profiles").select("nickname,email").eq("id", user.id).maybeSingle()).data
          ?.nickname ?? user.email ?? "—";
      const methodLabel =
        data.payment_method === "card"
          ? `Карта: ${data.card_amount.toLocaleString("ru-RU")} UZS`
          : `Наличные: ${data.cash_amount.toLocaleString("ru-RU")} UZS + Карта: ${data.card_amount.toLocaleString("ru-RU")} UZS`;
      const itemsList = data.items
        .map((it) => `• ${it.product_name} × ${it.qty} = ${it.total.toLocaleString("ru-RU")} UZS`)
        .join("\n");
      await supabase.from("notifications").insert({
        sale_id: sale.id,
        branch_id,
        title: `Оплата картой — ${branchName} — ${data.total.toLocaleString("ru-RU")} UZS`,
        body: `Филиал: ${branchName}\nКассир: ${cashierName}\nИтого: ${data.total.toLocaleString("ru-RU")} UZS\n${methodLabel}\n\nТовары:\n${itemsList}`,
      } as any);
    } catch (e) {
      console.warn("notify failed", e);
    }
  }

  return { id: sale.id, duplicate: false };
};

async function recomputeSaleTotal(saleId: string) {
  const { data: items } = await supabase.from("sale_items").select("total").eq("sale_id", saleId);
  const total = (items ?? []).reduce((s: number, r: any) => s + Number(r.total ?? 0), 0);
  await supabase.from("sales").update({ total }).eq("id", saleId);
  return total;
}

export const getSaleDetail = async ({ data }: { data: { sale_id: string } }) => {
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
};

export const updateSaleItem = async ({
  data,
}: {
  data: { item_id: string; qty: number; unit_price: number };
}) => {
  const user = await currentUser();
  await assertAdmin(user.id);
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
  const total = await recomputeSaleTotal(cur.sale_id);
  return { ok: true, total };
};

export const deleteSaleItem = async ({ data }: { data: { item_id: string } }) => {
  const user = await currentUser();
  await assertAdmin(user.id);
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
  const total = await recomputeSaleTotal(cur.sale_id);
  return { ok: true, total };
};

export const deleteSale = async ({ data }: { data: { sale_id: string } }) => {
  const user = await currentUser();
  await assertAdmin(user.id);
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
};
