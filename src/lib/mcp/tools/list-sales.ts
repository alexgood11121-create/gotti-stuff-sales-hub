import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase-for-user";

export default defineTool({
  name: "list_sales",
  title: "Список чеков",
  description:
    "Возвращает чеки за период с позициями. Даты в формате ISO. По умолчанию — последние 24 часа, лимит 50.",
  inputSchema: {
    from: z.string().optional().describe("ISO-дата начала периода (включительно)."),
    to: z.string().optional().describe("ISO-дата конца периода (исключительно)."),
    branch_id: z.string().uuid().optional().describe("Фильтр по филиалу."),
    payment_method: z
      .enum(["cash", "card", "mixed"])
      .optional()
      .describe("Фильтр по способу оплаты."),
    limit: z.number().int().min(1).max(500).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, branch_id, payment_method, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = supabaseForUser(ctx);
    const fromIso = from ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let q = sb
      .from("sales")
      .select(
        "id, created_at, total, payment_method, cash_amount, card_amount, given_amount, change_amount, cashier_id, branch_id, sale_items(id, product_id, product_name, variant_size, qty, unit_price, total)",
      )
      .gte("created_at", fromIso)
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (to) q = q.lt("created_at", to);
    if (branch_id) q = q.eq("branch_id", branch_id);
    if (payment_method) q = q.eq("payment_method", payment_method);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { sales: data ?? [] },
    };
  },
});
