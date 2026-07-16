import { db, type PendingSale } from "./db";
import { submitSale } from "./sales.functions";
import { v4 as uuidv4 } from "uuid";

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

export function startAutoSync(intervalMs = 15000) {
  if (typeof window === "undefined") return () => {};
  const tick = () => void syncPendingSales();
  const id = window.setInterval(tick, intervalMs);
  const online = () => tick();
  window.addEventListener("online", online);
  tick();
  return () => {
    window.clearInterval(id);
    window.removeEventListener("online", online);
  };
}
