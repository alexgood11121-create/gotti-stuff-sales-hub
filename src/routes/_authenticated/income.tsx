import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatUZS, formatDate } from "@/lib/format";
import { useAuth } from "@/lib/auth-hooks";
import { toast } from "sonner";
import { Plus, ArrowDownCircle } from "lucide-react";
import { db, type PendingStockMovement } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { cacheOnlineStockMovements, saveStockMovement } from "@/lib/offline-ops";
import { useOnline } from "@/lib/auth-hooks";

export const Route = createFileRoute("/_authenticated/income")({
  ssr: false,
  component: IncomePage,
});

function IncomePage() {
  const { user, profile } = useAuth();
  const online = useOnline();
  const [items, setItems] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const cachedItems = useLiveQuery(
    () => db.pendingStockMovements.where("type").equals("income").reverse().sortBy("created_at"),
    [],
    [] as PendingStockMovement[],
  );

  async function load() {
    if (!online) {
      setProducts(await db.products.orderBy("name").toArray());
      return;
    }
    try {
      const [{ data: mv }, { data: pr }] = await Promise.all([
        supabase.from("stock_movements").select("*, products(name)").eq("type", "income").order("created_at", { ascending: false }).limit(100),
        supabase.from("products").select("id,name").eq("is_active", true).order("name"),
      ]);
      if (mv) await cacheOnlineStockMovements(mv, "income");
      setItems(mv ?? []);
      setProducts(pr ?? await db.products.orderBy("name").toArray());
    } catch {
      setProducts(await db.products.orderBy("name").toArray());
    }
  }
  useEffect(() => { load(); }, [online]);
  const visibleItems = cachedItems?.length ? cachedItems : items;

  return (
    <div className="p-6 h-screen overflow-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2"><ArrowDownCircle className="w-6 h-6 text-primary" />Приход</h1>
        <IncomeDialog products={products} branchId={profile?.branch_id ?? null} cashierId={user?.id} onDone={load} />
      </div>
      <div className="space-y-2">
        {visibleItems.length === 0 && <div className="text-muted-foreground">Нет операций</div>}
        {visibleItems.map((m: any) => (
          <Card key={m.id} className="p-4 flex justify-between items-center">
            <div>
              <div className="font-medium">{m.products?.name ?? m.product_name ?? m.note}</div>
              <div className="text-xs text-muted-foreground">{formatDate(m.created_at)}</div>
            </div>
            <div className="text-right">
              <div className="font-bold">+{m.qty} шт</div>
              <div className="text-sm text-muted-foreground">{formatUZS((m.qty ?? 0) * Number(m.unit_price ?? 0))}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function IncomeDialog({ products, branchId, cashierId, onDone }: any) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState<string>("");
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) return;
    setBusy(true);
    const qtyN = Number(qty);
    const costN = Number(cost) || 0;
    try {
      const productName = products.find((p: any) => p.id === productId)?.name ?? null;
      const result = await saveStockMovement({
        type: "income",
        product_id: productId,
        product_name: productName,
        qty: qtyN,
        unit_price: costN,
        amount: qtyN * costN,
        note,
        branch_id: branchId,
        user_id: cashierId,
      });
      toast.success(result.queued ? "Приход сохранён оффлайн" : "Приход добавлен");
      setOpen(false);
      setProductId(""); setQty("1"); setCost(""); setNote("");
      onDone();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-1" />Добавить приход</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Приход товара</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Товар</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Выберите товар" /></SelectTrigger>
              <SelectContent>
                {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Количество</Label><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} min="1" required /></div>
            <div><Label>Закуп. цена</Label><Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
          </div>
          <div><Label>Комментарий</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></div>
          <Button type="submit" className="w-full" disabled={busy || !productId}>Сохранить</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
