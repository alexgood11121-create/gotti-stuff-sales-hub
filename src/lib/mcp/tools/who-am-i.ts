import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase-for-user";

export default defineTool({
  name: "who_am_i",
  title: "Кто я",
  description: "Возвращает id, email, ник, роль и филиал текущего пользователя.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const [{ data: profile }, { data: roles }] = await Promise.all([
      sb.from("profiles").select("id, email, nickname, branch_id").eq("id", userId).maybeSingle(),
      sb.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const payload = {
      user_id: userId,
      email: ctx.getUserEmail() ?? profile?.email ?? null,
      nickname: profile?.nickname ?? null,
      branch_id: profile?.branch_id ?? null,
      roles: (roles ?? []).map((r: any) => r.role),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
