import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase-for-user";

export default defineTool({
  name: "list_shifts",
  title: "Смены кассиров",
  description: "Список фактических смен кассиров за период (открытые и закрытые).",
  inputSchema: {
    from: z.string().optional(),
    to: z.string().optional(),
    branch_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, branch_id, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const fromIso = from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let q = supabaseForUser(ctx)
      .from("shifts")
      .select("id, cashier_id, branch_id, started_at, ended_at")
      .gte("started_at", fromIso)
      .order("started_at", { ascending: false })
      .limit(limit ?? 100);
    if (to) q = q.lt("started_at", to);
    if (branch_id) q = q.eq("branch_id", branch_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { shifts: data ?? [] },
    };
  },
});
