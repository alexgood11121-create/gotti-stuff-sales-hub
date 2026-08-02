import { db, type CachedSale, type CachedSaleItem, type PendingSale } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { getOfflineAuthState } from "@/lib/offline-auth";

// Локальный кэш чеков: список и позиции лежат в IndexedDB, поэтому страница
// «Чеки» открывается мгновенно и полностью работает без интернета.

export async function cachePendingSale(sale: PendingSale) {
  const offline = await getOfflineAuthState();
  const row: CachedSale = {
    id: `pending:${sale.client_uuid}`,
    client_uuid: sale.client_uuid,
    created_at: sale.created_at,
    total: sale.total,
    payment_method: sale.payment_method,
    cash_amount: sale.cash_amount,
    card_amount: sale.card_amount,
    cashier_id: sale.cashier_id,
    cashier_name: offline?.profile?.nickname ?? offline?.profile?.email ?? null,
    branch_id: sale.branch_id,
    branch_name: null,
    pending: 1,
  };
  const items: CachedSaleItem[] = sale.items.map((it, i) => ({
    id: `pending:${sale.client_uuid}:${i}`,
    sale_id: row.id,
    product_id: it.product_id,
    product_name: it.product_name,
    variant_size: it.variant_size ?? null,
    qty: it.qty,
    unit_price: it.unit_price,
    cost_price: it.cost_price,
    total: it.total,
  }));
  await db.sales.put(row);
  await db.saleItems.bulkPut(items);
}

export async function dropPendingSaleCache(clientUuid: string) {
  const id = `pending:${clientUuid}`;
  await db.sales.delete(id);
  const items = await db.saleItems.where("sale_id").equals(id).primaryKeys();
  if (items.length) await db.saleItems.bulkDelete(items as string[]);
}

let syncing = false;

export async function syncReceiptsCache(opts: { userId?: string | null; role?: string | null } = {}) {
  if (syncing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  syncing = true;
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) return;

    let q = supabase
      .from("sales")
      .select("id,client_uuid,created_at,total,payment_method,cash_amount,card_amount,cashier_id,branch_id,branches(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (opts.role === "cashier" && opts.userId) q = q.eq("cashier_id", opts.userId);
    const { data: sales, error } = await q;
    if (error || !sales) return;

    const cashierIds = Array.from(new Set(sales.map((s: any) => s.cashier_id).filter(Boolean)));
    const nicks: Record<string, string> = {};
    if (cashierIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id,nickname,email").in("id", cashierIds);
      for (const p of profs ?? []) nicks[(p as any).id] = (p as any).nickname ?? (p as any).email ?? "—";
    }

    const ids = sales.map((s: any) => s.id);
    const { data: items } = ids.length
      ? await supabase
          .from("sale_items")
          .select("id,sale_id,product_id,product_name,variant_size,qty,unit_price,cost_price,total")
          .in("sale_id", ids)
      : { data: [] as any[] };

    const rows: CachedSale[] = sales.map((s: any) => ({
      id: s.id,
      client_uuid: s.client_uuid ?? null,
      created_at: s.created_at,
      total: Number(s.total ?? 0),
      payment_method: s.payment_method,
      cash_amount: Number(s.cash_amount ?? 0),
      card_amount: Number(s.card_amount ?? 0),
      cashier_id: s.cashier_id ?? null,
      cashier_name: s.cashier_id ? (nicks[s.cashier_id] ?? null) : null,
      branch_id: s.branch_id ?? null,
      branch_name: s.branches?.name ?? null,
      pending: 0,
    }));

    const itemRows: CachedSaleItem[] = (items ?? []).map((it: any) => ({
      id: it.id,
      sale_id: it.sale_id,
      product_id: it.product_id ?? null,
      product_name: it.product_name,
      variant_size: it.variant_size ?? null,
      qty: Number(it.qty ?? 0),
      unit_price: Number(it.unit_price ?? 0),
      cost_price: Number(it.cost_price ?? 0),
      total: Number(it.total ?? 0),
    }));

    await db.transaction("rw", db.sales, db.saleItems, async () => {
      const oldServer = await db.sales.where("pending").equals(0).primaryKeys();
      if (oldServer.length) {
        await db.sales.bulkDelete(oldServer as string[]);
        for (const sid of oldServer as string[]) {
          const keys = await db.saleItems.where("sale_id").equals(sid).primaryKeys();
          if (keys.length) await db.saleItems.bulkDelete(keys as string[]);
        }
      }
      await db.sales.bulkPut(rows);
      await db.saleItems.bulkPut(itemRows);
    });
  } catch {
    // офлайн — просто оставляем кэш как есть
  } finally {
    syncing = false;
  }
}
