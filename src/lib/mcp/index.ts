import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listBranches from "./tools/list-branches";
import listProducts from "./tools/list-products";
import listSales from "./tools/list-sales";
import salesSummary from "./tools/sales-summary";
import listShifts from "./tools/list-shifts";
import whoAmI from "./tools/who-am-i";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "gotti-stuff-mcp",
  title: "Gotti Stuff POS",
  version: "0.1.0",
  instructions:
    "Инструменты POS Gotti Stuff. Позволяют читать филиалы, товары, чеки, смены и агрегированные продажи от имени вошедшего пользователя (админ или кассир). RLS применяется — кассир видит только свой филиал.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoAmI, listBranches, listProducts, listSales, salesSummary, listShifts],
});
