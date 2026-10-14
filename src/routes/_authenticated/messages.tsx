import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCheck, Image as ImageIcon, Mic, Phone, Search, Send, Smile, Trash2, Video, X } from "lucide-react";
import { toast } from "sonner";
import { Header, Loader, Empty, Avatar } from "@/components/site";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { usePresenceHeartbeat, useLastSeen } from "@/hooks/usePresence";

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

interface Msg {
  id: string; conversation_id: string; sender_id: string;
  content: string | null; created_at: string; read: boolean;
  message_type?: "text" | "image" | "audio" | null;
  media_url?: string | null;
  deleted_at?: string | null;
}
interface Person { full_name: string; avatar_url: string | null }
interface Convo {
  id: string; buyer_id: string; seller_id: string; created_at: string;
  item: { id: string; title: string; image_url: string | null } | null;
  buyer: Person | null;
  seller: Person | null;
  last?: Msg | undefined; unread: number;
}

const EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎", "🤔", "😅", "😢", "😭",
  "😡", "🥺", "😴", "🤝", "👍", "👎", "👏", "🙏", "🙌", "💪", "👌", "✌️",
  "🔥", "✨", "🎉", "💯", "❤️", "💔", "👀", "🤞", "📚", "🎒", "🚲", "💻",
  "📱", "🎧", "💰", "✅", "❌", "⏰", "📍", "🍕", "☕", "🥳", "😇", "🙈",
];

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_RECORD_SECONDS = 120;

const CALL_RE = /^(📞 Voice|📹 Video) call\n(https:\/\/meet\.jit\.si\/\S+)$/;
const parseCall = (content?: string | null) => {
  const m = content ? CALL_RE.exec(content) : null;
  return m ? { kind: m[1]!.includes("Video") ? "video" : "voice", url: m[2]! } : null;
};

