import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase-for-user";

export default defineTool({
  name: "list_products",
  title: "Список товаров",
  description: "Возвращает товары каталога. Опционально фильтрует по подстроке названия и лимиту.",
  inputSchema: {
    search: z.string().optional().describe("Подстрока для поиска в названии товара."),
    limit: z.number().int().min(1).max(500).optional().describe("Максимум записей (по умолчанию 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = supabaseForUser(ctx)
      .from("products")
      .select("id, name, price, stock, sales_count, sizes, category_id, image_url")
      .order("sales_count", { ascending: false })
      .limit(limit ?? 100);
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { products: data ?? [] },
    };
  },
});
