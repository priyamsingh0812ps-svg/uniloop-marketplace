import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Page, Loader, Empty, Stars, inputCls } from "@/components/site";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/my-requests")({
  head: () => ({
    meta: [
      { title: "My requests — UniLoop" },
      { name: "description", content: "Accept or decline requests on your items and track the ones you sent." },
      { property: "og:title", content: "My requests — UniLoop" },
      { property: "og:description", content: "Track your buy, rent and exchange requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyRequests,
});

interface Req {
  id: string; type: string; status: string; start_date: string | null; end_date: string | null; message: string | null; created_at: string;
  buyer_id: string; seller_id: string;
  item: { id: string; title: string; image_url: string | null } | null;
  buyer: { full_name: string } | null; seller: { full_name: string } | null;
}

const statusCls: Record<string, string> = { pending: "bg-accent/20", accepted: "bg-primary/15 text-primary", completed: "bg-primary text-primary-foreground", declined: "bg-destructive/10 text-destructive", cancelled: "bg-muted" };

function MyRequests() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"received" | "sent">("received");
  const q = useQuery({
    queryKey: ["requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [r, rv] = await Promise.all([
        supabase.from("requests").select("*, item:listings(id,title,image_url), buyer:profiles!requests_buyer_id_fkey(full_name), seller:profiles!requests_seller_id_fkey(full_name)").order("created_at", { ascending: false }),
        supabase.from("reviews").select("request_id").eq("reviewer_id", user!.id),
      ]);
      if (r.error) throw new Error(r.error.message);
      return { reqs: r.data as unknown as Req[], reviewed: new Set((rv.data ?? []).map((x) => x.request_id)) };
    },
  });

  const update = async (id: string, status: string) => {
    const { error } = await supabase.from("requests").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Request ${status}`);
    qc.invalidateQueries({ queryKey: ["requests"] });
    qc.invalidateQueries({ queryKey: ["listings"] });
  };

  const list = q.data?.reqs.filter((r) => (tab === "received" ? r.seller_id === user?.id : r.buyer_id === user?.id)) ?? [];

  return (
    <Page>
      <h1 className="font-display text-3xl font-bold">My requests</h1>
      <div className="mt-4 inline-flex rounded-full bg-secondary p-1">
        {(["received", "sent"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${tab === t ? "bg-card shadow-soft" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>
      <div className="mt-6">
        {q.isLoading ? <Loader /> : q.error ? <Empty title="Couldn't load requests" body={(q.error as Error).message} /> : !list.length ? (
          <Empty title={tab === "received" ? "No requests on your items yet" : "You haven't sent any requests"} action={<Link to="/browse" className="btn-primary px-5 py-2.5">Browse items</Link>} />
        ) : (
          <div className="space-y-3">
            {list.map((r) => {
              const other = tab === "received" ? r.buyer?.full_name : r.seller?.full_name;
              const otherId = tab === "received" ? r.buyer_id : r.seller_id;
              return (
                <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                  <div className="flex items-start gap-3">
                    {r.item?.image_url ? <img src={r.item.image_url} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <div className="h-14 w-14 rounded-xl bg-muted" />}
                    <div className="min-w-0 flex-1">
                      {r.item ? <Link to="/item/$id" params={{ id: r.item.id }} className="font-semibold hover:text-primary">{r.item.title}</Link> : <p className="font-semibold">Item removed</p>}
                      <p className="text-sm text-muted-foreground">
                        <span className="capitalize">{r.type}</span> · {tab === "received" ? "from" : "to"} <Link to="/u/$id" params={{ id: otherId }} className="font-medium text-foreground">{other || "Student"}</Link>
                        {r.start_date && ` · ${r.start_date} → ${r.end_date}`}
                      </p>
                      {r.message && <p className="mt-1 text-sm">"{r.message}"</p>}
                    </div>
                    <span className={`chip ${statusCls[r.status]}`}>{r.status}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tab === "received" && r.status === "pending" && <>
                      <button onClick={() => update(r.id, "accepted")} className="btn-primary px-4 py-2 text-sm">Accept</button>
                      <button onClick={() => update(r.id, "declined")} className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold">Decline</button>
                    </>}
                    {tab === "received" && r.status === "accepted" && <button onClick={() => update(r.id, "completed")} className="btn-primary px-4 py-2 text-sm">Mark deal completed</button>}
                    {tab === "sent" && r.status === "pending" && <button onClick={() => update(r.id, "cancelled")} className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold">Cancel request</button>}
                  </div>
                  {r.status === "completed" && !q.data!.reviewed.has(r.id) && <ReviewForm requestId={r.id} revieweeId={otherId} name={other || "them"} onDone={() => qc.invalidateQueries({ queryKey: ["requests"] })} />}
                  {r.status === "completed" && q.data!.reviewed.has(r.id) && <p className="mt-3 text-sm text-primary">✓ You reviewed this deal</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Page>
  );
}

function ReviewForm({ requestId, revieweeId, name, onDone }: { requestId: string; revieweeId: string; name: string; onDone: () => void }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!rating) return toast.error("Pick a star rating.");
    setBusy(true);
    const { error } = await supabase.from("reviews").insert({ request_id: requestId, reviewer_id: user!.id, reviewee_id: revieweeId, rating, comment: comment.trim().slice(0, 500) || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Thanks for your review!"); onDone();
  };
  return (
    <div className="mt-3 rounded-xl bg-secondary p-3">
      <p className="text-sm font-medium">Rate {name}</p>
      <div className="mt-1"><Stars value={rating} onChange={setRating} size={6} /></div>
      <input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} placeholder="Short review (optional)" className={`${inputCls} mt-2`} />
      <button disabled={busy} onClick={submit} className="btn-primary mt-2 px-4 py-2 text-sm disabled:opacity-60">Submit review</button>
    </div>
  );
}
