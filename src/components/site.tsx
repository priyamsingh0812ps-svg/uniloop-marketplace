import { Link } from "@tanstack/react-router";
import type { Listing } from "@/lib/listings";
import { formatPrice } from "@/lib/listings";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold text-foreground">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <circle cx="16" cy="16" r="12" fill="none" stroke="var(--primary)" strokeWidth="4" strokeDasharray="56 20" strokeLinecap="round" />
        <circle cx="25" cy="9" r="3.5" fill="var(--accent)" />
      </svg>
      Uni<span className="text-primary">Loop</span>
    </Link>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Logo />
        <nav className="flex items-center gap-1 text-sm font-medium">
          <Link to="/browse" className="rounded-full px-4 py-2 text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>
            Browse
          </Link>
          <Link to="/browse" className="btn-accent px-4 py-2">Sell</Link>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <Logo />
        <p>Buy it. Use it. Loop it. · Students only.</p>
      </div>
    </footer>
  );
}

const modeClass: Record<string, string> = { buy: "chip-buy", rent: "chip-rent", exchange: "chip-exchange" };

export function ListingCard({ l }: { l: Listing }) {
  return (
    <Link to="/item/$id" params={{ id: l.id }} className="group overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {l.image_url && <img src={l.image_url} alt={l.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
        <span className={`chip absolute left-3 top-3 ${modeClass[l.mode]}`}>{l.mode}</span>
      </div>
      <div className="p-4">
        <h3 className="line-clamp-1 font-semibold text-card-foreground">{l.title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{l.campus} · {l.condition}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-display text-lg font-bold text-primary">{formatPrice(l)}</span>
          {l.seller_rating && <span className="text-xs font-medium text-muted-foreground">★ {l.seller_rating}</span>}
        </div>
      </div>
    </Link>
  );
}
