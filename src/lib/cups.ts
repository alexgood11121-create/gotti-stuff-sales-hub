import { supabase } from "@/integrations/supabase/client";
import {
  db,
  type CachedCupType,
  type CachedShiftCup,
  type PendingCupCount,
  type ProductSize,
} from "@/lib/db";

// Учёт стаканов: типы и выдача кэшируются локально, расход считается
// из закэшированных чеков, поэтому экран полностью работает офлайн.

export interface CupUsageRow {
  cup: CachedCupType;
  issued: number;
  used: number;
  left: number;
  counted: number | null;
  diff: number | null;
}

function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine;
}

export async function listCupTypes(): Promise<CachedCupType[]> {
  const rows = await db.cupTypes.toArray();
  return rows
    .filter((c) => c.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "ru"));
}

export async function refreshCupTypes(): Promise<CachedCupType[]> {
  if (isOnline()) {
    try {
      const { data } = await supabase
        .from("cup_types")
        .select("id,name,material,volume_ml,sort_order,is_active")
        .eq("is_active", true);
      if (data) {
        const rows: CachedCupType[] = data.map((c: any) => ({
          id: c.id,
          name: c.name,
          material: c.material,
          volume_ml: Number(c.volume_ml ?? 0),
          sort_order: Number(c.sort_order ?? 0),
          is_active: !!c.is_active,
        }));
        await db.cupTypes.clear();
        await db.cupTypes.bulkPut(rows);
      }
    } catch {
      /* офлайн — используем кэш */
    }
  }
  return listCupTypes();
}

export async function refreshShiftCups(shiftId: string): Promise<CachedShiftCup[]> {
  if (isOnline()) {
    try {
      const { data } = await supabase
        .from("shift_cups")
        .select("id,shift_id,cup_type_id,issued_qty,counted_qty,updated_at")
        .eq("shift_id", shiftId);
      if (data) {
        const rows: CachedShiftCup[] = data.map((r: any) => ({
          id: r.id,
          shift_id: r.shift_id,
          cup_type_id: r.cup_type_id,
          issued_qty: Number(r.issued_qty ?? 0),
          counted_qty: r.counted_qty == null ? null : Number(r.counted_qty),
          updated_at: r.updated_at,
        }));
        const old = await db.shiftCups.where("shift_id").equals(shiftId).primaryKeys();
        if (old.length) await db.shiftCups.bulkDelete(old as string[]);
        await db.shiftCups.bulkPut(rows);
      }
    } catch {
      /* офлайн */
    }
  }
  return db.shiftCups.where("shift_id").equals(shiftId).toArray();
}

/** Сохранить выдачу стаканов на смену (только админ, нужен интернет). */
export async function issueCups(shiftId: string, issued: Record<string, number>) {
  const payload = Object.entries(issued).map(([cup_type_id, qty]) => ({
    shift_id: shiftId,
    cup_type_id,
    issued_qty: Number(qty) || 0,
  }));
  if (!payload.length) return;
  const { error } = await supabase
    .from("shift_cups")
    .upsert(payload as any, { onConflict: "shift_id,cup_type_id" });
  if (error) throw error;
  await refreshShiftCups(shiftId);
}

/** Кассир вносит фактический пересчёт — работает офлайн через очередь. */
export async function saveCountedCups(shiftId: string, counted: Record<string, number>) {
  const now = new Date().toISOString();
  const existing = await db.shiftCups.where("shift_id").equals(shiftId).toArray();
  for (const [cupTypeId, qty] of Object.entries(counted)) {
    const value = Number(qty) || 0;
    const row = existing.find((r) => r.cup_type_id === cupTypeId);
    await db.shiftCups.put({
      id: row?.id ?? `local:${shiftId}:${cupTypeId}`,
      shift_id: shiftId,
      cup_type_id: cupTypeId,
      issued_qty: row?.issued_qty ?? 0,
      counted_qty: value,
      updated_at: now,
    });
    const pending: PendingCupCount = {
      id: `${shiftId}:${cupTypeId}`,
      shift_id: shiftId,
      cup_type_id: cupTypeId,
      counted_qty: value,
      created_at: now,
      synced: 0,
      attempts: 0,
    };
    await db.pendingCupCounts.put(pending);
  }
  void syncPendingCupCounts();
}

