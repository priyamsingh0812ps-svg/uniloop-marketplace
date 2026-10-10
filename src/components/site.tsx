import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { BadgeCheck, Clock, Loader2, Menu, MessageCircle, Star } from "lucide-react";
import type { Listing } from "@/lib/listings";
import { formatPrice, sellerName, MODE_LABEL } from "@/lib/listings";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <circle cx="16" cy="16" r="12" fill="none" stroke="var(--primary)" strokeWidth="4" strokeDasharray="56 20" strokeLinecap="round" />
        <circle cx="25" cy="9" r="3.5" fill="var(--accent)" />
      </svg>
      <span><span className="text-foreground">Uni</span><span className="text-accent">Loop</span></span>
    </Link>
  );
}

export function Avatar({ name, url, size = 9 }: { name: string; url?: string | null | undefined; size?: number }) {
  const cls = size === 9 ? "h-9 w-9 text-sm" : size === 12 ? "h-12 w-12 text-base" : "h-16 w-16 text-xl";
  if (url) return <img src={url} alt={name} className={`${cls} rounded-full object-cover`} />;
  return <span className={`${cls} inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground`}>{(name || "?").charAt(0).toUpperCase()}</span>;
}

export function Header() {
  const { user, profile, unread, signOut } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const name = profile?.full_name || user?.email || "";

  const logout = async () => {
    await qc.cancelQueries();
    await signOut();
    qc.clear();
    setOpen(false);
    nav({ to: "/login", replace: true });
  };

  const links = [
    { to: "/my-listings", label: "My Listings" },
    { to: "/my-requests", label: "My Requests" },
    { to: "/messages", label: "Messages" },
    { to: "/dashboard", label: "Dashboard" },
  ] as const;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card shadow-soft">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
        <Logo />
        <nav className="hidden items-center gap-1 text-sm font-medium md:flex">
          <Link to="/browse" className="rounded-full px-4 py-2 text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>Browse</Link>
          <Link to="/sell" className="btn-accent px-4 py-2">Sell</Link>
          {user ? (
            <>
              <Link to="/messages" className="relative ml-1 rounded-full p-2 text-muted-foreground hover:text-foreground" aria-label="Messages">
                <MessageCircle className="h-5 w-5" />
                {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">{unread}</span>}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger className="ml-1 rounded-full focus:outline-none focus:ring-2 focus:ring-ring" aria-label="Account menu">
                  <Avatar name={name} url={profile?.avatar_url} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {links.map((l) => (
                    <DropdownMenuItem key={l.to} onSelect={() => nav({ to: l.to })}>
                      {l.label}{l.to === "/messages" && unread > 0 && <span className="ml-auto text-xs font-bold text-accent">{unread}</span>}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={logout}>Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link to="/login" className="rounded-full px-4 py-2 text-foreground hover:bg-secondary">Log in</Link>
              <Link to="/signup" className="btn-primary px-4 py-2">Sign up</Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-1 md:hidden">
          {user && (
            <Link to="/messages" className="relative p-2 text-muted-foreground" aria-label="Messages">
              <MessageCircle className="h-5 w-5" />
              {unread > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">{unread}</span>}
            </Link>
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="rounded-lg p-2" aria-label="Open menu"><Menu className="h-6 w-6" /></SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="mt-6 flex flex-col gap-1 text-base font-medium">
                {user && <div className="mb-3 flex items-center gap-3"><Avatar name={name} url={profile?.avatar_url} /><span className="truncate">{name}</span></div>}
                <MobileLink to="/browse" onClick={() => setOpen(false)}>Browse</MobileLink>
                <MobileLink to="/sell" onClick={() => setOpen(false)}>Sell an item</MobileLink>
                {user ? (
                  <>
                    {links.map((l) => <MobileLink key={l.to} to={l.to} onClick={() => setOpen(false)}>{l.label}{l.to === "/messages" && unread > 0 ? ` (${unread})` : ""}</MobileLink>)}
                    <button onClick={logout} className="rounded-xl px-3 py-2.5 text-left text-destructive hover:bg-secondary">Logout</button>
                  </>
                ) : (
                  <>
                    <MobileLink to="/login" onClick={() => setOpen(false)}>Log in</MobileLink>
                    <Link to="/signup" onClick={() => setOpen(false)} className="btn-primary mt-2 px-4 py-3">Sign up</Link>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function MobileLink({ to, onClick, children }: { to: string; onClick: () => void; children: ReactNode }) {
  return <Link to={to as "/"} onClick={onClick} className="rounded-xl px-3 py-2.5 hover:bg-secondary">{children}</Link>;
}

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <Logo />
        <p>Buy it. Use it. Loop it. · Students only<br />TEAM-VentureX.</p>
      </div>
    </footer>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <Footer />
    </div>
  );
}

export function Loader({ label = "Loading…" }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />{label}</div>;
}

export function Empty({ title, body, action }: { title: string; body?: string | undefined; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <p className="font-display text-lg font-bold">{title}</p>
      {body && <p className="mt-1 text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function VerifiedBadge({ verified, status }: { verified?: boolean; status?: string }) {
  if (verified) return <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"><BadgeCheck className="h-3.5 w-3.5" />Verified Student</span>;
  if (status === "pending") return <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent-foreground"><Clock className="h-3.5 w-3.5" />Pending review</span>;
  return null;
}

export function Stars({ value, onChange, size = 4 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)} aria-label={`${n} stars`} className={onChange ? "cursor-pointer" : "cursor-default"}>
          <Star className={`${size === 4 ? "h-4 w-4" : "h-6 w-6"} ${n <= value ? "fill-accent text-accent" : "text-muted-foreground/40"}`} />
        </button>
      ))}
    </span>
  );
}

const modeClass: Record<string, string> = { buy: "chip-buy", rent: "chip-rent", exchange: "chip-exchange", meal: "chip-meal" };

export function ListingCard({ l }: { l: Listing }) {
  const img = l.images?.[0] ?? l.image_url;
  return (
    <Link to="/item/$id" params={{ id: l.id }} className="group overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {img && <img src={img} alt={l.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
        <span className={`chip absolute left-3 top-3 ${modeClass[l.mode]}`}>{MODE_LABEL[l.mode]}</span>
        {l.status !== "available" && <span className="chip absolute right-3 top-3 bg-card text-foreground">{l.status}</span>}
      </div>
      <div className="p-4">
        <h3 className="line-clamp-1 font-semibold text-card-foreground">{l.title}</h3>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{l.subcategory ?? l.campus} · {l.campus} · {sellerName(l)}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-display text-lg font-bold text-primary">{formatPrice(l)}</span>
          {l.seller?.verified && <BadgeCheck className="h-4 w-4 text-primary" aria-label="Verified seller" />}
          {!l.seller && l.seller_rating && <span className="text-xs font-medium text-muted-foreground">★ {l.seller_rating}</span>}
        </div>
      </div>
    </Link>
  );
}

export const inputCls = "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

