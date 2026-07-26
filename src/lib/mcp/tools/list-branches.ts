import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase-for-user";

export default defineTool({
  name: "list_branches",
  title: "Список филиалов",
  description: "Возвращает филиалы, доступные текущему пользователю (RLS).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("branches")
      .select("id, name, address, created_at")
      .order("name");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { branches: data ?? [] },
    };
  },
});
