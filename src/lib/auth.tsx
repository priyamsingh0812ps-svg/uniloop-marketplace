import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "./supabase";

export interface Profile {
  id: string;
  full_name: string;
  college: string;
  avatar_url: string | null;
  verified: boolean;
  verification_status: "none" | "pending" | "verified";
  id_card_url: string | null;
  created_at: string;
}

interface AuthCtx {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  unread: number;
  refreshProfile: () => Promise<void>;
  refreshUnread: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  const loadProfile = useCallback(async (u: User | null) => {
    if (!u) return setProfile(null);
    const { data } = await supabase.from("profiles").select("*").eq("id", u.id).maybeSingle();
    setProfile((data as Profile) ?? null);
  }, []);

  const refreshUnread = useCallback(async () => {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user.id;
    if (!uid) return setUnread(0);
    const { count } = await supabase.from("messages").select("id", { count: "exact", head: true }).eq("read", false).neq("sender_id", uid);
    setUnread(count ?? 0);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      await loadProfile(u);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;
      const u = session?.user ?? null;
      setUser(u);
      setTimeout(() => loadProfile(u), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  useEffect(() => {
    if (!user) { setUnread(0); return; }
    refreshUnread();
    const ch = supabase
      .channel(`inbox-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        const m = p.new as { sender_id: string; content: string };
        if (m.sender_id === user.id) return;
        refreshUnread();
        if (!window.location.pathname.startsWith("/messages")) toast("New message", { description: m.content.slice(0, 80) });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, () => refreshUnread())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refreshUnread]);

  const signOut = async () => { await supabase.auth.signOut(); setUser(null); setProfile(null); };

  return (
    <Ctx.Provider value={{ user, profile, loading, unread, refreshProfile: () => loadProfile(user), refreshUnread, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}

export function friendlyAuthError(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Wrong email or password.";
  if (m.includes("email not confirmed")) return "Please verify your email first — check your inbox for the link.";
  if (m.includes("already registered")) return "An account with this email already exists. Try logging in.";
  if (m.includes("rate limit")) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("password")) return msg;
  return msg || "Something went wrong. Please try again.";
}

export function safeRedirect(r: unknown) {
  return typeof r === "string" && r.startsWith("/") && !r.startsWith("//") ? r : "/browse";
}
