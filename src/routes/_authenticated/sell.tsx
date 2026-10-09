import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Page, inputCls, Loader } from "@/components/site";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { CAMPUSES, CATEGORIES, CONDITIONS, type Category, type Mode } from "@/lib/listings";

export const Route = createFileRoute("/_authenticated/sell")({
  validateSearch: (s: Record<string, unknown>): { edit?: string | undefined } => ({ edit: typeof s.edit === "string" ? s.edit : undefined }),
  head: () => ({
    meta: [
      { title: "Sell an item — UniLoop" },
      { name: "description", content: "List an item to sell, rent or exchange with students on your campus." },
      { property: "og:title", content: "Sell an item — UniLoop" },
      { property: "og:description", content: "List your item in a minute." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Sell,
});

const empty = { title: "", description: "", category: "books" as Category, condition: "Good", mode: "buy" as Mode, price: "", rent_period: "day", campus: CAMPUSES[0] };

function Sell() {
  const { edit } = Route.useSearch();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState(empty);
  const [images, setImages] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!edit);

  useEffect(() => {
    if (!edit) return;
    supabase.from("listings").select("*").eq("id", edit).maybeSingle().then(({ data }) => {
      if (data) {
        setF({ title: data.title, description: data.description, category: data.category, condition: data.condition, mode: data.mode, price: String(data.price), rent_period: data.rent_period ?? "day", campus: data.campus });
        setImages(data.images ?? []);
      } else setErr("Couldn't load this listing.");
      setLoading(false);
    });
  }, [edit]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const total = images.length + files.length;

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []).filter((x) => x.type.startsWith("image/"));
    const big = list.find((x) => x.size > 5 * 1024 * 1024);
    if (big) return toast.error("Each photo must be under 5 MB.");
    setFiles((p) => [...p, ...list].slice(0, 5 - images.length));
    e.target.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const price = Number(f.price || 0);
    if (f.title.trim().length < 3) return setErr("Title must be at least 3 characters.");
    if (f.description.trim().length < 10) return setErr("Description must be at least 10 characters.");
    if (f.mode !== "exchange" && (!price || price <= 0)) return setErr("Enter a price greater than 0.");
    if (total === 0) return setErr("Add at least one photo.");
    if (!user) return;
    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const path = `${user.id}/${crypto.randomUUID()}.${file.name.split(".").pop() || "jpg"}`;
        const { error } = await supabase.storage.from("listing-images").upload(path, file);
        if (error) throw new Error(`Photo upload failed: ${error.message}`);
        uploaded.push(supabase.storage.from("listing-images").getPublicUrl(path).data.publicUrl);
      }
      const all = [...images, ...uploaded];
      const row = {
        title: f.title.trim(), description: f.description.trim(), category: f.category, condition: f.condition, mode: f.mode,
        price: f.mode === "exchange" ? 0 : price, rent_period: f.mode === "rent" ? f.rent_period : null, campus: f.campus,
        images: all, image_url: all[0],
      };
      const res = edit
        ? await supabase.from("listings").update(row).eq("id", edit).select("id").single()
        : await supabase.from("listings").insert({ ...row, seller_id: user.id }).select("id").single();
      if (res.error) throw new Error(res.error.message);
      await qc.invalidateQueries({ queryKey: ["listings"] });
      qc.invalidateQueries({ queryKey: ["listing", res.data.id] });
      toast.success(edit ? "Listing updated!" : "Your item is live on Browse!");
      nav({ to: "/item/$id", params: { id: res.data.id } });
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Couldn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Page><Loader /></Page>;

  return (
    <Page>
      <form onSubmit={submit} className="mx-auto max-w-2xl space-y-5">
        <h1 className="font-display text-3xl font-bold">{edit ? "Edit listing" : "Sell an item"}</h1>
        <div>
          <p className="text-sm font-medium">Photos ({total}/5)</p>
          <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-5">
            {images.map((src) => (
              <div key={src} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => setImages(images.filter((x) => x !== src))} className="absolute right-1 top-1 rounded-full bg-card p-1" aria-label="Remove photo"><X className="h-3 w-3" /></button>
              </div>
            ))}
            {files.map((file, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-card p-1" aria-label="Remove photo"><X className="h-3 w-3" /></button>
              </div>
            ))}
            {total < 5 && (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-xs text-muted-foreground hover:border-primary">
                <ImagePlus className="h-6 w-6 text-primary" />Add
                <input type="file" accept="image/*" multiple className="hidden" onChange={pick} />
              </label>
            )}
          </div>
        </div>
        <label className="block text-sm font-medium">Title<input value={f.title} onChange={set("title")} maxLength={100} className={`${inputCls} mt-1`} placeholder="e.g. Casio fx-991EX calculator" /></label>
        <label className="block text-sm font-medium">Description<textarea value={f.description} onChange={set("description")} maxLength={2000} rows={4} className={`${inputCls} mt-1`} placeholder="Condition, what's included, pickup spot…" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">Category<select value={f.category} onChange={set("category")} className={`${inputCls} mt-1`}>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
          <label className="block text-sm font-medium">Condition<select value={f.condition} onChange={set("condition")} className={`${inputCls} mt-1`}>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="block text-sm font-medium">Campus<select value={f.campus} onChange={set("campus")} className={`${inputCls} mt-1`}>{CAMPUSES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <div className="text-sm font-medium">Listing type
            <div className="mt-1 grid grid-cols-3 gap-2">
              {(["buy", "rent", "exchange"] as const).map((m) => (
                <button type="button" key={m} onClick={() => setF({ ...f, mode: m })} className={`rounded-xl py-2.5 text-sm font-semibold capitalize ${f.mode === m ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{m === "buy" ? "Sell" : m}</button>
              ))}
            </div>
          </div>
        </div>
        {f.mode !== "exchange" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">{f.mode === "rent" ? "Rent (₹)" : "Price (₹)"}<input type="number" min={1} value={f.price} onChange={set("price")} className={`${inputCls} mt-1`} /></label>
            {f.mode === "rent" && <label className="block text-sm font-medium">Per<select value={f.rent_period} onChange={set("rent_period")} className={`${inputCls} mt-1`}><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label>}
          </div>
        )}
        {err && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
        <button disabled={busy} className="btn-accent w-full gap-2 py-3.5 disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{edit ? "Save changes" : "Publish listing"}</button>
      </form>
    </Page>
  );
}