export async function syncPendingCupCounts(): Promise<{ synced: number; failed: number }> {
  if (!isOnline()) return { synced: 0, failed: 0 };
  const pending = await db.pendingCupCounts.where("synced").equals(0).toArray();
  let synced = 0;
  let failed = 0;
  for (const row of pending) {
    try {
      const { error } = await supabase
        .from("shift_cups")
        .upsert(
          { shift_id: row.shift_id, cup_type_id: row.cup_type_id, counted_qty: row.counted_qty } as any,
          { onConflict: "shift_id,cup_type_id" },
        );
      if (error) throw error;
      await db.pendingCupCounts.delete(row.id);
      synced++;
    } catch (e) {
      failed++;
      await db.pendingCupCounts.update(row.id, {
        attempts: (row.attempts ?? 0) + 1,
        last_error: e instanceof Error ? e.message : "unknown",
      });
    }
  }
  return { synced, failed };
}

/** Тип стакана для позиции чека: сначала размер товара, потом сам товар. */
function cupForItem(
  product: { cup_type_id?: string | null; sizes?: ProductSize[] } | undefined,
  variantSize: string | null,
): string | null {
  if (!product) return null;
  if (variantSize) {
    const size = (product.sizes ?? []).find((s) => s.size === variantSize);
    if (size?.cup_type_id) return size.cup_type_id;
  }
  return product.cup_type_id ?? null;
}

/** Сколько стаканов израсходовано за период смены (по локальным чекам). */
export async function computeUsedCups(opts: {
  cashierId: string | null;
  startedAt: string;
  endedAt?: string | null;
}): Promise<Record<string, number>> {
  const sales = await db.sales.toArray();
  const relevant = sales.filter((s) => {
    if (opts.cashierId && s.cashier_id && s.cashier_id !== opts.cashierId) return false;
    if (s.created_at < opts.startedAt) return false;
    if (opts.endedAt && s.created_at > opts.endedAt) return false;
    return true;
  });
  if (!relevant.length) return {};
  const ids = new Set(relevant.map((s) => s.id));
  const items = await db.saleItems.toArray();
  const products = await db.products.toArray();
  const byId = new Map(products.map((p) => [p.id, p]));
  const used: Record<string, number> = {};
  for (const it of items) {
    if (!ids.has(it.sale_id)) continue;
    const cupId = cupForItem(it.product_id ? byId.get(it.product_id) : undefined, it.variant_size);
    if (!cupId) continue;
    used[cupId] = (used[cupId] ?? 0) + Number(it.qty ?? 0);
  }
  return used;
}

export async function buildCupRows(opts: {
  shiftId: string | null;
  cashierId: string | null;
  startedAt: string | null;
  endedAt?: string | null;
}): Promise<CupUsageRow[]> {
  const [types, shiftCups, used] = await Promise.all([
    listCupTypes(),
    opts.shiftId ? db.shiftCups.where("shift_id").equals(opts.shiftId).toArray() : Promise.resolve([]),
    opts.startedAt
      ? computeUsedCups({ cashierId: opts.cashierId, startedAt: opts.startedAt, endedAt: opts.endedAt ?? null })
      : Promise.resolve({} as Record<string, number>),
  ]);
  return types.map((cup) => {
    const sc = shiftCups.find((r) => r.cup_type_id === cup.id);
    const issued = Number(sc?.issued_qty ?? 0);
    const u = Number(used[cup.id] ?? 0);
    const left = issued - u;
    const counted = sc?.counted_qty ?? null;
    return { cup, issued, used: u, left, counted, diff: counted == null ? null : counted - left };
  });
}
