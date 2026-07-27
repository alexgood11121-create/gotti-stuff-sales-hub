// Клиентские аналоги src/lib/shifts.functions.ts для Capacitor SPA.
import { supabase } from "@/integrations/supabase/client";
import { db, type CachedShift } from "@/lib/db";
import { ensureOnlineBackendSession, getOfflineAuthState, isNetworkLikeError } from "@/lib/offline-auth";
import { v4 as uuidv4 } from "uuid";

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const offline = await getOfflineAuthState();
  if (offline?.user) return offline.user.id;
  throw new Error("Не авторизован");
}

async function localOpenShift(userId: string): Promise<CachedShift | undefined> {
  const all = await db.shifts.where("cashier_id").equals(userId).toArray();
  return all.find((shift) => !shift.ended_at);
}

async function localCashSales(userId: string, startedAt: string): Promise<number> {
  const sales = await db.pendingSales.toArray();
  return sales
    .filter((sale) => sale.cashier_id === userId && sale.created_at >= startedAt)
    .reduce((sum, sale) => sum + Number(sale.cash_amount ?? 0), 0);
}

function cacheRemoteShift(row: any, synced = 1): CachedShift {
  return {
    id: row.id,
    cashier_id: row.cashier_id,
    branch_id: row.branch_id ?? null,
    started_at: row.started_at,
    ended_at: row.ended_at ?? null,
    opening_cash: Number(row.opening_cash ?? 0),
    closing_cash_expected: row.closing_cash_expected == null ? null : Number(row.closing_cash_expected),
    closing_cash_actual: row.closing_cash_actual == null ? null : Number(row.closing_cash_actual),
    cash_diff: row.cash_diff == null ? null : Number(row.cash_diff),
    synced,
    attempts: 0,
  };
}

export const startShift = async ({
  data,
}: {
  data: { branch_id: string | null; opening_cash: number };
}) => {
  const userId = await currentUserId();
  const cachedOpen = await localOpenShift(userId);
  if (cachedOpen && cachedOpen.synced === 0) return { id: cachedOpen.id, already: true };

  const hasSession = await ensureOnlineBackendSession();
  if (!hasSession) {
    const local: CachedShift = {
      id: cachedOpen?.id ?? uuidv4(),
      cashier_id: userId,
      branch_id: data.branch_id,
      started_at: cachedOpen?.started_at ?? new Date().toISOString(),
      ended_at: null,
      opening_cash: Number(data.opening_cash) || 0,
      closing_cash_expected: null,
      closing_cash_actual: null,
      cash_diff: null,
      synced: 0,
      attempts: 0,
    };
    await db.shifts.put(local);
    return { id: local.id, already: Boolean(cachedOpen) };
  }

  const { data: open } = await supabase
    .from("shifts")
    .select("id, cashier_id, branch_id, started_at, ended_at, opening_cash, closing_cash_expected, closing_cash_actual, cash_diff")
    .eq("cashier_id", userId)
    .is("ended_at", null)
    .maybeSingle();
  if (open) {
    await db.shifts.put(cacheRemoteShift(open));
    return { id: open.id, already: true };
  }
  try {
    const { data: row, error } = await supabase
      .from("shifts")
      .insert({
        cashier_id: userId,
        branch_id: data.branch_id,
        opening_cash: Number(data.opening_cash) || 0,
      } as any)
      .select("id, cashier_id, branch_id, started_at, ended_at, opening_cash, closing_cash_expected, closing_cash_actual, cash_diff")
      .single();
    if (error) throw error;
    await db.shifts.put(cacheRemoteShift(row));
    return { id: row.id, already: false };
  } catch (error) {
    if (!isNetworkLikeError(error)) throw new Error(error instanceof Error ? error.message : "Ошибка смены");
    const local: CachedShift = {
      id: uuidv4(),
      cashier_id: userId,
      branch_id: data.branch_id,
      started_at: new Date().toISOString(),
      ended_at: null,
      opening_cash: Number(data.opening_cash) || 0,
      closing_cash_expected: null,
      closing_cash_actual: null,
      cash_diff: null,
      synced: 0,
      attempts: 0,
    };
    await db.shifts.put(local);
    return { id: local.id, already: false };
  }
};

export const endShift = async ({ data }: { data: { closing_cash_actual: number } }) => {
  const userId = await currentUserId();
  const localOpen = await localOpenShift(userId);
  const hasSession = await ensureOnlineBackendSession();
  if (!hasSession && localOpen) {
    const cashSales = await localCashSales(userId, localOpen.started_at);
    const expected = Number(localOpen.opening_cash ?? 0) + cashSales;
    const actual = Number(data.closing_cash_actual) || 0;
    const diff = actual - expected;
    await db.shifts.update(localOpen.id, {
      ended_at: new Date().toISOString(),
      closing_cash_expected: expected,
      closing_cash_actual: actual,
      cash_diff: diff,
      synced: 0,
    });
    return { closed: true, id: localOpen.id, expected, actual, diff };
  }

  const { data: open } = await supabase
    .from("shifts")
    .select("id, started_at, opening_cash")
    .eq("cashier_id", userId)
    .is("ended_at", null)
    .maybeSingle();
  if (!open) {
    if (!localOpen) return { closed: false };
    const cashSales = await localCashSales(userId, localOpen.started_at);
    const expected = Number(localOpen.opening_cash ?? 0) + cashSales;
    const actual = Number(data.closing_cash_actual) || 0;
    const diff = actual - expected;
    await db.shifts.update(localOpen.id, {
      ended_at: new Date().toISOString(),
      closing_cash_expected: expected,
      closing_cash_actual: actual,
      cash_diff: diff,
      synced: 0,
    });
    return { closed: true, id: localOpen.id, expected, actual, diff };
  }
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
  await db.shifts.put(cacheRemoteShift({ ...open, ended_at: new Date().toISOString(), closing_cash_expected: expected, closing_cash_actual: actual, cash_diff: diff }));
  return { closed: true, id: open.id, expected, actual, diff };
};

export const getMyOpenShift = async () => {
  const userId = await currentUserId();
  const cachedOpen = await localOpenShift(userId);
  if (cachedOpen && cachedOpen.synced === 0) return cachedOpen as any;
  const hasSession = await ensureOnlineBackendSession();
  if (!hasSession) return (cachedOpen ?? null) as any;
  const { data } = await supabase
    .from("shifts")
    .select("id, started_at, branch_id, opening_cash")
    .eq("cashier_id", userId)
    .is("ended_at", null)
    .maybeSingle();
  if (data) await db.shifts.put(cacheRemoteShift({ ...data, cashier_id: userId }));
  return data as any;
};

export const getExpectedCash = async () => {
  const userId = await currentUserId();
  const cachedOpen = await localOpenShift(userId);
  const hasSession = await ensureOnlineBackendSession();
  if (!hasSession && cachedOpen) {
    const cashSales = await localCashSales(userId, cachedOpen.started_at);
    const opening = Number(cachedOpen.opening_cash ?? 0);
    return { expected: opening + cashSales, opening, cashSales };
  }
  const { data: open } = await supabase
    .from("shifts")
    .select("id, started_at, opening_cash")
    .eq("cashier_id", userId)
    .is("ended_at", null)
    .maybeSingle();
  if (!open) {
    if (!cachedOpen) return { expected: 0, opening: 0, cashSales: 0 };
    const cashSales = await localCashSales(userId, cachedOpen.started_at);
    const opening = Number(cachedOpen.opening_cash ?? 0);
    return { expected: opening + cashSales, opening, cashSales };
  }
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
