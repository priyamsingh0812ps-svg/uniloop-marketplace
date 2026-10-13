import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Page, Loader, Empty } from "@/components/site";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/my-orders")({
  head: () => ({
    meta: [
      { title: "My orders — UniLoop" },
      { name: "description", content: "Track items you're buying and manage orders on items you're selling." },
      { property: "og:title", content: "My orders — UniLoop" },
      { property: "og:description", content: "Your UniLoop Buy Now orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyOrders,
});

interface Order {
  id: string; status: string; price: number | null; created_at: string; buyer_id: string; seller_id: string;
  item: { id: string; title: string; image_url: string | null; price: number } | null;
  buyer: { full_name: string } | null; seller: { full_name: string } | null;
}

const LABEL: Record<string, string> = { pending: "Requested", accepted: "Accepted", completed: "Completed", declined: "Declined", cancelled: "Cancelled" };
const CLS: Record<string, string> = { pending: "bg-accent/20", accepted: "bg-primary/15 text-primary", completed: "bg-primary text-primary-foreground", declined: "bg-destructive/10 text-destructive", cancelled: "bg-muted text-muted-foreground" };

function MyOrders() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"buying" | "selling">("buying");
  const [busyId, setBusyId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("requests")
        .select("id,status,price,created_at,buyer_id,seller_id, item:listings(id,title,image_url,price), buyer:profiles!requests_buyer_id_fkey(full_name), seller:profiles!requests_seller_id_fkey(full_name)")
        .eq("type", "buy").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data as unknown as Order[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`orders-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => qc.invalidateQueries({ queryKey: ["orders"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const update = async (o: Order, status: string, msg: string) => {
    setBusyId(o.id);
    const { error } = await supabase.from("requests").update({ status }).eq("id", o.id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["listings"] });
    qc.invalidateQueries({ queryKey: ["listing"] });
  };

  const list = (q.data ?? []).filter((o) => (tab === "buying" ? o.buyer_id === user?.id : o.seller_id === user?.id));
  const btn = "rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50";

  return (
    <Page>
      <h1 className="font-display text-3xl font-bold">My orders</h1>
      <div className="mt-4 inline-flex rounded-full bg-secondary p-1">
        {(["buying", "selling"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-5 py-2 text-sm font-semibold capitalize transition ${tab === t ? "bg-card shadow-soft" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {q.isLoading ? <Loader /> : q.error ? <p className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">Couldn't load orders: {(q.error as Error).message}</p> :
          !list.length ? <Empty title={tab === "buying" ? "No orders yet" : "No orders on your items yet"} body={tab === "buying" ? "Tap Buy Now on an item to place an order." : "When someone buys your item, it shows up here."} action={<Link to="/browse" className="btn-primary px-4 py-2 text-sm">Browse</Link>} /> :
          list.map((o) => {
            const busy = busyId === o.id;
            const who = tab === "buying" ? `Seller: ${o.seller?.full_name || "Student"}` : `Buyer: ${o.buyer?.full_name || "Student"}`;
            return (
              <div key={o.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {o.item?.image_url ? <img src={o.item.image_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : <div className="h-16 w-16 shrink-0 rounded-xl bg-muted" />}
                  <div className="min-w-0">
                    {o.item ? <Link to="/item/$id" params={{ id: o.item.id }} className="block truncate font-semibold hover:text-accent">{o.item.title}</Link> : <p className="font-semibold">Item removed</p>}
                    <p className="font-display font-bold text-primary">₹{Number(o.price ?? o.item?.price ?? 0).toLocaleString("en-IN")}</p>
                    <p className="text-xs text-muted-foreground">{who} · {new Date(o.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`chip ${CLS[o.status] ?? "bg-muted"}`}>{LABEL[o.status] ?? o.status}</span>
                  {tab === "selling" && o.status === "pending" && <>
                    <button disabled={busy} onClick={() => update(o, "accepted", "Order accepted — arrange a meetup in chat")} className={`${btn} btn-accent`}>Accept</button>
                    <button disabled={busy} onClick={() => update(o, "declined", "Order declined — item is available again")} className={`${btn} border border-border`}>Decline</button>
                  </>}
                  {tab === "selling" && o.status === "accepted" && <>
                    <button disabled={busy} onClick={() => update(o, "completed", "Marked as completed — item sold")} className={`${btn} btn-accent`}>Mark completed</button>
                    <button disabled={busy} onClick={() => confirm("Cancel this accepted order? The item becomes available again.") && update(o, "cancelled", "Order cancelled")} className={`${btn} border border-border`}>Cancel</button>
                  </>}
                  {tab === "buying" && o.status === "pending" && (
                    <button disabled={busy} onClick={() => confirm("Cancel your order?") && update(o, "cancelled", "Order cancelled")} className={`${btn} border border-border`}>Cancel order</button>
                  )}
                  <Link to="/messages" className={`${btn} text-accent`}>Chat</Link>
                </div>
              </div>
            );
          })}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">Payment happens in person on campus. Sellers mark an order completed after the exchange.</p>
    </Page>
  );
}
