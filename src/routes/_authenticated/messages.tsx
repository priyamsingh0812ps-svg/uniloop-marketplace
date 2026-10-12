import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCheck, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { Header, Loader, Empty, Avatar } from "@/components/site";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: (s: Record<string, unknown>): { c?: string | undefined } => ({ c: typeof s.c === "string" ? s.c : undefined }),
  head: () => ({
    meta: [
      { title: "Messages — UniLoop" },
      { name: "description", content: "Chat with buyers and sellers on UniLoop." },
      { property: "og:title", content: "Messages — UniLoop" },
      { property: "og:description", content: "Your UniLoop conversations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Messages,
});

interface Msg { id: string; conversation_id: string; sender_id: string; content: string; created_at: string; read: boolean }
interface Person { full_name: string; avatar_url: string | null }
interface Convo {
  id: string; buyer_id: string; seller_id: string; created_at: string;
  item: { id: string; title: string; image_url: string | null } | null;
  buyer: Person | null;
  seller: Person | null;
  last?: Msg | undefined; unread: number;
}

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });
};
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const dayLabel = (iso: string) => {
  const d = new Date(iso), t = new Date();
  const y = new Date(); y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
};

function Messages() {
  const { c } = Route.useSearch();
  const { user, refreshUnread } = useAuth();
  const nav = useNavigate({ from: "/messages" });
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const convos = useQuery({
    queryKey: ["convos", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Convo[]> => {
      const { data, error } = await supabase.from("conversations")
        .select("*, item:listings(id,title,image_url), buyer:profiles!conversations_buyer_id_fkey(full_name,avatar_url), seller:profiles!conversations_seller_id_fkey(full_name,avatar_url)");
      if (error) throw new Error(error.message);
      const list = data as unknown as Convo[];
      if (!list.length) return [];
      const { data: msgs } = await supabase.from("messages").select("*").in("conversation_id", list.map((x) => x.id)).order("created_at", { ascending: false }).limit(1000);
      for (const cv of list) {
        const mine = (msgs ?? []).filter((m) => m.conversation_id === cv.id) as Msg[];
        cv.last = mine[0];
        cv.unread = mine.filter((m) => !m.read && m.sender_id !== user!.id).length;
      }
      return list.sort((a, b) => (b.last?.created_at ?? b.created_at).localeCompare(a.last?.created_at ?? a.created_at));
    },
  });

  useEffect(() => {
    if (!user) return;
    const refresh = () => qc.invalidateQueries({ queryKey: ["convos"] });
    const ch = supabase.channel(`convos-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const other = (cv: Convo) => (cv.buyer_id === user?.id ? cv.seller : cv.buyer);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return convos.data ?? [];
    return (convos.data ?? []).filter((cv) => `${other(cv)?.full_name ?? ""} ${cv.item?.title ?? ""} ${cv.last?.content ?? ""}`.toLowerCase().includes(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convos.data, q, user?.id]);
  const active = convos.data?.find((x) => x.id === c);

  return (
    <div className="flex h-dvh flex-col bg-background">
      <Header />
      <div className="mx-auto flex w-full max-w-6xl flex-1 overflow-hidden md:p-6">
        <div className="flex w-full overflow-hidden bg-card md:rounded-3xl md:border md:border-border md:shadow-soft">
          <aside className={`${c ? "hidden md:flex" : "flex"} w-full flex-col overflow-hidden md:w-96 md:border-r md:border-border`}>
            <div className="border-b border-border p-4">
              <h1 className="font-display text-2xl font-bold">Messages</h1>
              <label className="mt-3 flex items-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats…" className="w-full bg-transparent focus:outline-none" />
              </label>
            </div>
            <div className="flex-1 overflow-y-auto">
              {convos.isLoading ? <Loader /> : convos.error ? <p className="p-4 text-sm text-destructive">Couldn't load chats: {(convos.error as Error).message}</p> :
                !convos.data?.length ? <div className="p-4"><Empty title="No conversations yet" body="Open an item and tap “Chat with seller”." action={<Link to="/browse" className="btn-primary px-4 py-2 text-sm">Browse</Link>} /></div> :
                !shown.length ? <p className="p-6 text-center text-sm text-muted-foreground">No chats match “{q}”.</p> :
                shown.map((cv) => {
                  const o = other(cv);
                  const mine = cv.last?.sender_id === user?.id;
                  return (
                    <button key={cv.id} onClick={() => nav({ search: { c: cv.id } })}
                      className={`flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left transition hover:bg-secondary ${cv.id === c ? "bg-secondary" : ""}`}>
                      <Avatar name={o?.full_name ?? "?"} url={o?.avatar_url} size={12} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-semibold">{o?.full_name || "Student"}</p>
                          <span className="shrink-0 text-xs text-muted-foreground">{ago(cv.last?.created_at ?? cv.created_at)}</span>
                        </div>
                        <p className="truncate text-xs text-accent">{cv.item?.title ?? "Item removed"}</p>
                        <div className="flex items-center justify-between gap-2">
                          <p className={`truncate text-sm ${cv.unread ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                            {cv.last ? `${mine ? "You: " : ""}${cv.last.content}` : "Say hi 👋"}
                          </p>
                          {cv.unread > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-accent-foreground">{cv.unread}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </aside>
          <section className={`${c ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col overflow-hidden`}>
            {c && active ? <Chat key={c} convo={active} onBack={() => nav({ search: {} })} onRead={() => { refreshUnread(); qc.invalidateQueries({ queryKey: ["convos"] }); }} />
              : c && convos.isLoading ? <Loader /> : c ? <div className="p-6"><Empty title="Conversation not found" body="It may have been removed, or it isn't yours." /></div>
              : <div className="flex flex-1 items-center justify-center text-muted-foreground">Select a conversation</div>}
          </section>
        </div>
      </div>
    </div>
  );
}

function Chat({ convo, onBack, onRead }: { convo: Convo; onBack: () => void; onRead: () => void }) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const other = convo.buyer_id === user?.id ? convo.seller : convo.buyer;

  const markRead = async () => {
    const { error } = await supabase.from("messages").update({ read: true }).eq("conversation_id", convo.id).neq("sender_id", user!.id).eq("read", false);
    if (!error) {
      setMsgs((prev) => prev?.map((m) => (m.sender_id !== user!.id ? { ...m, read: true } : m)) ?? prev);
      onRead();
    }
  };

  useEffect(() => {
    supabase.from("messages").select("*").eq("conversation_id", convo.id).order("created_at").then(({ data, error }) => {
      if (error) toast.error("Couldn't load messages");
      setMsgs((data as Msg[]) ?? []);
      markRead();
    });
    const ch = supabase.channel(`chat-${convo.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${convo.id}` }, (p) => {
        const m = p.new as Msg;
        setMsgs((prev) => (prev?.some((x) => x.id === m.id) ? prev : [...(prev ?? []), m]));
        if (m.sender_id !== user!.id) markRead();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${convo.id}` }, (p) => {
        const m = p.new as Msg;
        setMsgs((prev) => prev?.map((x) => (x.id === m.id ? { ...x, read: m.read } : x)) ?? prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convo.id]);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs?.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const { data, error } = await supabase.from("messages").insert({ conversation_id: convo.id, sender_id: user!.id, content: body.slice(0, 2000) }).select().single();
    setSending(false);
    if (error) return toast.error("Message not sent: " + error.message);
    setText("");
    setMsgs((prev) => (prev?.some((x) => x.id === data.id) ? prev : [...(prev ?? []), data as Msg]));
  };

  const lastMineId = [...(msgs ?? [])].reverse().find((m) => m.sender_id === user?.id)?.id;

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={onBack} className="rounded-full p-1.5 hover:bg-secondary md:hidden" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
        <Avatar name={other?.full_name ?? "?"} url={other?.avatar_url} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{other?.full_name || "Student"}</p>
          {convo.item && <Link to="/item/$id" params={{ id: convo.item.id }} className="block truncate text-xs text-accent">{convo.item.title}</Link>}
        </div>
      </div>
      <div className="flex-1 space-y-1.5 overflow-y-auto bg-background p-4">
        {msgs === null ? <Loader /> : !msgs.length ? <p className="py-10 text-center text-sm text-muted-foreground">No messages yet — say hello!</p> :
          msgs.map((m, i) => {
            const mine = m.sender_id === user?.id;
            const newDay = i === 0 || new Date(msgs[i - 1]!.created_at).toDateString() !== new Date(m.created_at).toDateString();
            return (
              <div key={m.id}>
                {newDay && <div className="my-3 flex justify-center"><span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">{dayLabel(m.created_at)}</span></div>}
                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-2 text-sm shadow-soft ${mine ? "rounded-br-sm bg-accent text-accent-foreground" : "rounded-bl-sm bg-card"}`}>
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  </div>
                </div>
                <p className={`mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground ${mine ? "justify-end" : "justify-start"}`}>
                  {clock(m.created_at)}
                  {mine && (m.read ? <CheckCheck className="h-3.5 w-3.5 text-accent" aria-label="Seen" /> : <Check className="h-3.5 w-3.5" aria-label="Sent" />)}
                  {mine && m.id === lastMineId && <span>{m.read ? "Seen" : "Sent"}</span>}
                </p>
              </div>
            );
          })}
        <div ref={end} />
      </div>
      <div className="flex items-end gap-2 border-t border-border p-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="Message…" maxLength={2000}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          className="max-h-32 flex-1 resize-none rounded-full border border-input bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        <button onClick={send} disabled={sending || !text.trim()} className="btn-accent h-10 w-10 shrink-0 disabled:opacity-50" aria-label="Send"><Send className="h-4 w-4" /></button>
      </div>
    </>
  );
}
