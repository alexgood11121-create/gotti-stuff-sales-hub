import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase-for-user";

export default defineTool({
  name: "sales_summary",
  title: "Сводка продаж",
  description:
    "Агрегированная сводка продаж за период: количество чеков, выручка, суммы по наличным/карте, разбивка по филиалам.",
  inputSchema: {
    from: z.string().optional().describe("ISO-дата начала. По умолчанию — начало сегодняшнего дня."),
    to: z.string().optional().describe("ISO-дата конца (исключительно). По умолчанию — сейчас."),
    branch_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, branch_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const fromIso = from ?? start.toISOString();
    const toIso = to ?? new Date().toISOString();
    let q = supabaseForUser(ctx)
      .from("sales")
      .select("total, payment_method, cash_amount, card_amount, branch_id")
      .gte("created_at", fromIso)
      .lt("created_at", toIso);
    if (branch_id) q = q.eq("branch_id", branch_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    const byBranch: Record<string, { count: number; total: number; cash: number; card: number }> = {};
    let total = 0,
      cash = 0,
      card = 0;
    for (const r of rows) {
      total += Number(r.total ?? 0);
      cash += Number(r.cash_amount ?? (r.payment_method === "cash" ? r.total : 0));
      card += Number(r.card_amount ?? (r.payment_method === "card" ? r.total : 0));
      const k = r.branch_id ?? "unknown";
      byBranch[k] ??= { count: 0, total: 0, cash: 0, card: 0 };
      byBranch[k].count += 1;
      byBranch[k].total += Number(r.total ?? 0);
      byBranch[k].cash += Number(r.cash_amount ?? 0);
      byBranch[k].card += Number(r.card_amount ?? 0);
    }
    const payload = {
      period: { from: fromIso, to: toIso },
      receipts: rows.length,
      total,
      cash,
      card,
      by_branch: byBranch,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
