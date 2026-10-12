import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Header, Footer, ListingCard, Loader } from "@/components/site";
import { CATEGORIES, formatPrice, isSample, listingQuery, sellerName, listingsQuery, SAMPLE } from "@/lib/listings";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/item/$id")({
  head: () => ({
    meta: [
      { title: "Item details — UniLoop" },
      { name: "description", content: "See item details, condition and seller rating on UniLoop." },
      { property: "og:title", content: "Item details — UniLoop" },
      { property: "og:description", content: "A student listing on UniLoop." },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Item,
});

function Item() {
  const { id } = Route.useParams();
  const { data = SAMPLE } = useQuery(listingsQuery);
  const one = useQuery(listingQuery(id));
  const { user } = useAuth();
  const nav = useNavigate();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const l = one.data ?? data.find((x) => x.id === id);

  if (!l) {
    if (one.isLoading) return <div className="min-h-screen"><Header /><Loader /></div>;
    return (
      <div className="min-h-screen"><Header />
        <div className="py-32 text-center">
          <p className="text-muted-foreground">This item has looped on.</p>
          <Link to="/browse" className="btn-primary mt-4 px-6 py-3">Back to browse</Link>
        </div>
      </div>
    );
  }
  const demo = isSample(l.id) || !l.seller_id;
  const own = !!user && user.id === l.seller_id;

  const startChat = async () => {
    if (demo || own || !l.seller_id) return;
    if (!user) { nav({ to: "/login", search: { redirect: `/item/${l.id}` } }); return; }
    setBusy(true);
    try {
      const find = () => supabase.from("conversations").select("id").eq("item_id", l.id).eq("buyer_id", user.id).maybeSingle();
      let { data: cv } = await find();
      if (!cv) {
        const ins = await supabase.from("conversations").insert({ item_id: l.id, buyer_id: user.id, seller_id: l.seller_id }).select("id").single();
        if (ins.error) {
          if (ins.error.code !== "23505") throw new Error(ins.error.message);
          cv = (await find()).data; // created concurrently — reuse it
        } else cv = ins.data;
      }
      if (!cv) throw new Error("Could not open the chat");
      nav({ to: "/messages", search: { c: cv.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cat = CATEGORIES.find((c) => c.value === l.category);
  const similar = data.filter((x) => x.id !== l.id && (x.category === l.category || x.campus === l.campus)).slice(0, 4);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Link to="/browse" className="text-sm font-medium text-muted-foreground hover:text-foreground">← Back to browse</Link>
        <div className="mt-4 grid gap-8 md:grid-cols-2">
          <div className="overflow-hidden rounded-3xl bg-muted shadow-lift">
            {l.image_url && <img src={l.image_url.replace("w=800", "w=1200")} alt={l.title} className="aspect-square w-full object-cover" />}
          </div>
          <div>
            <div className="flex flex-wrap gap-2">
              <span className={`chip chip-${l.mode}`}>{l.mode}</span>
              <span className="chip bg-secondary text-secondary-foreground">{cat?.label}</span>
            </div>
            <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">{l.title}</h1>
            <p className="mt-3 font-display text-3xl font-extrabold text-primary">{formatPrice(l)}</p>
            <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-secondary p-3"><dt className="text-muted-foreground">Condition</dt><dd className="font-semibold">{l.condition}</dd></div>
              <div className="rounded-xl bg-secondary p-3"><dt className="text-muted-foreground">Campus</dt><dd className="font-semibold">{l.campus}</dd></div>
            </dl>
            <p className="mt-6 leading-relaxed text-muted-foreground">{l.description}</p>

            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-hero font-display text-lg font-bold text-primary-foreground">
                {sellerName(l)[0]}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{sellerName(l)}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-primary">✓ Verified Student</span> · ★ {l.seller_rating ?? "New"}
                </p>
              </div>
            </div>

            {demo && (
              <p className="mt-6 rounded-xl bg-accent/15 px-4 py-3 text-sm">
                <b>Demo listing</b> — this is sample data with no real seller account, so chat is disabled.
              </p>
            )}
            <div className="mt-4 flex gap-3">
              {own ? (
                <Link to="/my-listings" className="btn-primary flex-1 py-3.5">This is your listing — manage it</Link>
              ) : (
                <button onClick={startChat} disabled={demo || busy} className="btn-accent flex-1 gap-2 py-3.5 disabled:cursor-not-allowed disabled:opacity-50">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                  {demo ? "Chat unavailable" : "Chat with seller"}
                </button>
              )}
              <button onClick={() => setSaved(!saved)} aria-label="Save to wishlist"
                className={`rounded-full border px-5 text-xl transition ${saved ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card"}`}>
                {saved ? "♥" : "♡"}
              </button>
            </div>
          </div>
        </div>

        {!!similar.length && (
          <section className="mt-16">
            <h2 className="font-display text-2xl font-bold">You might also like</h2>
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {similar.map((x) => <ListingCard key={x.id} l={x} />)}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
