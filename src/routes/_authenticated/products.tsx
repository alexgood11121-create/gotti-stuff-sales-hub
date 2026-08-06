import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatUZS } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, Upload, LayoutGrid, Rows3, List, ArrowDownUp } from "lucide-react";
import { useAuth } from "@/lib/auth-hooks";
import { refreshCupTypes } from "@/lib/cups";

export const Route = createFileRoute("/_authenticated/products")({
  ssr: false,
  component: ProductsPage,
});

type ViewMode = "grid" | "list" | "compact";
type SortKey = "name" | "price_desc" | "price_asc" | "stock" | "popular";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "popular", label: "Популярные" },
  { key: "name", label: "По названию" },
  { key: "price_desc", label: "Цена ↓" },
  { key: "price_asc", label: "Цена ↑" },
  { key: "stock", label: "Остаток" },
];

function ProductsPage() {
  const { role } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [showProd, setShowProd] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>(
    () => (typeof localStorage !== "undefined" && (localStorage.getItem("products-view") as ViewMode)) || "grid",
  );
  const [sort, setSort] = useState<SortKey>(
    () => (typeof localStorage !== "undefined" && (localStorage.getItem("products-sort") as SortKey)) || "name",
  );

  function changeView(v: ViewMode) { setView(v); localStorage.setItem("products-view", v); }
  function changeSort(s: SortKey) { setSort(s); localStorage.setItem("products-sort", s); }

  async function load() {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("products").select("*, categories(name)").order("name"),
      supabase.from("categories").select("*").order("name"),
    ]);
    setProducts(p ?? []); setCats(c ?? []);
  }
  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const arr = products.filter((p) => p.is_active && (!q || String(p.name).toLowerCase().includes(q)));
    const sorted = [...arr];
    sorted.sort((a, b) => {
      switch (sort) {
        case "price_desc": return Number(b.sale_price) - Number(a.sale_price);
        case "price_asc": return Number(a.sale_price) - Number(b.sale_price);
        case "stock": return Number(b.stock) - Number(a.stock);
        case "popular": return Number(b.sales_count ?? 0) - Number(a.sales_count ?? 0);
        default: return String(a.name).localeCompare(String(b.name), "ru");
      }
    });
    return sorted;
  }, [products, search, sort]);

  if (role !== "admin") {
    return <div className="p-6 text-muted-foreground">Доступ только для админа</div>;
  }

  async function del(id: string) {
    if (!confirm("Удалить товар?")) return;
    const { error } = await supabase.from("products").update({ is_active: false }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Удалён");
    load();
  }

  return (
    <div className="p-6 h-screen overflow-auto">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-4">
        <h1 className="truncate text-2xl font-bold">Товары</h1>
        <div className="flex shrink-0 gap-2">
          <CategoryDialog onDone={load} />
          <Button onClick={() => { setEditing(null); setShowProd(true); }}>
            <Plus className="w-4 h-4 mr-1" />Товар
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск товара..."
          className="max-w-[240px]"
        />
        <div className="flex items-center gap-1">
          <ArrowDownUp className="w-4 h-4 text-muted-foreground" />
          {SORTS.map((s) => (
            <Button
              key={s.key}
              size="sm"
              variant={sort === s.key ? "default" : "outline"}
              onClick={() => changeSort(s.key)}
            >
              {s.label}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          {([["grid", LayoutGrid, "Квадраты"], ["list", Rows3, "Длинные"], ["compact", List, "Компакт"]] as const).map(
            ([mode, Icon, title]) => (
              <Button
                key={mode}
                size="icon"
                title={title}
                variant={view === mode ? "default" : "outline"}
                onClick={() => changeView(mode)}
              >
                <Icon className="w-4 h-4" />
              </Button>
            ),
          )}
        </div>
      </div>

      {view === "grid" && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {visible.map((p: any) => (
            <Card key={p.id} className="p-3">
              <div className="aspect-square rounded bg-muted overflow-hidden mb-2 flex items-center justify-center">
                {p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy" className="w-full h-full object-cover" /> : <Package className="w-8 h-8 text-muted-foreground" />}
              </div>
              <div className="font-medium text-sm">{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.categories?.name ?? "Без категории"} · Ост.: {p.stock}</div>
              <div className="flex justify-between items-center mt-2">
                <div>
                  <div className="text-primary font-semibold">{formatUZS(p.sale_price)}</div>
                  <div className="text-xs text-muted-foreground">Закуп: {formatUZS(p.cost_price)}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setShowProd(true); }}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => del(p.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {view === "list" && (
        <div className="space-y-2">
          {visible.map((p: any) => (
            <Card key={p.id} className="p-3 flex items-center gap-3">
              <div className="w-14 h-14 shrink-0 rounded bg-muted overflow-hidden flex items-center justify-center">
                {p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy" className="w-full h-full object-cover" /> : <Package className="w-6 h-6 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {p.categories?.name ?? "Без категории"} · Ост.: {p.stock} · Продано: {p.sales_count ?? 0}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-primary font-semibold">{formatUZS(p.sale_price)}</div>
                <div className="text-xs text-muted-foreground">Закуп: {formatUZS(p.cost_price)}</div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setShowProd(true); }}><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => del(p.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {view === "compact" && (
        <div className="border border-border rounded-lg divide-y divide-border">
          {visible.map((p: any) => (
            <div key={p.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1 truncate text-sm">{p.name}</div>
              <div className="shrink-0 text-xs text-muted-foreground">Ост.: {p.stock}</div>
              <div className="shrink-0 font-semibold">{formatUZS(p.sale_price)}</div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setShowProd(true); }}><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => del(p.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {visible.length === 0 && <div className="text-sm text-muted-foreground py-8">Товары не найдены</div>}

      <ProductDialog open={showProd} onOpenChange={setShowProd} editing={editing} cats={cats} onDone={load} />
    </div>
  );
}


interface SizeRow { size: string; sale_price: string; cost_price: string; cup_type_id: string }

function ProductDialog({ open, onOpenChange, editing, cats, onDone }: any) {
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [sale, setSale] = useState("");
  const [cat, setCat] = useState<string>("");
  const [cup, setCup] = useState<string>("");
  const [cupTypes, setCupTypes] = useState<any[]>([]);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [sizes, setSizes] = useState<SizeRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    refreshCupTypes().then(setCupTypes).catch(() => {});
  }, []);

  useEffect(() => {
    if (editing) {
      setName(editing.name); setCost(String(editing.cost_price));
      setSale(String(editing.sale_price)); setCat(editing.category_id ?? "");
      setCup(editing.cup_type_id ?? "");
      setImageUrl(editing.image_url ?? "");
      const s = Array.isArray(editing.sizes) ? editing.sizes : [];
      setSizes(s.map((x: any) => ({
        size: String(x.size ?? ""),
        sale_price: String(x.sale_price ?? ""),
        cost_price: x.cost_price != null ? String(x.cost_price) : "",
        cup_type_id: x.cup_type_id ?? "",
      })));
    } else {
      setName(""); setCost(""); setSale(""); setCat(""); setCup(""); setImageUrl(""); setSizes([]);
    }
  }, [editing, open]);

  async function upload(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) throw error;
      const { data, error: sErr } = await supabase.storage.from("product-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (sErr) throw sErr;
      const url = data?.signedUrl ?? "";
      setImageUrl(url);
      toast.success("Фото загружено");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setUploading(false); }
  }

  function updateSize(i: number, patch: Partial<SizeRow>) {
    setSizes((rows) => rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }
  function addSize() { setSizes((r) => [...r, { size: "", sale_price: "", cost_price: "", cup_type_id: "" }]); }
  function removeSize(i: number) { setSizes((r) => r.filter((_, idx) => idx !== i)); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const cleanSizes = sizes
      .filter((s) => s.size.trim() && s.sale_price !== "")
      .map((s) => ({
        size: s.size.trim(),
        sale_price: Number(s.sale_price),
        ...(s.cost_price !== "" ? { cost_price: Number(s.cost_price) } : {}),
        cup_type_id: s.cup_type_id || null,
      }));
    const payload = {
      name, cost_price: Number(cost), sale_price: Number(sale),
      category_id: cat || null, image_url: imageUrl || null,
      cup_type_id: cup || null,
      sizes: cleanSizes,
    };
    const q = editing
      ? supabase.from("products").update(payload).eq("id", editing.id)
      : supabase.from("products").insert({ ...payload, is_active: true });
    const { error } = await q;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Сохранено");
    onOpenChange(false); onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Редактирование" : "Новый товар"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0">
              {imageUrl ? <img src={imageUrl} className="w-full h-full object-cover" /> : <Package className="w-8 h-8 text-muted-foreground" />}
            </div>
            <label className="flex-1">
              <Button type="button" variant="outline" size="sm" asChild>
                <div className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />{uploading ? "Загрузка..." : "Загрузить фото"}
                </div>
              </Button>
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          </div>
          <div><Label>Название</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Закуп. цена</Label><Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} required /></div>
            <div><Label>Продаж. цена</Label><Input type="number" value={sale} onChange={(e) => setSale(e.target.value)} required /></div>
          </div>
          <div>
            <Label>Категория</Label>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger><SelectValue placeholder="Без категории" /></SelectTrigger>
              <SelectContent>
                {cats.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Стакан (по умолчанию)</Label>
            <Select value={cup} onValueChange={setCup}>
              <SelectTrigger><SelectValue placeholder="Без стакана" /></SelectTrigger>
              <SelectContent>
                {cupTypes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <Label>Размеры (необязательно)</Label>
              <Button type="button" size="sm" variant="outline" onClick={addSize}>
                <Plus className="w-3 h-3 mr-1" />Добавить размер
              </Button>
            </div>
            {sizes.length === 0 && (
              <div className="text-xs text-muted-foreground">
                Если у товара есть варианты (S/M/L, 0.3/0.5 л и т.д.) — добавьте их со своей ценой. Кассир выберет размер при добавлении.
              </div>
            )}
            {sizes.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1.2fr_auto] gap-2 items-end">
                <div>
                  <Label className="text-xs">Размер</Label>
                  <Input value={s.size} onChange={(e) => updateSize(i, { size: e.target.value })} placeholder="S / 0.5л" />
                </div>
                <div>
                  <Label className="text-xs">Цена продажи</Label>
                  <Input type="number" value={s.sale_price} onChange={(e) => updateSize(i, { sale_price: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Закуп (опц.)</Label>
                  <Input type="number" value={s.cost_price} onChange={(e) => updateSize(i, { cost_price: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Стакан</Label>
                  <Select value={s.cup_type_id} onValueChange={(v) => updateSize(i, { cup_type_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {cupTypes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" size="icon" variant="ghost" onClick={() => removeSize(i)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          </div>

          <Button type="submit" className="w-full" disabled={busy}>Сохранить</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoryDialog({ onDone }: any) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Plus className="w-4 h-4 mr-1" />Категория</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Новая категория</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.from("categories").insert({ name });
          if (error) return toast.error(error.message);
          toast.success("Создана"); setName(""); setOpen(false); onDone();
        }} className="space-y-3">
          <div><Label>Название</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <Button type="submit" className="w-full">Создать</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
