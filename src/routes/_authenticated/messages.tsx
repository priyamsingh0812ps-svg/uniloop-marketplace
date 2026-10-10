import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
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
interface Convo {
  id: string; buyer_id: string; seller_id: string; created_at: string;
  item: { id: string; title: string; image_url: string | null } | null;
  buyer: { full_name: string; avatar_url: string | null } | null;
  seller: { full_name: string; avatar_url: string | null } | null;
  last?: Msg | undefined; unread: number;
}

const time = (iso: string) => {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { day: "numeric", month: "short" });
};

function Messages() {
  const { c } = Route.useSearch();
  const { user, refreshUnread } = useAuth();
  const nav = useNavigate({ from: "/messages" });
  const qc = useQueryClient();

  const convos = useQuery({
    queryKey: ["convos", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Convo[]> => {
      const { data, error } = await supabase.from("conversations")
        .select("*, item:listings(id,title,image_url), buyer:profiles!conversations_buyer_id_fkey(full_name,avatar_url), seller:profiles!conversations_seller_id_fkey(full_name,avatar_url)");
      if (error) throw new Error(error.message);
      const list = data as unknown as Convo[];
      if (!list.length) return [];
      const { data: msgs } = await supabase.from("messages").select("*").in("conversation_id", list.map((x) => x.id)).order("created_at", { ascending: false }).limit(500);
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
    const ch = supabase.channel(`convos-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => qc.invalidateQueries({ queryKey: ["convos"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const active = convos.data?.find((x) => x.id === c);

  return (
    <div className="flex h-dvh flex-col">
      <Header />
      <div className="mx-auto flex w-full max-w-6xl flex-1 overflow-hidden md:gap-4 md:p-4">
        <aside className={`${c ? "hidden md:flex" : "flex"} w-full flex-col overflow-hidden border-border bg-card md:w-80 md:rounded-2xl md:border`}>
          <h1 className="border-b border-border px-4 py-3 font-display text-xl font-bold">Messages</h1>
          <div className="flex-1 overflow-y-auto">
            {convos.isLoading ? <Loader /> : convos.error ? <p className="p-4 text-sm text-destructive">Couldn't load chats: {(convos.error as Error).message}</p> :
              !convos.data?.length ? <div className="p-4"><Empty title="No conversations yet" body="Open an item and tap “Chat with Seller”." action={<Link to="/browse" className="btn-primary px-4 py-2 text-sm">Browse</Link>} /></div> :
              convos.data.map((cv) => {
                const other = cv.buyer_id === user?.id ? cv.seller : cv.buyer;
                return (
                  <button key={cv.id} onClick={() => nav({ search: { c: cv.id } })} className={`flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left hover:bg-secondary ${cv.id === c ? "bg-secondary" : ""}`}>
                    <Avatar name={other?.full_name ?? "?"} url={other?.avatar_url} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold">{other?.full_name || "Student"}</p>
                        {cv.last && <span className="shrink-0 text-xs text-muted-foreground">{time(cv.last.created_at)}</span>}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{cv.item?.title ?? "Item removed"}</p>
                      <p className={`truncate text-sm ${cv.unread ? "font-semibold" : "text-muted-foreground"}`}>{cv.last?.content ?? "Say hi 👋"}</p>
                    </div>
                    {cv.unread > 0 && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                  </button>
                );
              })}
          </div>
        </aside>
        <section className={`${c ? "flex" : "hidden md:flex"} flex-1 flex-col overflow-hidden bg-card md:rounded-2xl md:border md:border-border`}>
          {c && active ? <Chat key={c} convo={active} onBack={() => nav({ search: {} })} onRead={() => { refreshUnread(); qc.invalidateQueries({ queryKey: ["convos"] }); }} />
            : c && convos.isLoading ? <Loader /> : c ? <div className="p-6"><Empty title="Conversation not found" /></div>
            : <div className="flex flex-1 items-center justify-center text-muted-foreground">Select a conversation</div>}
        </section>
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
    await supabase.from("messages").update({ read: true }).eq("conversation_id", convo.id).neq("sender_id", user!.id).eq("read", false);
    onRead();
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
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convo.id]);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

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

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-3 py-2.5">
        <button onClick={onBack} className="rounded-full p-1.5 hover:bg-secondary md:hidden" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
        <Avatar name={other?.full_name ?? "?"} url={other?.avatar_url} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{other?.full_name || "Student"}</p>
          {convo.item && <Link to="/item/$id" params={{ id: convo.item.id }} className="block truncate text-xs text-accent">{convo.item.title}</Link>}
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto bg-background p-4">
        {msgs === null ? <Loader /> : !msgs.length ? <p className="py-10 text-center text-sm text-muted-foreground">No messages yet — say hello!</p> :
          msgs.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-soft ${mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-card"}`}>
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={`mt-0.5 text-right text-[10px] ${mine ? "opacity-70" : "text-muted-foreground"}`}>{time(m.created_at)}</p>
                </div>
              </div>
            );
          })}
        <div ref={end} />
      </div>
      <div className="flex items-end gap-2 border-t border-border p-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="Type a message…"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          className="max-h-32 flex-1 resize-none rounded-2xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        <button onClick={send} disabled={sending || !text.trim()} className="btn-accent h-10 w-10 shrink-0 disabled:opacity-50" aria-label="Send"><Send className="h-4 w-4" /></button>
      </div>
    </>
  );
}
