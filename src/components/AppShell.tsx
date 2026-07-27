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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { startShift, endShift, getMyOpenShift, getExpectedCash } from "@/lib/shifts.functions";
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
      .channel("notif")
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
    <div className="min-h-screen flex bg-background text-foreground">
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
              onToggle={async () => {
                setShiftBusy(true);
                try {
                  if (openShift) {
                    await endShift();
                    toast.success("Смена закрыта");
                  } else {
                    await startShift({ data: { branch_id: profile?.branch_id ?? null } });
                    toast.success("Смена открыта");
                  }
                  await loadShift();
                } catch (e: any) {
                  toast.error(e.message ?? "Ошибка");
                } finally {
                  setShiftBusy(false);
                }
              }}
            />
          )}
          <Button
            variant="ghost"
            className="w-full justify-start text-sm"
            onClick={async () => {
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
  );
}

function ShiftControl({
  openShift, busy, tick, onToggle,
}: {
  openShift: { id: string; started_at: string } | null;
  busy: boolean;
  tick: number;
  onToggle: () => void;
}) {
  void tick;
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
        onClick={onToggle}
        disabled={busy}
      >
        {openShift ? (<><Square className="w-3 h-3 mr-1" />Закрыть смену</>) : (<><Play className="w-3 h-3 mr-1" />Открыть смену</>)}
      </Button>
    </div>
  );
}
