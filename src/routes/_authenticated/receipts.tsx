import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { formatUZS } from "@/lib/format";
import { useAuth, useOnline } from "@/lib/auth-hooks";
import { db, type CachedSale, type CachedSaleItem } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { syncReceiptsCache } from "@/lib/receipts-cache";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Pencil, Check, X, CloudOff } from "lucide-react";
import { toast } from "sonner";
import { updateSaleItem, deleteSaleItem, deleteSale } from "@/lib/sales.functions";

export const Route = createFileRoute("/_authenticated/receipts")({
  ssr: false,
  component: ReceiptsPage,
});

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function payLabel(m: string) {
  return m === "cash" ? "Наличные" : m === "card" ? "Карта" : "Смешанная";
}

function ReceiptsPage() {
  const { role, user, profile } = useAuth();
  const online = useOnline();
  const [openId, setOpenId] = useState<string | null>(null);

  // Фоновая подтяжка с сервера — список при этом уже отрисован из локального кэша.
  useEffect(() => {
    if (!online || !user) return;
    void syncReceiptsCache({ userId: user.id, role });
  }, [online, user?.id, role]);

  const sales = useLiveQuery(
    () => db.sales.orderBy("created_at").reverse().limit(150).toArray(),
    [],
    [] as CachedSale[],
  );

  const visible = (sales ?? []).filter(
    (s) => role !== "cashier" || !s.cashier_id || s.cashier_id === user?.id,
  );

  const myName = profile?.nickname ?? profile?.email ?? "—";

  return (
    <div className="p-6 h-screen overflow-auto">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h1 className="text-2xl font-bold">Чеки</h1>
        {!online && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CloudOff className="w-4 h-4" /> офлайн — показаны сохранённые чеки
          </span>
        )}
      </div>
      <div className="space-y-2">
        {visible.length === 0 && <div className="text-muted-foreground">Пока нет чеков</div>}
        {visible.map((s) => (
          <Card
            key={s.id}
            className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:border-primary transition"
            onClick={() => setOpenId(s.id)}
          >
            <div className="min-w-0">
              <div className="font-semibold truncate">
                {s.cashier_name ?? (s.cashier_id === user?.id ? myName : "—")}
                <span className="text-muted-foreground font-normal"> · {fmtTime(s.created_at)}</span>
              </div>
              <div className="text-sm text-muted-foreground truncate">{fmtDateTime(s.created_at)}</div>
              <div className="text-xs text-muted-foreground truncate">
                {s.branch_name ?? "—"} · {payLabel(s.payment_method)}
                {s.pending === 1 && <span className="text-amber-500"> · не синхронизирован</span>}
              </div>
            </div>
            <div className="text-xl font-bold text-primary shrink-0">{formatUZS(s.total)}</div>
          </Card>
        ))}
      </div>

      <ReceiptDetailDialog
        saleId={openId}
        onClose={() => setOpenId(null)}
        canEdit={role === "admin" && online}
        onChanged={() => {
          if (user) void syncReceiptsCache({ userId: user.id, role });
        }}
      />
    </div>
  );
}

function ReceiptDetailDialog({
  saleId, onClose, canEdit, onChanged,
}: {
  saleId: string | null;
  onClose: () => void;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const sale = useLiveQuery(
    async () => (saleId ? await db.sales.get(saleId) : undefined),
    [saleId],
  ) as CachedSale | undefined;
  const items = useLiveQuery<CachedSaleItem[], CachedSaleItem[]>(
    async () => (saleId ? await db.saleItems.where("sale_id").equals(saleId).toArray() : []),
    [saleId],
    [] as CachedSaleItem[],
  );

  useEffect(() => {
    if (!saleId) setEditId(null);
  }, [saleId]);

  function startEdit(it: CachedSaleItem) {
    setEditId(it.id);
    setEditQty(String(it.qty));
    setEditPrice(String(it.unit_price));
  }

  async function saveEdit() {
    if (!editId) return;
    const qty = Number(editQty);
    const price = Number(editPrice);
    if (!qty || qty <= 0) { toast.error("Количество должно быть больше 0"); return; }
    try {
      await updateSaleItem({ data: { item_id: editId, qty, unit_price: price } });
      toast.success("Обновлено");
      setEditId(null);
      onChanged();
    } catch (e: any) { toast.error(e.message); }
  }

  async function delItem(id: string) {
    if (!confirm("Удалить позицию из чека?")) return;
    try {
      await deleteSaleItem({ data: { item_id: id } });
      toast.success("Удалено");
      onChanged();
    } catch (e: any) { toast.error(e.message); }
  }

  async function delWhole() {
    if (!sale) return;
    if (!confirm("Удалить чек полностью? Товары вернутся на склад.")) return;
    try {
      await deleteSale({ data: { sale_id: sale.id } });
      toast.success("Чек удалён");
      onChanged();
      onClose();
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <Dialog open={!!saleId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>
            {sale ? `${sale.cashier_name ?? "Кассир"} · ${fmtTime(sale.created_at)}` : "Чек"}
          </DialogTitle>
        </DialogHeader>
        {sale && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {fmtDateTime(sale.created_at)} · {payLabel(sale.payment_method)} · {sale.branch_name ?? "—"}
            </div>
            <div className="border border-border rounded-lg divide-y divide-border">
              {(items ?? []).length === 0 && <div className="p-4 text-muted-foreground text-sm">Позиций нет</div>}
              {(items ?? []).map((it) => (
                <div key={it.id} className="p-3 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {it.product_name}
                      {it.variant_size && <span className="text-muted-foreground"> · {it.variant_size}</span>}
                    </div>
                    {editId === it.id ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Input type="number" className="h-8 w-20" value={editQty} onChange={(e) => setEditQty(e.target.value)} />
                        <span className="text-muted-foreground">×</span>
                        <Input type="number" className="h-8 w-28" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">{it.qty} × {formatUZS(it.unit_price)}</div>
                    )}
                  </div>
                  <div className="text-right font-semibold min-w-[100px]">
                    {formatUZS(Number(it.qty) * Number(it.unit_price))}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      {editId === it.id ? (
                        <>
                          <Button size="icon" variant="ghost" onClick={saveEdit}><Check className="w-4 h-4 text-primary" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditId(null)}><X className="w-4 h-4" /></Button>
                        </>
                      ) : (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => startEdit(it)}><Pencil className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => delItem(it.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <div className="text-sm text-muted-foreground">Итого</div>
              <div className="text-xl font-bold text-primary">{formatUZS(sale.total)}</div>
            </div>
            {canEdit && (
              <Button variant="destructive" className="w-full" onClick={delWhole}>
                <Trash2 className="w-4 h-4 mr-1" />Удалить чек полностью
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
