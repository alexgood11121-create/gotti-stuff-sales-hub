import { supabase } from "@/integrations/supabase/client";
import { db, type PendingStockMovement } from "@/lib/db";
import { ensureOnlineBackendSession, isNetworkLikeError } from "@/lib/offline-auth";
import { v4 as uuidv4 } from "uuid";

type StockMovementInput = {
  type: "income" | "expense";
  product_id?: string | null;
  product_name?: string | null;
  qty?: number | null;
  unit_price?: number | null;
  amount: number;
  note?: string | null;
  branch_id?: string | null;
  user_id?: string | null;
};

async function adjustLocalStock(row: PendingStockMovement) {
  if (row.type !== "income" || !row.product_id || !row.qty) return;
  const product = await db.products.get(row.product_id);
  if (!product) return;
  await db.products.update(row.product_id, { stock: Number(product.stock ?? 0) + Number(row.qty) });
}

export async function saveStockMovement(input: StockMovementInput): Promise<{ queued: boolean; id: string }> {
  const row: PendingStockMovement = {
    id: uuidv4(),
    type: input.type,
    product_id: input.product_id ?? null,
    product_name: input.product_name ?? null,
    qty: input.qty ?? null,
    unit_price: input.unit_price ?? null,
    amount: input.amount,
    note: input.note ?? null,
    branch_id: input.branch_id ?? null,
    user_id: input.user_id ?? null,
    created_at: new Date().toISOString(),
    synced: 0,
    attempts: 0,
  };

  await db.pendingStockMovements.put(row);
  await adjustLocalStock(row);

  const hasSession = await ensureOnlineBackendSession();
  if (!hasSession) return { queued: true, id: row.id };

  try {
    const { error } = await supabase.from("stock_movements").insert({
      id: row.id,
      type: row.type,
      product_id: row.product_id,
      qty: row.qty,
      unit_price: row.unit_price,
      amount: row.amount,
      note: row.note,
      branch_id: row.branch_id,
      user_id: row.user_id,
      created_at: row.created_at,
    } as any);
    if (error) throw error;
    await db.pendingStockMovements.update(row.id, { synced: 1, last_error: undefined });
    return { queued: false, id: row.id };
  } catch (error) {
    if (!isNetworkLikeError(error)) {
      await db.pendingStockMovements.delete(row.id);
      throw error;
    }
    await db.pendingStockMovements.update(row.id, { last_error: error instanceof Error ? error.message : "offline" });
    return { queued: true, id: row.id };
  }
}

export async function cacheOnlineStockMovements(rows: any[], type: "income" | "expense") {
  const mapped: PendingStockMovement[] = rows.map((row) => ({
    id: row.id,
    type,
    product_id: row.product_id ?? null,
    product_name: row.products?.name ?? row.product_name ?? null,
    qty: row.qty ?? null,
    unit_price: row.unit_price ?? null,
    amount: Number(row.amount ?? 0),
    note: row.note ?? null,
    branch_id: row.branch_id ?? null,
    user_id: row.user_id ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
    synced: 1,
    attempts: 0,
  }));
  if (mapped.length) await db.pendingStockMovements.bulkPut(mapped);
}

export async function syncPendingStockMovements(): Promise<{ synced: number; failed: number }> {
  const hasSession = await ensureOnlineBackendSession();
  if (!hasSession) return { synced: 0, failed: 0 };

  const pending = await db.pendingStockMovements.where("synced").equals(0).toArray();
  let synced = 0;
  let failed = 0;
  for (const row of pending) {
    try {
      const { error } = await supabase.from("stock_movements").insert({
        id: row.id,
        type: row.type,
        product_id: row.product_id,
        qty: row.qty,
        unit_price: row.unit_price,
        amount: row.amount,
        note: row.note,
        branch_id: row.branch_id,
        user_id: row.user_id,
        created_at: row.created_at,
      } as any);
      if (error) throw error;
      await db.pendingStockMovements.update(row.id, { synced: 1, last_error: undefined });
      synced++;
    } catch (error) {
      failed++;
      await db.pendingStockMovements.update(row.id, {
        attempts: (row.attempts ?? 0) + 1,
        last_error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
  return { synced, failed };
}