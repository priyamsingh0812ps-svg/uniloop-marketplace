import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Header, Footer, ListingCard } from "@/components/site";
import { CATEGORIES, listingsQuery, SAMPLE } from "@/lib/listings";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "UniLoop — Buy it. Use it. Loop it." },
      { name: "description", content: "The student-only marketplace to buy, rent, sell or exchange books, calculators, cycles, furniture and gadgets on campus." },
      { property: "og:title", content: "UniLoop — Buy it. Use it. Loop it." },
      { property: "og:description", content: "The student-only marketplace for your campus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { data = SAMPLE } = useQuery(listingsQuery);
  return (
    <div className="min-h-screen">
      <Header />
      <section className="relative overflow-hidden bg-hero text-primary-foreground">
        <svg viewBox="0 0 200 200" className="animate-spin-slow pointer-events-none absolute -right-24 -top-24 h-[28rem] w-[28rem] opacity-20" aria-hidden>
          <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="18" strokeDasharray="360 140" strokeLinecap="round" />
        </svg>
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:py-28">
          <span className="chip bg-primary-foreground/15 text-primary-foreground">✓ Verified students only</span>
          <h1 className="mt-5 max-w-2xl font-display text-5xl font-extrabold leading-[1.05] sm:text-7xl">
            Buy it. Use it. <span className="text-accent">Loop it.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg opacity-90">
            Pass on last semester's textbooks, rent a cycle for the month, or swap gadgets — with students on your own campus.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/browse" className="btn-accent px-7 py-3.5">Start browsing</Link>
            <Link to="/browse" className="inline-flex items-center rounded-full border border-primary-foreground/40 px-7 py-3.5 font-semibold hover:bg-primary-foreground/10">List an item</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="font-display text-2xl font-bold">Shop by category</h2>
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {CATEGORIES.map((c) => (
            <Link key={c.value} to="/browse" search={{ category: c.value }} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm font-semibold shadow-soft transition hover:-translate-y-0.5 hover:border-primary">
              <span className="text-3xl">{c.emoji}</span>{c.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["1", "Verify", "Sign up with your college email to earn the Verified Student badge."],
            ["2", "Loop", "List what you don't need — sell, rent or exchange in a minute."],
            ["3", "Meet", "Chat in-app and meet on campus. Rate each other after."],
          ].map(([n, t, d]) => (
            <div key={n} className="rounded-2xl bg-secondary p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent font-display font-bold text-accent-foreground">{n}</span>
              <h3 className="mt-4 font-display text-xl font-bold text-secondary-foreground">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl font-bold">Fresh on campus</h2>
          <Link to="/browse" className="text-sm font-semibold text-primary">See all →</Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {data.slice(0, 8).map((l) => <ListingCard key={l.id} l={l} />)}
        </div>
      </section>
      <Footer />
    </div>
  );
}
