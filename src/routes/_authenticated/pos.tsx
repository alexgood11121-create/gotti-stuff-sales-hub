import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db, type CachedProduct, type CachedCategory } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth, useOnline } from "@/lib/auth-hooks";
import { queueSaleOffline, syncPendingSales } from "@/lib/sync";
import { formatUZS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trash2, Plus, Minus, Search, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pos")({
  ssr: false,
  component: POSPage,
});

interface CartLine {
  key: string;
  product_id: string;
  name: string;
  variant_size?: string | null;
  qty: number;
  unit_price: number;
  cost_price: number;
}

function POSPage() {
  const { user, profile } = useAuth();
  const online = useOnline();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string | "all">("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payOpen, setPayOpen] = useState(false);

  // Кэш каталога
  useEffect(() => {
    if (!online) return;
    (async () => {
      const [{ data: prods }, { data: cats }] = await Promise.all([
        supabase.from("products").select("*").eq("is_active", true),
        supabase.from("categories").select("*"),
      ]);
      if (prods) {
        await db.products.clear();
        await db.products.bulkPut(prods as any);
      }
      if (cats) {
        await db.categories.clear();
        await db.categories.bulkPut(cats as any);
      }
    })();
  }, [online]);

  const products = useLiveQuery(() => db.products.toArray(), [], [] as CachedProduct[]);
  const categories = useLiveQuery(() => db.categories.toArray(), [], [] as CachedCategory[]);

  const filtered = useMemo(() => {
    return (products ?? [])
      .filter((p) => p.is_active)
      .filter((p) => cat === "all" || p.category_id === cat)
      .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (b.sales_count ?? 0) - (a.sales_count ?? 0) || a.name.localeCompare(b.name));
  }, [products, cat, search]);

  const total = cart.reduce((s, l) => s + l.qty * l.unit_price, 0);

  const [sizePicker, setSizePicker] = useState<CachedProduct | null>(null);

  function addLine(p: CachedProduct, variant?: { size: string; sale_price: number; cost_price?: number }) {
    const key = variant ? `${p.id}::${variant.size}` : p.id;
    const unit_price = variant ? Number(variant.sale_price) : Number(p.sale_price);
    const cost_price = variant ? Number(variant.cost_price ?? p.cost_price) : Number(p.cost_price);
    setCart((c) => {
      const ex = c.find((l) => l.key === key);
      if (ex) return c.map((l) => l.key === key ? { ...l, qty: l.qty + 1 } : l);
      return [...c, {
        key,
        product_id: p.id,
        name: p.name,
        variant_size: variant?.size ?? null,
        qty: 1,
        unit_price,
        cost_price,
      }];
    });
  }

  function onProductClick(p: CachedProduct) {
    const sizes = Array.isArray(p.sizes) ? p.sizes : [];
    if (sizes.length > 0) {
      setSizePicker(p);
    } else {
      addLine(p);
    }
  }

  function changeQty(key: string, delta: number) {
    setCart((c) => c
      .map((l) => l.key === key ? { ...l, qty: l.qty + delta } : l)
      .filter((l) => l.qty > 0));
  }

  function removeLine(key: string) {
    setCart((c) => c.filter((l) => l.key !== key));
  }

  function clearCart() { setCart([]); }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Каталог */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Поиск товара..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-11" />
            </div>
          </div>
          <Tabs value={cat} onValueChange={(v) => setCat(v as any)}>
            <TabsList className="flex-wrap h-auto justify-start">
              <TabsTrigger value="all">Все</TabsTrigger>
              {(categories ?? []).map((c) => (
                <TabsTrigger key={c.id} value={c.id}>{c.name}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              Нет товаров. Добавьте товары в разделе «Товары».
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map((p) => {
                const hasSizes = Array.isArray(p.sizes) && p.sizes.length > 0;
                const priceLabel = hasSizes
                  ? `от ${formatUZS(Math.min(...p.sizes.map((s) => Number(s.sale_price))))}`
                  : formatUZS(p.sale_price);
                return (
                  <button
                    key={p.id}
                    onClick={() => onProductClick(p)}
                    className="bg-card border border-border hover:border-primary rounded-lg p-3 text-left transition-colors flex flex-col active:scale-95"
                  >
                    <div className="aspect-square rounded-md bg-muted overflow-hidden mb-2 flex items-center justify-center">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="font-medium text-sm line-clamp-2 flex-1">{p.name}</div>
                    <div className="text-primary font-semibold text-sm mt-1">{priceLabel}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Чек */}
      <div className="w-96 flex flex-col bg-sidebar border-l border-border">
        <div className="p-4 border-b border-border">
          <div className="text-sm text-muted-foreground">Текущий чек</div>
          <div className="text-2xl font-bold">{formatUZS(total)}</div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-16">Корзина пуста</div>
          ) : cart.map((l) => (
            <div key={l.key} className="bg-card rounded-lg p-3">
              <div className="flex justify-between items-start gap-2">
                <div className="font-medium text-sm flex-1">
                  {l.name}
                  {l.variant_size && <span className="text-muted-foreground"> · {l.variant_size}</span>}
                </div>
                <button onClick={() => removeLine(l.key)}><Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" /></button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => changeQty(l.key, -1)}><Minus className="w-3 h-3" /></Button>
                  <span className="w-8 text-center font-semibold">{l.qty}</span>
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => changeQty(l.key, 1)}><Plus className="w-3 h-3" /></Button>
                </div>
                <div className="text-sm font-semibold">{formatUZS(l.qty * l.unit_price)}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-border space-y-2">
          <Button variant="outline" className="w-full" onClick={clearCart} disabled={!cart.length}>Очистить</Button>
          <Button className="w-full h-14 text-lg font-bold" onClick={() => setPayOpen(true)} disabled={!cart.length}>
            ОПЛАТИТЬ {formatUZS(total)}
          </Button>
        </div>
      </div>

      <PayDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        total={total}
        cart={cart}
        onSuccess={() => { clearCart(); setPayOpen(false); }}
        cashierId={user?.id}
        branchId={profile?.branch_id ?? null}
      />
    </div>
  );
}

function PayDialog({
  open, onOpenChange, total, cart, onSuccess, cashierId, branchId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  total: number;
  cart: CartLine[];
  onSuccess: () => void;
  cashierId?: string;
  branchId: string | null;
}) {
  const [method, setMethod] = useState<"cash" | "card" | "mixed">("cash");
  const [cash, setCash] = useState<string>("");
  const [card, setCard] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMethod("cash");
      setCash("");
      setCard("");
    }
  }, [open]);

  const cashNum = Number(cash) || 0;

  let given = 0;
  let cashPaid = 0;
  let cardPaid = 0;
  if (method === "cash") { given = cashNum; cashPaid = Math.min(cashNum, total); cardPaid = 0; }
  else if (method === "card") { given = total; cashPaid = 0; cardPaid = total; }
  else {
    // Смешанная: карта автоматически = остаток после наличных
    cashPaid = Math.min(Math.max(0, cashNum), total);
    cardPaid = Math.max(0, total - cashPaid);
    given = cashPaid + cardPaid;
  }

  const change = method === "cash" ? Math.max(0, cashNum - total) : 0;
  const insufficient = method === "mixed" ? false : given < total - 0.01;

  async function pay() {
    if (!cashierId) return;
    if (insufficient) { toast.error("Недостаточно средств"); return; }
    setBusy(true);
    try {
      const client_uuid = await queueSaleOffline({
        branch_id: branchId,
        cashier_id: cashierId,
        total,
        cash_amount: cashPaid,
        card_amount: cardPaid,
        given_amount: given,
        change_amount: change,
        payment_method: method,
        items: cart.map((l) => ({
          product_id: l.product_id,
          product_name: l.name,
          variant_size: l.variant_size ?? null,
          qty: l.qty,
          unit_price: l.unit_price,
          cost_price: l.cost_price,
          total: l.qty * l.unit_price,
        })),
      });
      const res = await syncPendingSales();
      if (res.synced > 0) {
        toast.success(`Чек оплачен${change > 0 ? `. Сдача: ${formatUZS(change)}` : ""}`);
      } else {
        toast.success(`Чек сохранён офлайн${change > 0 ? `. Сдача: ${formatUZS(change)}` : ""}`);
      }
      onSuccess();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Оплата · {formatUZS(total)}</DialogTitle>
        </DialogHeader>
        <Tabs value={method} onValueChange={(v) => setMethod(v as any)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="cash">Наличные</TabsTrigger>
            <TabsTrigger value="card">Карта</TabsTrigger>
            <TabsTrigger value="mixed">Смешанная</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="space-y-3 pt-2">
          {(method === "cash" || method === "mixed") && (
            <div>
              <label className="text-sm text-muted-foreground">Наличные (клиент дал)</label>
              <Input type="number" inputMode="numeric" value={cash} onChange={(e) => setCash(e.target.value)} className="h-12 text-lg" />
            </div>
          )}
          {(method === "card" || method === "mixed") && (
            <div>
              <label className="text-sm text-muted-foreground">
                Карта{method === "mixed" ? " (автоматически = остаток)" : ""}
              </label>
              <Input
                type="number"
                inputMode="numeric"
                value={method === "card" ? String(total) : String(cardPaid)}
                readOnly
                className="h-12 text-lg bg-muted"
              />
            </div>
          )}
          <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>К оплате:</span><span className="font-semibold">{formatUZS(total)}</span></div>
            <div className="flex justify-between"><span>Внесено:</span><span className={insufficient ? "text-destructive font-semibold" : "font-semibold"}>{formatUZS(given)}</span></div>
            {method === "cash" && change > 0 && (
              <div className="flex justify-between text-primary text-base pt-1 border-t border-border">
                <span>Сдача:</span><span className="font-bold">{formatUZS(change)}</span>
              </div>
            )}
            {insufficient && <div className="text-destructive text-xs">Недостаточно средств</div>}
          </div>
          <Button className="w-full h-14 text-lg font-bold" onClick={pay} disabled={busy || insufficient}>
            Подтвердить оплату
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