const preview = (m?: Msg) => {
  if (!m) return "";
  if (m.deleted_at) return "🚫 This message was deleted";
  const call = m.message_type === "text" || !m.message_type ? parseCall(m.content) : null;
  if (call) return call.kind === "video" ? "📹 Video call" : "📞 Voice call";
  if (m.message_type === "image") return m.content ? `📷 ${m.content}` : "📷 Photo";
  if (m.message_type === "audio") return "🎤 Voice message";
  return m.content ?? "";
};

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
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function Messages() {
  const { c } = Route.useSearch();
  const { user, refreshUnread } = useAuth();
  const nav = useNavigate({ from: "/messages" });
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  usePresenceHeartbeat(!!user);

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
    return (convos.data ?? []).filter((cv) => `${other(cv)?.full_name ?? ""} ${cv.item?.title ?? ""} ${preview(cv.last)}`.toLowerCase().includes(t));
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
                            {cv.last ? `${mine ? "You: " : ""}${preview(cv.last)}` : "Say hi 👋"}
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
  const [showEmoji, setShowEmoji] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ file: File; url: string } | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const cancelled = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const other = convo.buyer_id === user?.id ? convo.seller : convo.buyer;
  const otherId = convo.buyer_id === user?.id ? convo.seller_id : convo.buyer_id;
  const status = useLastSeen(otherId);
  const [typing, setTyping] = useState(false);
  const typingCh = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingOff = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  useEffect(() => {
    const ch = supabase.channel(`typing-${convo.id}`)
      .on("broadcast", { event: "typing" }, (p) => {
        if ((p.payload as { user?: string } | undefined)?.user === user!.id) return;
        setTyping(true);
        if (typingOff.current) clearTimeout(typingOff.current);
        typingOff.current = setTimeout(() => setTyping(false), 3000);
      })
      .subscribe();
    typingCh.current = ch;
    return () => {
      if (typingOff.current) clearTimeout(typingOff.current);
      supabase.removeChannel(ch);
      typingCh.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convo.id]);

  const notifyTyping = () => {
    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return;
    lastTypingSent.current = now;
    void typingCh.current?.send({ type: "broadcast", event: "typing", payload: { user: user!.id } });
  };

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
        setMsgs((prev) => prev?.map((x) => (x.id === m.id ? { ...x, read: m.read, deleted_at: m.deleted_at ?? null, content: m.content, media_url: m.media_url } : x)) ?? prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convo.id]);

  // Stop the microphone and timer if the chat is closed while recording
  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
      cancelled.current = true;
      if (recorder.current && recorder.current.state !== "inactive") {
        recorder.current.stream.getTracks().forEach((t) => t.stop());
        recorder.current.stop();
      }
    };
  }, []);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs?.length]);

  const insertRow = async (row: { content: string | null; message_type: "text" | "image" | "audio"; media_url: string | null }) => {
    const { data, error } = await supabase.from("messages").insert({ conversation_id: convo.id, sender_id: user!.id, ...row }).select().single();
    if (error) throw new Error(error.message);
    setMsgs((prev) => (prev?.some((x) => x.id === data.id) ? prev : [...(prev ?? []), data as Msg]));
  };

  const upload = async (blob: Blob, ext: string, contentType: string) => {
    const path = `${user!.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("chat-media").upload(path, blob, { contentType, upsert: false });
    if (error) throw new Error(error.message);
    return supabase.storage.from("chat-media").getPublicUrl(path).data.publicUrl;
  };

  const send = async () => {
    if (sending) return;
    const body = text.trim();
    if (!body && !pendingImage) return;
    setSending(true);
    try {
      if (pendingImage) {
        const f = pendingImage.file;
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
        const url = await upload(f, ext, f.type || "image/jpeg");
        await insertRow({ content: body ? body.slice(0, 2000) : null, message_type: "image", media_url: url });
        URL.revokeObjectURL(pendingImage.url);
        setPendingImage(null);
      } else {
        await insertRow({ content: body.slice(0, 2000), message_type: "text", media_url: null });
      }
      setText("");
      setShowEmoji(false);
    } catch (e) {
      toast.error("Message not sent: " + (e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const pickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (f.size > MAX_BYTES) return toast.error("Photo is too big. Maximum size is 5 MB");
    if (pendingImage) URL.revokeObjectURL(pendingImage.url);
    setPendingImage({ file: f, url: URL.createObjectURL(f) });
    setShowEmoji(false);
  };

  const clearImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.url);
    setPendingImage(null);
  };

  const stopTimer = () => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
  };

  const startRecording = async () => {
    if (recording || sending) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return toast.error("Voice recording is not supported in this browser");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t));
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunks.current = [];
      cancelled.current = false;
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunks.current.push(ev.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        stopTimer();
        setRecording(false);
        if (cancelled.current) return;
        const type = (rec.mimeType || mime || "audio/webm").split(";")[0]!;
        const blob = new Blob(chunks.current, { type });
        if (blob.size < 1000) return toast.error("Recording was too short");
        if (blob.size > MAX_BYTES) return toast.error("Voice message is too big");
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        setSending(true);
        try {
          const url = await upload(blob, ext, type);
          await insertRow({ content: null, message_type: "audio", media_url: url });
        } catch (e) {
          toast.error("Voice message not sent: " + (e as Error).message);
        } finally {
          setSending(false);
        }
      };
      recorder.current = rec;
      rec.start();
      setSeconds(0);
      setRecording(true);
      setShowEmoji(false);
      timer.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_RECORD_SECONDS) rec.state !== "inactive" && rec.stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      toast.error("Microphone permission denied. Please allow microphone access.");
    }
  };

  const finishRecording = () => {
    cancelled.current = false;
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
  };

  const cancelRecording = () => {
    cancelled.current = true;
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
  };

  const startCall = async (kind: "voice" | "video") => {
    if (sending || recording) return;
    const win = window.open("about:blank", "_blank");
    const room = `UniLoop-${crypto.randomUUID().replace(/-/g, "")}`;
    const url = `https://meet.jit.si/${room}`;
    const label = kind === "video" ? "📹 Video" : "📞 Voice";
    try {
      await insertRow({ content: `${label} call\n${url}`, message_type: "text", media_url: null });
      const joinUrl = kind === "voice" ? `${url}#config.startWithVideoMuted=true` : url;
      if (win) win.location.href = joinUrl;
      else toast.message("Call started. Tap “Join call” in the chat to open it.");
    } catch (e) {
      win?.close();
      toast.error("Couldn't start call: " + (e as Error).message);
    }
  };

  const deleteForEveryone = async (id: string) => {
    if (!window.confirm("Delete this message for everyone?")) return;
    const call = (supabase as unknown as { rpc: (fn: string, args: object) => Promise<{ error: { message: string } | null }> }).rpc;
    const { error } = await call.call(supabase, "delete_message_for_everyone", { p_id: id });
    if (error) return toast.error("Couldn't delete: " + error.message);
    setMsgs((prev) => prev?.map((x) => (x.id === id ? { ...x, deleted_at: new Date().toISOString(), content: null, media_url: null } : x)) ?? prev);
  };

  const lastMineId = [...(msgs ?? [])].reverse().find((m) => m.sender_id === user?.id)?.id;
  const canSend = !sending && (!!text.trim() || !!pendingImage);

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={onBack} className="rounded-full p-1.5 hover:bg-secondary md:hidden" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
        <Avatar name={other?.full_name ?? "?"} url={other?.avatar_url} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{other?.full_name || "Student"}</p>
          {(typing || status.text) && (
            <p className={`flex items-center gap-1 truncate text-xs ${typing || status.online ? "text-green-600" : "text-muted-foreground"}`}>
              {!typing && status.online && <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />}
              {typing ? "typing…" : status.text}
            </p>
          )}
          {convo.item && <Link to="/item/$id" params={{ id: convo.item.id }} className="block truncate text-xs text-accent">{convo.item.title}</Link>}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button onClick={() => startCall("voice")} disabled={sending || recording} className="rounded-full p-2 hover:bg-secondary disabled:opacity-50" aria-label="Start voice call"><Phone className="h-5 w-5" /></button>
          <button onClick={() => startCall("video")} disabled={sending || recording} className="rounded-full p-2 hover:bg-secondary disabled:opacity-50" aria-label="Start video call"><Video className="h-5 w-5" /></button>
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
                  {mine && !m.deleted_at && (
                    <button type="button" onClick={() => deleteForEveryone(m.id)} className="mr-1 self-center rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive" aria-label="Delete for everyone" title="Delete for everyone"><Trash2 className="h-3.5 w-3.5" /></button>
                  )}
                  <div className={`max-w-[78%] rounded-2xl px-4 py-2 text-sm shadow-soft ${mine ? "rounded-br-sm bg-accent text-accent-foreground" : "rounded-bl-sm bg-card"}`}>
                    {m.deleted_at ? <p className="italic opacity-70">🚫 This message was deleted</p> : (<>
                    {m.message_type === "image" && m.media_url && (
                      <button type="button" onClick={() => setViewer(m.media_url!)} className="mb-1 block">
                        <img src={m.media_url} alt="Photo" loading="lazy" className="max-h-64 w-full rounded-xl object-cover" />
                      </button>
                    )}
                    {m.message_type === "audio" && m.media_url && (
                      <audio controls preload="metadata" src={m.media_url} className="h-10 w-56 max-w-full" />
                    )}
                    {(() => {
                      const call = parseCall(m.content);
                      if (call) {
                        const href = call.kind === "voice" ? `${call.url}#config.startWithVideoMuted=true` : call.url;
                        return (
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{call.kind === "video" ? "📹" : "📞"}</span>
                            <div>
                              <p className="font-semibold">{call.kind === "video" ? "Video call" : "Voice call"}</p>
                              <a href={href} target="_blank" rel="noopener noreferrer"
                                className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-semibold ${mine ? "bg-white text-accent" : "bg-accent text-accent-foreground"}`}>Join call</a>
                            </div>
                          </div>
                        );
                      }
                      return m.content ? <p className="whitespace-pre-wrap break-words">{m.content}</p> : null;
                    })()}
                    </>)}
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

      {pendingImage && (
        <div className="flex items-center gap-3 border-t border-border bg-card px-3 py-2">
          <img src={pendingImage.url} alt="Selected photo" className="h-16 w-16 rounded-lg object-cover" />
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{pendingImage.file.name} — add a caption (optional) and press send</p>
          <button onClick={clearImage} className="rounded-full p-1.5 hover:bg-secondary" aria-label="Remove photo"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="relative border-t border-border p-3">
        {showEmoji && (
          <div className="absolute bottom-full left-3 right-3 z-10 mb-2 grid max-h-48 grid-cols-8 gap-1 overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-soft sm:left-3 sm:right-auto sm:w-80">
            {EMOJIS.map((em) => (
              <button key={em} type="button" onClick={() => setText((t) => (t + em).slice(0, 2000))}
                className="rounded-lg p-1 text-xl hover:bg-secondary" aria-label={`Insert ${em}`}>{em}</button>
            ))}
          </div>
        )}

        {recording ? (
          <div className="flex items-center gap-3">
            <button onClick={cancelRecording} className="rounded-full p-2 hover:bg-secondary" aria-label="Cancel recording"><X className="h-5 w-5" /></button>
            <div className="flex flex-1 items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              <span className="font-semibold tabular-nums">{mmss(seconds)}</span>
              <span className="text-muted-foreground">Recording…</span>
            </div>
            <button onClick={finishRecording} className="btn-accent h-10 w-10 shrink-0" aria-label="Send voice message"><Send className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="flex items-end gap-1.5 sm:gap-2">
            <button type="button" onClick={() => setShowEmoji((v) => !v)} disabled={sending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-secondary disabled:opacity-50" aria-label="Emoji"><Smile className="h-5 w-5" /></button>
            <button type="button" onClick={() => fileInput.current?.click()} disabled={sending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-secondary disabled:opacity-50" aria-label="Send photo"><ImageIcon className="h-5 w-5" /></button>
            <input ref={fileInput} type="file" accept="image/*" onChange={pickImage} className="hidden" />
            <textarea value={text} onChange={(e) => { setText(e.target.value); notifyTyping(); }} rows={1} placeholder={pendingImage ? "Add a caption…" : "Message…"} maxLength={2000}
              onFocus={() => setShowEmoji(false)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              className="max-h-32 min-w-0 flex-1 resize-none rounded-full border border-input bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            {canSend || sending ? (
              <button onClick={send} disabled={!canSend} className="btn-accent h-10 w-10 shrink-0 disabled:opacity-50" aria-label="Send">
                {sending ? <span className="text-[10px]">…</span> : <Send className="h-4 w-4" />}
              </button>
            ) : (
              <button onClick={startRecording} className="btn-accent h-10 w-10 shrink-0" aria-label="Record voice message"><Mic className="h-4 w-4" /></button>
            )}
          </div>
        )}
        {sending && <p className="mt-1 px-2 text-xs text-muted-foreground">Uploading…</p>}
      </div>

      {viewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setViewer(null)}>
          <button className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white" aria-label="Close" onClick={() => setViewer(null)}><X className="h-5 w-5" /></button>
          <img src={viewer} alt="Full size" className="max-h-full max-w-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
