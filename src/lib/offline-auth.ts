import { supabase } from "@/integrations/supabase/client";
import { db, type CachedAuthUser } from "@/lib/db";
import type { User } from "@supabase/supabase-js";

type AppRole = "admin" | "cashier";

interface Profile {
  id: string;
  nickname: string | null;
  email: string | null;
  branch_id: string | null;
}

interface OfflineSession {
  user_id: string;
  email: string;
  nickname: string | null;
  role: AppRole;
  branch_id: string | null;
  started_at: string;
}

const OFFLINE_SESSION_KEY = "gotti-offline-session-v1";
const CASHIER_DOMAIN = "cashier.gotti.local";

let pendingOnlineCredentials: { email: string; password: string } | null = null;

export function cashierEmailFromNickname(nickname: string): string {
  return `${nickname.trim().toLowerCase().replace(/[^a-z0-9_]/g, "")}@${CASHIER_DOMAIN}`;
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function isNetworkLikeError(error: unknown): boolean {
  if (!isOnline()) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /failed to fetch|network|load failed|fetch/i.test(message);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function hashSecret(secret: string, salt: string): Promise<string> {
  const encoded = new TextEncoder().encode(`${salt}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return bytesToHex(new Uint8Array(digest));
}

function toUser(cached: CachedAuthUser): User {
  return {
    id: cached.id,
    email: cached.email,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: { nickname: cached.nickname },
    created_at: cached.updated_at,
  } as User;
}

function toProfile(cached: CachedAuthUser): Profile {
  return {
    id: cached.id,
    email: cached.email,
    nickname: cached.nickname,
    branch_id: cached.branch_id,
  };
}

function writeOfflineSession(cached: CachedAuthUser): void {
  if (typeof localStorage === "undefined") return;
  const session: OfflineSession = {
    user_id: cached.id,
    email: cached.email,
    nickname: cached.nickname,
    role: cached.role,
    branch_id: cached.branch_id,
    started_at: new Date().toISOString(),
  };
  localStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("gotti-offline-auth"));
}

function readOfflineSessionSync(): OfflineSession | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(OFFLINE_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<OfflineSession>;
    if (!parsed.user_id || !parsed.email || !parsed.role) return null;
    return {
      user_id: parsed.user_id,
      email: parsed.email,
      nickname: parsed.nickname ?? null,
      role: parsed.role,
      branch_id: parsed.branch_id ?? null,
      started_at: parsed.started_at ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function getOfflineAuthState(): Promise<{
  user: User;
  role: AppRole;
  profile: Profile;
} | null> {
  const session = readOfflineSessionSync();
  if (!session) return null;
  const cached = await db.authUsers.get(session.user_id);
  const source: CachedAuthUser = cached ?? {
    id: session.user_id,
    email: session.email,
    nickname: session.nickname,
    role: session.role,
    branch_id: session.branch_id,
    password_salt: "",
    password_hash: "",
    updated_at: session.started_at,
  };
  return { user: toUser(source), role: source.role, profile: toProfile(source) };
}

export async function cacheCurrentUserForOffline(secret: string, nickname?: string | null): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user?.email || !secret) return;

  const [{ data: roleRows }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("profiles").select("id,nickname,email,branch_id").eq("id", user.id).maybeSingle(),
  ]);
  const role = ((roleRows?.[0]?.role as AppRole | undefined) ?? "cashier") as AppRole;
  const salt = randomSalt();
  const password_hash = await hashSecret(secret, salt);
  const cached: CachedAuthUser = {
    id: user.id,
    email: user.email,
    nickname: nickname ?? profile?.nickname ?? user.user_metadata?.nickname ?? user.email.split("@")[0] ?? null,
    role,
    branch_id: profile?.branch_id ?? null,
    password_salt: salt,
    password_hash,
    updated_at: new Date().toISOString(),
  };
  await db.authUsers.put(cached);
  writeOfflineSession(cached);
}

export async function signInOffline(identifier: string, secret: string): Promise<CachedAuthUser> {
  const normalized = identifier.trim().toLowerCase();
  const email = normalized.includes("@") ? normalized : cashierEmailFromNickname(normalized);
  const users = await db.authUsers.toArray();
  const cached = users.find((u) =>
    u.email.toLowerCase() === email ||
    (u.nickname ?? "").trim().toLowerCase() === normalized,
  );
  if (!cached) {
    throw new Error("Для оффлайн-входа сначала войдите онлайн на этом устройстве");
  }
  const hash = await hashSecret(secret, cached.password_salt);
  if (hash !== cached.password_hash) throw new Error("Неверный логин или пароль/PIN");
  pendingOnlineCredentials = { email: cached.email, password: secret };
  writeOfflineSession(cached);
  return cached;
}

export async function ensureOnlineBackendSession(): Promise<boolean> {
  if (!isOnline()) return false;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) return true;
    if (!pendingOnlineCredentials) return false;
    const { error } = await supabase.auth.signInWithPassword(pendingOnlineCredentials);
    if (error) return false;
    pendingOnlineCredentials = null;
    return true;
  } catch {
    return false;
  }
}

export async function clearOfflineAuth(): Promise<void> {
  pendingOnlineCredentials = null;
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(OFFLINE_SESSION_KEY);
    window.dispatchEvent(new Event("gotti-offline-auth"));
  }
}