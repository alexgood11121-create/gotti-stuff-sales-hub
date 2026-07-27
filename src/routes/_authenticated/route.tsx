import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { getOfflineAuthState } from "@/lib/offline-auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) return { user: data.session.user };
    const offline = await getOfflineAuthState();
    if (!offline) throw redirect({ to: "/auth" });
    return { user: offline.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
