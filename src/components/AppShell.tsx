import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useOnline } from "@/lib/auth-hooks";
import { startAutoSync } from "@/lib/sync";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ShoppingBasket,
  Receipt,
  Package,
  BarChart3,
  Settings,
  Store,
  Users,
  LogOut,
  Wifi,
  WifiOff,
  ArrowDownCircle,
  ArrowUpCircle,
  LayoutDashboard,
  Clock,
  Play,
  Square,
  CupSoda,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { startShift, endShift, getMyOpenShift, getExpectedCash } from "@/lib/shifts.functions";
import { clearOfflineAuth } from "@/lib/offline-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Item {
  to: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const items: Item[] = [
  { to: "/pos", label: "Продажи", icon: <ShoppingBasket className="w-5 h-5" /> },
  { to: "/receipts", label: "Чеки", icon: <Receipt className="w-5 h-5" /> },
  { to: "/income", label: "Приход", icon: <ArrowDownCircle className="w-5 h-5" /> },
  { to: "/expense", label: "Расход", icon: <ArrowUpCircle className="w-5 h-5" /> },
  { to: "/products", label: "Товары", icon: <Package className="w-5 h-5" />, adminOnly: true },
  { to: "/cups", label: "Стаканы", icon: <CupSoda className="w-5 h-5" /> },
  { to: "/reports", label: "Отчёты", icon: <BarChart3 className="w-5 h-5" /> },
  { to: "/admin", label: "Дашборд", icon: <LayoutDashboard className="w-5 h-5" />, adminOnly: true },
  { to: "/admin/branches", label: "Филиалы", icon: <Store className="w-5 h-5" />, adminOnly: true },
  { to: "/admin/cashiers", label: "Кассиры", icon: <Users className="w-5 h-5" />, adminOnly: true },
  { to: "/admin/shifts", label: "Смены", icon: <Clock className="w-5 h-5" />, adminOnly: true },
  { to: "/settings", label: "Настройки", icon: <Settings className="w-5 h-5" /> },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, role, profile, loading } = useAuth();
  const online = useOnline();
  const navigate = useNavigate();
  const router = useRouterState();
  const [unread, setUnread] = useState(0);
  const [openShift, setOpenShift] = useState<{ id: string; started_at: string } | null>(null);
  const [shiftBusy, setShiftBusy] = useState(false);
  const [tick, setTick] = useState(0);

  const pendingCount = useLiveQuery(
    () => db.pendingSales.where("synced").equals(0).count(),
    [],
    0,
  );

  useEffect(() => {
    return startAutoSync();
  }, []);

  const loadShift = useCallback(async () => {
    if (role !== "cashier") { setOpenShift(null); return; }
    try {
      const s = await getMyOpenShift();
      setOpenShift(s ? { id: s.id, started_at: s.started_at } : null);
    } catch { /* ignore */ }
  }, [role]);

  useEffect(() => { loadShift(); }, [loadShift]);

  useEffect(() => {
    if (!openShift) return;
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, [openShift]);

  useEffect(() => {
    if (role !== "admin") return;
    let cancel = false;
    const load = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("is_read", false);
      if (!cancel) setUnread(count ?? 0);
    };
    load();
    const ch = supabase
      .channel(`notif-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, load)
      .subscribe();
    return () => {
      cancel = true;
      supabase.removeChannel(ch);
    };
  }, [role]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Загрузка...
      </div>
    );
  }

  if (!user) return <>{children}</>;

  const currentPath = router.location.pathname;
  const visibleItems = items.filter((i) => !i.adminOnly || role === "admin");

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <div
        className={cn(
          "w-full flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-semibold",
          online
            ? "bg-primary/15 text-primary"
            : "bg-destructive text-destructive-foreground",
        )}
      >
        {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
        <span>{online ? "Онлайн — есть интернет" : "Офлайн — нет интернета"}</span>
        {(pendingCount ?? 0) > 0 && (
          <span className="ml-2 opacity-80">· ожидает синхронизации: {pendingCount}</span>
        )}
      </div>
      <div className="flex flex-1 min-h-0">
      <aside className="w-64 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">
              G
            </div>
            <div>
              <div className="font-bold text-base leading-tight">Gotti Stuff</div>
              <div className="text-xs text-muted-foreground">
                {role === "admin" ? "Владелец" : "Кассир"}
              </div>
            </div>
          </div>
          <div className="mt-3 text-sm">
            <div className="font-medium truncate">{profile?.nickname ?? profile?.email}</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {visibleItems.map((it) => {
            const active = currentPath === it.to || currentPath.startsWith(it.to + "/");
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "flex items-center gap-3 px-5 py-3 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-primary border-l-4 border-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent border-l-4 border-transparent",
                )}
              >
                {it.icon}
                <span>{it.label}</span>
                {it.to === "/admin" && unread > 0 && (
                  <span className="ml-auto bg-destructive text-destructive-foreground text-xs rounded-full px-2 py-0.5">
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-3 border-t border-sidebar-border space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className={cn("flex items-center gap-1", online ? "text-primary" : "text-destructive")}>
              {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {online ? "Онлайн" : "Офлайн"}
            </span>
            {(pendingCount ?? 0) > 0 && (
              <span className="text-yellow-500">Ожидает: {pendingCount}</span>
            )}
          </div>
          {role === "cashier" && (
            <ShiftControl
              openShift={openShift}
              busy={shiftBusy}
              tick={tick}
              branchId={profile?.branch_id ?? null}
              onOpened={async () => { await loadShift(); }}
              onClosed={async () => { await loadShift(); }}
              setBusy={setShiftBusy}
            />
          )}
          <Button
            variant="ghost"
            className="w-full justify-start text-sm"
            onClick={async () => {
              await clearOfflineAuth();
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Выйти
          </Button>
          <div className="text-[10px] text-muted-foreground text-center">v.1.0</div>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}

function ShiftControl({
  openShift, busy, tick, branchId, onOpened, onClosed, setBusy,
}: {
  openShift: { id: string; started_at: string } | null;
  busy: boolean;
  tick: number;
  branchId: string | null;
  onOpened: () => Promise<void>;
  onClosed: () => Promise<void>;
  setBusy: (v: boolean) => void;
}) {
  void tick;
  const [openDlg, setOpenDlg] = useState(false);
  const [closeDlg, setCloseDlg] = useState(false);
  const [opening, setOpening] = useState("");
  const [actual, setActual] = useState("");
  const [expected, setExpected] = useState<{ expected: number; opening: number; cashSales: number } | null>(null);

  const mins = openShift
    ? Math.max(0, Math.floor((Date.now() - new Date(openShift.started_at).getTime()) / 60000))
    : 0;
  const h = Math.floor(mins / 60);
  const m = mins % 60;

  return (
    <div className="rounded-md border border-sidebar-border p-2 space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Смена</span>
        {openShift ? (
          <span className="font-mono text-primary">{h}ч {m}м</span>
        ) : (
          <span className="text-muted-foreground">закрыта</span>
        )}
      </div>
      <Button
        size="sm"
        variant={openShift ? "destructive" : "default"}
        className="w-full h-8 text-xs"
        disabled={busy}
        onClick={async () => {
          if (openShift) {
            try {
              const e = await getExpectedCash();
              setExpected(e);
              setActual(String(e.expected));
            } catch { setExpected(null); setActual(""); }
            setCloseDlg(true);
          } else {
            setOpening("0");
            setOpenDlg(true);
          }
        }}
      >
        {openShift ? (<><Square className="w-3 h-3 mr-1" />Закрыть смену</>) : (<><Play className="w-3 h-3 mr-1" />Открыть смену</>)}
      </Button>

      <Dialog open={openDlg} onOpenChange={setOpenDlg}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Открытие смены</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Остаток наличных в кассе</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
                autoFocus
                className="h-12 text-lg"
              />
            </div>
            <Button
              className="w-full h-11"
              disabled={busy}
              onClick={async () => {
                const v = Number(opening);
                if (Number.isNaN(v) || v < 0) { toast.error("Введите сумму"); return; }
                setBusy(true);
                try {
                  await startShift({ data: { branch_id: branchId, opening_cash: v } });
                  toast.success("Смена открыта");
                  setOpenDlg(false);
                  await onOpened();
                } catch (e: any) {
                  toast.error(e.message ?? "Ошибка");
                } finally { setBusy(false); }
              }}
            >Открыть смену</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={closeDlg} onOpenChange={setCloseDlg}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Закрытие смены</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            {expected && (
              <div className="space-y-1 rounded-md bg-muted/40 p-3">
                <div className="flex justify-between"><span>Остаток при открытии</span><span>{expected.opening.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Продажи наличными</span><span>{expected.cashSales.toLocaleString()}</span></div>
                <div className="flex justify-between font-semibold border-t border-border pt-1"><span>Ожидается в кассе</span><span>{expected.expected.toLocaleString()}</span></div>
              </div>
            )}
            <div>
              <Label>Фактически в кассе</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                autoFocus
                className="h-12 text-lg"
              />
            </div>
            {expected && actual !== "" && (
              <div className={cn(
                "text-sm text-center",
                Number(actual) - expected.expected === 0 ? "text-primary"
                  : Number(actual) - expected.expected < 0 ? "text-destructive" : "text-yellow-500",
              )}>
                Расхождение: {(Number(actual) - expected.expected).toLocaleString()}
              </div>
            )}
            <Button
              variant="destructive"
              className="w-full h-11"
              disabled={busy}
              onClick={async () => {
                const v = Number(actual);
                if (Number.isNaN(v) || v < 0) { toast.error("Введите сумму"); return; }
                setBusy(true);
                try {
                  await endShift({ data: { closing_cash_actual: v } });
                  toast.success("Смена закрыта");
                  setCloseDlg(false);
                  await onClosed();
                } catch (e: any) {
                  toast.error(e.message ?? "Ошибка");
                } finally { setBusy(false); }
              }}
            >Закрыть смену</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
