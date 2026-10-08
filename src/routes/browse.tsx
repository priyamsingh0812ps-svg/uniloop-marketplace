import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Header, Footer, ListingCard } from "@/components/site";
import { CAMPUSES, CATEGORIES, listingsQuery, SAMPLE, type Category, type Mode } from "@/lib/listings";

type Search = { q?: string | undefined; category?: Category | undefined; mode?: Mode | undefined; campus?: string | undefined; max?: number | undefined };

export const Route = createFileRoute("/browse")({
  validateSearch: (s: { q?: unknown; category?: unknown; mode?: unknown; campus?: unknown; max?: unknown }): Search => ({
    q: typeof s.q === "string" ? s.q : undefined,
    category: typeof s.category === "string" ? (s.category as Category) : undefined,
    mode: typeof s.mode === "string" ? (s.mode as Mode) : undefined,
    campus: typeof s.campus === "string" ? s.campus : undefined,
    max: s.max ? Number(s.max) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Browse listings — UniLoop" },
      { name: "description", content: "Search books, calculators, cycles, furniture and gadgets from students on your campus." },
      { property: "og:title", content: "Browse listings — UniLoop" },
      { property: "og:description", content: "Find second-hand student essentials near you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Browse,
});

function Browse() {
  const s = Route.useSearch();
  const nav = useNavigate({ from: "/browse" });
  const set = (patch: Partial<Search>) => nav({ search: (p) => ({ ...p, ...patch }), replace: true });
  const { data = SAMPLE } = useQuery(listingsQuery);

  const items = useMemo(() => data.filter((l) =>
    (!s.q || `${l.title} ${l.description}`.toLowerCase().includes(s.q.toLowerCase())) &&
    (!s.category || l.category === s.category) &&
    (!s.mode || l.mode === s.mode) &&
    (!s.campus || l.campus === s.campus) &&
    (!s.max || l.mode === "exchange" || Number(l.price) <= s.max)
  ), [data, s]);

  const select = "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="font-display text-3xl font-bold">Browse</h1>
        <input
          value={s.q ?? ""}
          onChange={(e) => set({ q: e.target.value || undefined })}
          placeholder="Search textbooks, cycles, calculators…"
          className="mt-4 w-full rounded-full border border-input bg-card px-5 py-3.5 shadow-soft focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {([undefined, "buy", "rent", "exchange"] as const).map((m) => (
            <button key={m ?? "all"} onClick={() => set({ mode: m })}
              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${s.mode === m ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}>
              {m ?? "All"}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <select className={select} value={s.category ?? ""} onChange={(e) => set({ category: (e.target.value || undefined) as Category })}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
          </select>
          <select className={select} value={s.campus ?? ""} onChange={(e) => set({ campus: e.target.value || undefined })}>
            <option value="">All campuses</option>
            {CAMPUSES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className={`${select} col-span-2 sm:col-span-1`} value={s.max ?? ""} onChange={(e) => set({ max: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">Any price</option>
            <option value="500">Under ₹500</option>
            <option value="1000">Under ₹1,000</option>
            <option value="5000">Under ₹5,000</option>
          </select>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">{items.length} items</p>
        <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {items.map((l) => <ListingCard key={l.id} l={l} />)}
        </div>
        {!items.length && <p className="py-20 text-center text-muted-foreground">Nothing in the loop yet. Try other filters.</p>}
      </main>
      <Footer />
    </div>
  );
}
