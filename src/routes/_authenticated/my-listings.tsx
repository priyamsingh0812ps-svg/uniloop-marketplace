import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Page, Loader, Empty } from "@/components/site";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { formatPrice, type Listing, type Status } from "@/lib/listings";

export const Route = createFileRoute("/_authenticated/my-listings")({
  head: () => ({
    meta: [
      { title: "My listings — UniLoop" },
      { name: "description", content: "Manage, edit and mark your UniLoop listings as sold." },
      { property: "og:title", content: "My listings — UniLoop" },
      { property: "og:description", content: "Manage your listings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyListings,
});

function MyListings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["my-listings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select("*").eq("seller_id", user!.id).order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data as Listing[];
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["my-listings"] }); qc.invalidateQueries({ queryKey: ["listings"] }); };

  const setStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("listings").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked as ${status}`); refresh();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this listing? This can't be undone.")) return;
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Listing deleted"); refresh();
  };

  return (
    <Page>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">My listings</h1>
        <Link to="/sell" className="btn-accent px-4 py-2 text-sm">+ New</Link>
      </div>
      <div className="mt-6">
        {q.isLoading ? <Loader /> : q.error ? <Empty title="Couldn't load your listings" body={(q.error as Error).message} /> :
          !q.data?.length ? <Empty title="No listings yet" body="List something you don't need anymore." action={<Link to="/sell" className="btn-primary px-5 py-2.5">Sell an item</Link>} /> : (
          <div className="space-y-3">
            {q.data.map((l) => (
              <div key={l.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft sm:flex-row sm:items-center">
                <Link to="/item/$id" params={{ id: l.id }} className="flex min-w-0 flex-1 items-center gap-3">
                  {l.image_url ? <img src={l.image_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : <div className="h-16 w-16 rounded-xl bg-muted" />}
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{l.title}</p>
                    <p className="text-sm text-primary">{formatPrice(l)}</p>
                    <span className="chip mt-1 bg-secondary text-secondary-foreground">{l.status}</span>
                  </div>
                </Link>
                <div className="flex flex-wrap gap-2">
                  <Link to="/sell" search={{ edit: l.id }} className="rounded-full bg-secondary px-3 py-1.5 text-sm font-medium">Edit</Link>
                  {l.status !== "sold" && <button onClick={() => setStatus(l.id, "sold")} className="rounded-full bg-secondary px-3 py-1.5 text-sm font-medium">Mark sold</button>}
                  {l.status === "available" ? <button onClick={() => setStatus(l.id, "unavailable")} className="rounded-full bg-secondary px-3 py-1.5 text-sm font-medium">Hide</button>
                    : <button onClick={() => setStatus(l.id, "available")} className="rounded-full bg-secondary px-3 py-1.5 text-sm font-medium">Make available</button>}
                  <button onClick={() => remove(l.id)} className="rounded-full bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}
