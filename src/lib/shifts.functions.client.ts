// Клиентские аналоги src/lib/shifts.functions.ts для Capacitor SPA.
import { supabase } from "@/integrations/supabase/client";

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) throw new Error("Не авторизован");
  return data.session.user.id;
}

export const startShift = async ({
  data,
}: {
  data: { branch_id: string | null; opening_cash: number };
}) => {
  const userId = await currentUserId();
  const { data: open } = await supabase
    .from("shifts")
    .select("id")
    .eq("cashier_id", userId)
    .is("ended_at", null)
    .maybeSingle();
  if (open) return { id: open.id, already: true };
  const { data: row, error } = await supabase
    .from("shifts")
    .insert({
      cashier_id: userId,
      branch_id: data.branch_id,
      opening_cash: Number(data.opening_cash) || 0,
    } as any)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: row.id, already: false };
};

export const endShift = async ({ data }: { data: { closing_cash_actual: number } }) => {
  const userId = await currentUserId();
  const { data: open } = await supabase
    .from("shifts")
    .select("id, started_at, opening_cash")
    .eq("cashier_id", userId)
    .is("ended_at", null)
    .maybeSingle();
  if (!open) return { closed: false };
  const { data: sales } = await supabase
    .from("sales")
    .select("cash_amount")
    .eq("cashier_id", userId)
    .gte("created_at", (open as any).started_at);
  const cashSales = (sales ?? []).reduce((s, x: any) => s + Number(x.cash_amount ?? 0), 0);
  const opening = Number((open as any).opening_cash ?? 0);
  const expected = opening + cashSales;
  const actual = Number(data.closing_cash_actual) || 0;
  const diff = actual - expected;
  const { error } = await supabase
    .from("shifts")
    .update({
      ended_at: new Date().toISOString(),
      closing_cash_expected: expected,
      closing_cash_actual: actual,
      cash_diff: diff,
    } as any)
    .eq("id", open.id);
  if (error) throw new Error(error.message);
  return { closed: true, id: open.id, expected, actual, diff };
};

export const getMyOpenShift = async () => {
  const userId = await currentUserId();
  const { data } = await supabase
    .from("shifts")
    .select("id, started_at, branch_id, opening_cash")
    .eq("cashier_id", userId)
    .is("ended_at", null)
    .maybeSingle();
  return data as any;
};

export const getExpectedCash = async () => {
  const userId = await currentUserId();
  const { data: open } = await supabase
    .from("shifts")
    .select("id, started_at, opening_cash")
    .eq("cashier_id", userId)
    .is("ended_at", null)
    .maybeSingle();
  if (!open) return { expected: 0, opening: 0, cashSales: 0 };
  const { data: sales } = await supabase
    .from("sales")
    .select("cash_amount")
    .eq("cashier_id", userId)
    .gte("created_at", (open as any).started_at);
  const cashSales = (sales ?? []).reduce((s, x: any) => s + Number(x.cash_amount ?? 0), 0);
  const opening = Number((open as any).opening_cash ?? 0);
  return { expected: opening + cashSales, opening, cashSales };
};

// Админские функции — оставляем заглушку, чтобы не падал импорт в других файлах.
export const listShifts = async (_?: any): Promise<any[]> => [];
export const getShiftDetails = async (_?: any): Promise<any> => null;
