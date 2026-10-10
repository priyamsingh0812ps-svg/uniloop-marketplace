import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Header, Footer, ListingCard } from "@/components/site";
import { CATEGORIES, formatPrice, listingsQuery, SAMPLE } from "@/lib/listings";

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
  const [saved, setSaved] = useState(false);
  const l = data.find((x) => x.id === id);

  if (!l) {
    return (
      <div className="min-h-screen"><Header />
        <div className="py-32 text-center">
          <p className="text-muted-foreground">This item has looped on.</p>
          <Link to="/browse" className="btn-primary mt-4 px-6 py-3">Back to browse</Link>
        </div>
      </div>
    );
  }
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
                {l.seller_name?.[0] ?? "S"}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{l.seller_name ?? "Student"}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-primary">✓ Verified Student</span> · ★ {l.seller_rating ?? "New"}
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button className="btn-accent flex-1 py-3.5">Chat with seller</button>
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
