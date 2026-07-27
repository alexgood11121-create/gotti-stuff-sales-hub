// Точка входа для Capacitor APK. Строим SPA полностью на клиенте — без TanStack Start SSR,
// без серверных функций (они подменены client-шимами через vite.capacitor.config.ts).
import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRouter,
  createRootRoute,
  createRoute,
  createMemoryHistory,
  RouterProvider,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

// Импортируем страницы — берём компонент из .options
import { Route as AuthFileRoute } from "@/routes/auth";
import { Route as PosFileRoute } from "@/routes/_authenticated/pos";
import { Route as ReceiptsFileRoute } from "@/routes/_authenticated/receipts";
import { Route as IncomeFileRoute } from "@/routes/_authenticated/income";
import { Route as ExpenseFileRoute } from "@/routes/_authenticated/expense";
import { Route as SettingsFileRoute } from "@/routes/_authenticated/settings";
import { Route as ProductsFileRoute } from "@/routes/_authenticated/products";

const queryClient = new QueryClient();

const rootRoute = createRootRoute({
  component: () => (
    <>
      <AppShell>
        <Outlet />
      </AppShell>
      <Toaster />
    </>
  ),
});

// Гейт авторизации: при заходе на защищённую страницу проверяем сессию.
async function requireAuth({ location }: { location: { pathname: string } }) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    throw redirect({
      to: "/auth",
      search: { next: location.pathname === "/auth" ? undefined : location.pathname },
    });
  }
}

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth",
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: AuthFileRoute.options.component!,
});

function mkAuthed(path: string, comp: any) {
  return createRoute({
    getParentRoute: () => rootRoute,
    path,
    beforeLoad: requireAuth,
    component: comp,
  });
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
    throw redirect({ to: "/pos" });
  },
  component: () => null,
});

const posRoute = mkAuthed("/pos", PosFileRoute.options.component!);
const receiptsRoute = mkAuthed("/receipts", ReceiptsFileRoute.options.component!);
const incomeRoute = mkAuthed("/income", IncomeFileRoute.options.component!);
const expenseRoute = mkAuthed("/expense", ExpenseFileRoute.options.component!);
const settingsRoute = mkAuthed("/settings", SettingsFileRoute.options.component!);
const productsRoute = mkAuthed("/products", ProductsFileRoute.options.component!);

// Заглушка для несуществующих ссылок (админские страницы), чтобы не падал 404
const NotAvailable = () => (
  <div className="p-8 text-center text-muted-foreground">
    Этот раздел доступен только в веб-кабинете.
    <br />
    <a href="https://gotti-stuff-sales-hub.lovable.app" className="text-primary underline">
      Открыть веб-кабинет
    </a>
  </div>
);
const adminRoute = mkAuthed("/admin", NotAvailable);
const adminBranchesRoute = mkAuthed("/admin/branches", NotAvailable);
const adminCashiersRoute = mkAuthed("/admin/cashiers", NotAvailable);
const adminShiftsRoute = mkAuthed("/admin/shifts", NotAvailable);
const reportsRoute = mkAuthed("/reports", NotAvailable);

const routeTree = rootRoute.addChildren([
  indexRoute,
  authRoute,
  posRoute,
  receiptsRoute,
  incomeRoute,
  expenseRoute,
  settingsRoute,
  productsRoute,
  adminRoute,
  adminBranchesRoute,
  adminCashiersRoute,
  adminShiftsRoute,
  reportsRoute,
]);

const router = createRouter({
  routeTree,
  context: { queryClient },
  history: createMemoryHistory({ initialEntries: ["/"] }),
  defaultPreload: false,
  defaultPreloadStaleTime: 0,
});

// НЕ регистрируем этот роутер как глобальный тип — иначе перекроет routeTree.gen.ts
// и весь основной проект перестанет типизироваться.

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router as any} />
    </QueryClientProvider>
  </React.StrictMode>,
);
