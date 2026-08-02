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

// ── Глобальный кэш авторизации ────────────────────────────────────────────
// Раньше каждая страница при монтировании заново дёргала сеть (user_roles +
// profiles). Офлайн это давало «лаги» на каждом переходе. Теперь состояние
// хранится в модуле: переход между страницами берёт его мгновенно.

let cachedState: AuthState = { user: null, role: null, profile: null, loading: true };
let initialized = false;
const subscribers = new Set<(s: AuthState) => void>();

function emit(next: AuthState) {
  cachedState = next;
  subscribers.forEach((fn) => fn(next));
}

async function loadAuth(user: User | null) {
  if (!user) {
    const offline = await getOfflineAuthState();
    emit(offline ? { ...offline, loading: false } : { user: null, role: null, profile: null, loading: false });
    return;
  }

  // Сначала мгновенно отдаём то, что есть локально, чтобы UI не ждал сеть.
  const offlineFirst = await getOfflineAuthState();
  if (offlineFirst && offlineFirst.user.id === user.id) {
    emit({ ...offlineFirst, user, loading: false });
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    if (!offlineFirst) emit({ user, role: null, profile: null, loading: false });
    return;
  }

  try {
    const [rolesResult, profileResult] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("profiles").select("id,nickname,email,branch_id").eq("id", user.id).maybeSingle(),
    ]);
    const role = ((rolesResult.data as { role: AppRole }[] | null)?.[0]?.role as AppRole) ?? cachedState.role ?? null;
    const prof = (profileResult.data as Profile | null) ?? cachedState.profile ?? null;
    emit({ user, role, profile: prof, loading: false });
  } catch {
    if (!offlineFirst) emit({ user, role: cachedState.role, profile: cachedState.profile, loading: false });
  }
}

function initAuth() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  supabase.auth
    .getSession()
    .then(({ data }) => loadAuth(data.session?.user ?? null))
    .catch(() => loadAuth(null));

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
      void loadAuth(session?.user ?? null);
    }
  });
  window.addEventListener("gotti-offline-auth", () => {
    void loadAuth(cachedState.user);
  });
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(cachedState);

  useEffect(() => {
    initAuth();
    subscribers.add(setState);
    setState(cachedState);
    return () => {
      subscribers.delete(setState);
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
