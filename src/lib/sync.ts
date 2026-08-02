import { db, type PendingSale } from "./db";
import { submitSale } from "@/lib/sales.functions";
import { v4 as uuidv4 } from "uuid";
import { ensureOnlineBackendSession } from "@/lib/offline-auth";
import { supabase } from "@/integrations/supabase/client";
import { syncPendingStockMovements } from "@/lib/offline-ops";
import { cachePendingSale, dropPendingSaleCache, syncReceiptsCache } from "@/lib/receipts-cache";

export async function queueSaleOffline(payload: Omit<PendingSale, "client_uuid" | "created_at" | "synced" | "attempts"> & { client_uuid?: string }) {
  const client_uuid = payload.client_uuid ?? uuidv4();
  const sale: PendingSale = {
    ...payload,
    client_uuid,
    created_at: new Date().toISOString(),
    synced: 0,
    attempts: 0,
  };
  await db.pendingSales.put(sale);
  await cachePendingSale(sale);
  return client_uuid;
}

let syncing = false;

export async function syncPendingSales(): Promise<{ synced: number; failed: number }> {
  if (syncing) return { synced: 0, failed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) return { synced: 0, failed: 0 };
  syncing = true;
  let synced = 0;
  let failed = 0;
  try {
    const hasSession = await ensureOnlineBackendSession();
    if (!hasSession) return { synced: 0, failed: 0 };
    const pending = await db.pendingSales.where("synced").equals(0).toArray();
    for (const s of pending) {
      try {
        await submitSale({
          data: {
            client_uuid: s.client_uuid,
            total: s.total,
            cash_amount: s.cash_amount,
            card_amount: s.card_amount,
            given_amount: s.given_amount,
            change_amount: s.change_amount,
            payment_method: s.payment_method,
            items: s.items,
          },
        });
        await db.pendingSales.update(s.client_uuid, { synced: 1 });
        await dropPendingSaleCache(s.client_uuid);
        synced++;
      } catch (e: any) {
        failed++;
        await db.pendingSales.update(s.client_uuid, {
          attempts: (s.attempts ?? 0) + 1,
          last_error: e?.message ?? "unknown",
        });
      }
    }
  } finally {
    syncing = false;
  }
  return { synced, failed };
}

export async function syncPendingShifts(): Promise<{ synced: number; failed: number }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { synced: 0, failed: 0 };
  const hasSession = await ensureOnlineBackendSession();
  if (!hasSession) return { synced: 0, failed: 0 };

  const pending = await db.shifts.where("synced").equals(0).toArray();
  let synced = 0;
  let failed = 0;
  for (const shift of pending) {
    try {
      const { error } = await supabase.from("shifts").upsert({
        id: shift.id,
        cashier_id: shift.cashier_id,
        branch_id: shift.branch_id,
        started_at: shift.started_at,
        ended_at: shift.ended_at,
        opening_cash: shift.opening_cash,
        closing_cash_expected: shift.closing_cash_expected,
        closing_cash_actual: shift.closing_cash_actual,
        cash_diff: shift.cash_diff,
      } as any);
      if (error) throw error;
      await db.shifts.update(shift.id, { synced: 1, last_error: undefined });
      synced++;
    } catch (error) {
      failed++;
      await db.shifts.update(shift.id, {
        attempts: (shift.attempts ?? 0) + 1,
        last_error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
  return { synced, failed };
}

export async function syncEverything(): Promise<{ synced: number; failed: number }> {
  const [sales, movements, shifts] = await Promise.all([
    syncPendingSales(),
    syncPendingStockMovements(),
    syncPendingShifts(),
  ]);
  void syncReceiptsCache();
  return {
    synced: sales.synced + movements.synced + shifts.synced,
    failed: sales.failed + movements.failed + shifts.failed,
  };
}

export function startAutoSync(intervalMs = 15000) {
  if (typeof window === "undefined") return () => {};
  const tick = () => void syncEverything();
  const id = window.setInterval(tick, intervalMs);
  const online = () => tick();
  window.addEventListener("online", online);
  tick();
  return () => {
    window.clearInterval(id);
    window.removeEventListener("online", online);
  };
}
