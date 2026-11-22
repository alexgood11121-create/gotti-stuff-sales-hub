import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";

export type ShiftCompanyLine = { company: string; employee: string; companyAmount: number; extra: number; at: string };
export type ShiftSummary = { cash: number; card: number; company: number; total: number; companies: ShiftCompanyLine[] };

/** Часть чека, которую оплачивает компания (итог минус доплата сотрудника). */
export function companyPart(s: { payment_method: string; total: number; cash_amount?: number; card_amount?: number }): number {
  if (s.payment_method !== "company") return 0;
  return Math.max(0, Number(s.total) - Number(s.cash_amount ?? 0) - Number(s.card_amount ?? 0));
}

export async function getShiftSummary(userId: string, startedAt: string): Promise<ShiftSummary> {
  const out: ShiftSummary = { cash: 0, card: 0, company: 0, total: 0, companies: [] };
  const seen = new Set<string>();
  const add = (s: any, company: string, employee: string) => {
    const comp = companyPart(s);
    out.cash += Number(s.cash_amount ?? 0);
    out.card += Number(s.card_amount ?? 0);
    out.company += comp;
    out.total += Number(s.total ?? 0);
    if (s.payment_method === "company") {
      out.companies.push({ company, employee, companyAmount: comp, extra: Number(s.cash_amount ?? 0) + Number(s.card_amount ?? 0), at: s.created_at });
    }
  };
  let names = new Map<string, string>();
  try {
    const { data: cs } = await (supabase as any).from("companies").select("id,name,company_employees(id,name)");
    for (const c of cs ?? []) { names.set(c.id, c.name); for (const e of c.company_employees ?? []) names.set(e.id, e.name); }
  } catch { /* офлайн */ }
  try {
    const { data } = await (supabase as any)
      .from("sales")
      .select("client_uuid,total,cash_amount,card_amount,payment_method,created_at,company_id,company_employee_id,status")
      .eq("cashier_id", userId)
      .gte("created_at", startedAt);
    for (const s of data ?? []) {
      if (s.status === "cancelled") continue;
      seen.add(s.client_uuid);
      add(s, names.get(s.company_id) ?? "Компания", names.get(s.company_employee_id) ?? "");
    }
  } catch { /* офлайн */ }
  const pending = await db.pendingSales.toArray();
  for (const s of pending as any[]) {
    if (s.cashier_id !== userId || s.created_at < startedAt || seen.has(s.client_uuid)) continue;
    add(s, names.get(s.company_id) ?? "Компания", names.get(s.company_employee_id) ?? "");
  }
  return out;
}
