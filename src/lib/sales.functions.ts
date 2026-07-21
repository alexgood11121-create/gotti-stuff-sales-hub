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
