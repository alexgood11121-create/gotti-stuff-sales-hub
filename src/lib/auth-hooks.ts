import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { getOfflineAuthState } from "@/lib/offline-auth";

export type AppRole = "admin" | "cashier";

export interface Profile {
  id: string;
  nickname: string | null;
  email: string | null;
  branch_id: string | null;
}

export interface AuthState {
  user: User | null;
  role: AppRole | null;
  profile: Profile | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    profile: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function load(user: User | null) {
      if (!user) {
        const offline = await getOfflineAuthState();
        if (!cancelled) {
          setState(offline ? { ...offline, loading: false } : { user: null, role: null, profile: null, loading: false });
        }
        return;
      }
      let roleRows: { role: AppRole }[] | null = null;
      let prof: Profile | null = null;
      try {
        const [rolesResult, profileResult] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", user.id),
          supabase.from("profiles").select("id,nickname,email,branch_id").eq("id", user.id).maybeSingle(),
        ]);
        roleRows = (rolesResult.data as { role: AppRole }[] | null) ?? null;
        prof = (profileResult.data as Profile | null) ?? null;
      } catch {
        const offline = await getOfflineAuthState();
        if (!cancelled) {
          setState(offline ? { ...offline, loading: false } : { user, role: null, profile: null, loading: false });
        }
        return;
      }
      if (cancelled) return;
      const role = (roleRows?.[0]?.role as AppRole) ?? null;
      setState({ user, role, profile: prof, loading: false });
    }

    supabase.auth.getSession().then(({ data }) => load(data.session?.user ?? null)).catch(() => load(null));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        load(session?.user ?? null);
      }
    });
    const reloadOffline = () => { void load(null); };
    window.addEventListener("gotti-offline-auth", reloadOffline);
    return () => {
      cancelled = true;
      window.removeEventListener("gotti-offline-auth", reloadOffline);
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}
