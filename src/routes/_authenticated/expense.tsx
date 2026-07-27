import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatUZS, formatDate } from "@/lib/format";
import { useAuth } from "@/lib/auth-hooks";
import { toast } from "sonner";
import { Plus, ArrowUpCircle } from "lucide-react";
import { db, type PendingStockMovement } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { cacheOnlineStockMovements, saveStockMovement } from "@/lib/offline-ops";
import { useOnline } from "@/lib/auth-hooks";

export const Route = createFileRoute("/_authenticated/expense")({
  ssr: false,
  component: ExpensePage,
});

function ExpensePage() {
  const { user, profile } = useAuth();
  const online = useOnline();
  const [items, setItems] = useState<any[]>([]);
  const cachedItems = useLiveQuery(
    () => db.pendingStockMovements.where("type").equals("expense").reverse().sortBy("created_at"),
    [],
    [] as PendingStockMovement[],
  );

  async function load() {
    if (!online) return;
    const { data } = await supabase.from("stock_movements")
      .select("*").eq("type", "expense").order("created_at", { ascending: false }).limit(100);
    if (data) await cacheOnlineStockMovements(data, "expense");
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, [online]);
  const visibleItems = cachedItems?.length ? cachedItems : items;

  return (
    <div className="p-6 h-screen overflow-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2"><ArrowUpCircle className="w-6 h-6 text-destructive" />Расход</h1>
        <ExpenseDialog branchId={profile?.branch_id ?? null} userId={user?.id} onDone={load} />
      </div>
      <div className="space-y-2">
        {visibleItems.length === 0 && <div className="text-muted-foreground">Нет операций</div>}
        {visibleItems.map((m) => (
          <Card key={m.id} className="p-4 flex justify-between items-center">
            <div>
              <div className="font-medium">{m.note || "Расход"}</div>
              <div className="text-xs text-muted-foreground">{formatDate(m.created_at)}</div>
            </div>
            <div className="text-right font-bold text-destructive">-{formatUZS(m.amount ?? 0)}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ExpenseDialog({ branchId, userId, onDone }: any) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await saveStockMovement({
        type: "expense",
        amount: Number(amount),
        note,
        branch_id: branchId,
        user_id: userId,
      });
      toast.success(result.queued ? "Расход сохранён оффлайн" : "Расход добавлен");
      setOpen(false);
      setAmount(""); setNote("");
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
        <Button variant="destructive"><Plus className="w-4 h-4 mr-1" />Добавить расход</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Расход</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Сумма (UZS)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
          <div><Label>Описание</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} required rows={2} placeholder="За что расход" /></div>
          <Button type="submit" className="w-full" disabled={busy}>Сохранить</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
