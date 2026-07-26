import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatUZS } from "@/lib/format";
import { useAuth } from "@/lib/auth-hooks";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { getSaleDetail, updateSaleItem, deleteSaleItem, deleteSale } from "@/lib/sales.functions";

export const Route = createFileRoute("/_authenticated/receipts")({
  ssr: false,
  component: ReceiptsPage,
});

function ReceiptsPage() {
  const { role, user } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [nicks, setNicks] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    let q = supabase
      .from("sales")
      .select("id,created_at,total,payment_method,cash_amount,card_amount,cashier_id,branches(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (role === "cashier") q = q.eq("cashier_id", user.id);
    const { data } = await q;
    setSales(data ?? []);
    const ids = Array.from(new Set((data ?? []).map((s: any) => s.cashier_id).filter(Boolean)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,nickname").in("id", ids);
      setNicks(Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.nickname])));
    }
  }

  useEffect(() => { load(); }, [user, role]);

  return (
    <div className="p-6 h-screen overflow-auto">
      <h1 className="text-2xl font-bold mb-4">Чеки</h1>
      <div className="space-y-2">
        {sales.length === 0 && <div className="text-muted-foreground">Пока нет чеков</div>}
        {sales.map((s) => (
          <Card
            key={s.id}
            className="p-4 flex items-center justify-between cursor-pointer hover:border-primary transition"
            onClick={() => setOpenId(s.id)}
          >
            <div>
              <div className="font-mono text-xs text-muted-foreground">#{s.id.slice(0, 8)}</div>
              <div className="text-sm">{formatDate(s.created_at)}</div>
              <div className="text-xs text-muted-foreground">
                {s.branches?.name ?? "—"} · {nicks[s.cashier_id] ?? "—"} · {payLabel(s.payment_method)}
              </div>
            </div>
            <div className="text-xl font-bold text-primary">{formatUZS(s.total)}</div>
          </Card>
        ))}
      </div>

      <ReceiptDetailDialog
        saleId={openId}
        onClose={() => setOpenId(null)}
        canEdit={role === "admin"}
        onChanged={load}
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
  const [sale, setSale] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editPrice, setEditPrice] = useState("");

  async function load() {
    if (!saleId) return;
    setLoading(true);
    try {
      const r = await getSaleDetail({ data: { sale_id: saleId } });
      setSale(r.sale);
      setItems(r.items);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (saleId) load(); else { setSale(null); setItems([]); setEditId(null); } }, [saleId]);

  function startEdit(it: any) {
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
      await load();
      onChanged();
    } catch (e: any) { toast.error(e.message); }
  }

  async function delItem(id: string) {
    if (!confirm("Удалить позицию из чека?")) return;
    try {
      await deleteSaleItem({ data: { item_id: id } });
      toast.success("Удалено");
      await load();
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
          <DialogTitle>Чек {sale && <span className="font-mono text-sm text-muted-foreground">#{sale.id.slice(0, 8)}</span>}</DialogTitle>
        </DialogHeader>
        {loading && <div className="text-muted-foreground">Загрузка...</div>}
        {sale && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {formatDate(sale.created_at)} · {payLabel(sale.payment_method)}
            </div>
            <div className="border border-border rounded-lg divide-y divide-border">
              {items.length === 0 && <div className="p-4 text-muted-foreground text-sm">Позиций нет</div>}
              {items.map((it) => (
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

function payLabel(m: string) {
  return m === "cash" ? "Наличные" : m === "card" ? "Карта" : "Смешанная";
}
