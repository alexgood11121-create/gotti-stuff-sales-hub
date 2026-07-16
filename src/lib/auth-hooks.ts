import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

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
        if (!cancelled) setState({ user: null, role: null, profile: null, loading: false });
        return;
      }
      const [{ data: roleRows }, { data: prof }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("id,nickname,email,branch_id").eq("id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      const role = (roleRows?.[0]?.role as AppRole) ?? null;
      setState({ user, role, profile: prof as Profile | null, loading: false });
    }

    supabase.auth.getUser().then(({ data }) => load(data.user));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        load(session?.user ?? null);
      }
    });
    return () => {
      cancelled = true;
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
