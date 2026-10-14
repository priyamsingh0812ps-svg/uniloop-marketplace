import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Rpc = (fn: string, args?: object) => Promise<{ data: unknown; error: unknown }>;
const rpc: Rpc = (fn, args) => (supabase as unknown as { rpc: Rpc }).rpc(fn, args);

/** Tells the database "I'm online" every 45 seconds while the tab is open and visible. */
export function usePresenceHeartbeat(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const ping = () => {
      if (document.visibilityState === "visible") void rpc("touch_presence");
    };
    ping();
    const id = setInterval(ping, 45_000);
    document.addEventListener("visibilitychange", ping);
    window.addEventListener("focus", ping);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", ping);
      window.removeEventListener("focus", ping);
    };
  }, [enabled]);
}

const clock = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function formatStatus(secondsAgo: number | null | undefined): { online: boolean; text: string } {
  if (secondsAgo === null || secondsAgo === undefined) return { online: false, text: "" };
  if (secondsAgo < 100) return { online: true, text: "online" };
  const d = new Date(Date.now() - secondsAgo * 1000);
  const t = new Date();
  const y = new Date();
  y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return { online: false, text: `last seen today at ${clock(d)}` };
  if (d.toDateString() === y.toDateString()) return { online: false, text: `last seen yesterday at ${clock(d)}` };
  return { online: false, text: `last seen ${d.toLocaleDateString([], { day: "numeric", month: "short" })} at ${clock(d)}` };
}

/** Returns the other person's online / last seen status, refreshed every 30 seconds. */
export function useLastSeen(otherUserId: string | undefined) {
  const [secs, setSecs] = useState<number | null>(null);
  useEffect(() => {
    if (!otherUserId) return;
    let alive = true;
    const load = async () => {
      const { data, error } = await rpc("get_presence", { p_user: otherUserId });
      if (!alive || error) return;
      setSecs(typeof data === "number" ? data : null);
    };
    void load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [otherUserId]);
  return formatStatus(secs);
}
