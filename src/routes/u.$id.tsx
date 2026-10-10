import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Page, Loader, Empty, Avatar, VerifiedBadge, Stars, ListingCard } from "@/components/site";
import { supabase } from "@/lib/supabase";
import type { Listing } from "@/lib/listings";
import type { Profile } from "@/lib/auth";

export const Route = createFileRoute("/u/$id")({
  head: () => ({
    meta: [
      { title: "Student profile — UniLoop" },
      { name: "description", content: "See a student's listings, verification badge and reviews on UniLoop." },
      { property: "og:title", content: "Student profile — UniLoop" },
      { property: "og:description", content: "A verified student on UniLoop." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UserProfile,
});

interface Review { id: string; rating: number; comment: string | null; created_at: string; reviewer: { full_name: string } | null }

function UserProfile() {
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => {
      const [p, r, l] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("reviews").select("id,rating,comment,created_at,reviewer:profiles!reviews_reviewer_id_fkey(full_name)").eq("reviewee_id", id).order("created_at", { ascending: false }),
        supabase.from("listings").select("*").eq("seller_id", id).in("status", ["available", "reserved"]).order("created_at", { ascending: false }),
      ]);
      if (p.error) throw new Error(p.error.message);
      return { profile: p.data as Profile | null, reviews: (r.data ?? []) as unknown as Review[], listings: (l.data ?? []) as Listing[] };
    },
  });

  if (q.isLoading) return <Page><Loader /></Page>;
  if (q.error || !q.data?.profile) return <Page><Empty title="Profile not found" body={q.error ? (q.error as Error).message : undefined} /></Page>;
  const { profile, reviews, listings } = q.data;
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;

  return (
    <Page>
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-card p-6 text-center shadow-soft sm:flex-row sm:text-left">
        <Avatar name={profile.full_name} url={profile.avatar_url} size={16} />
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold">{profile.full_name || "Student"}</h1>
          <p className="text-sm text-muted-foreground">{profile.college}</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <VerifiedBadge verified={profile.verified} status={profile.verification_status} />
            {reviews.length > 0 && <span className="flex items-center gap-1 text-sm"><Stars value={Math.round(avg)} /> {avg.toFixed(1)} ({reviews.length})</span>}
          </div>
        </div>
      </div>
      <h2 className="mt-10 font-display text-xl font-bold">Listings</h2>
      {listings.length ? <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">{listings.map((l) => <ListingCard key={l.id} l={l} />)}</div>
        : <p className="mt-2 text-sm text-muted-foreground">No active listings.</p>}
      <h2 className="mt-10 font-display text-xl font-bold">Reviews</h2>
      {reviews.length ? (
        <div className="mt-4 space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center justify-between"><Stars value={r.rating} /><span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span></div>
              {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
              <p className="mt-1 text-xs text-muted-foreground">— {r.reviewer?.full_name || "Student"}</p>
            </div>
          ))}
        </div>
      ) : <p className="mt-2 text-sm text-muted-foreground">No reviews yet.</p>}
    </Page>
  );
}
