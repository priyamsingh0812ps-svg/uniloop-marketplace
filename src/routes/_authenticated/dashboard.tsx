import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Page, Loader, Avatar, VerifiedBadge, inputCls } from "@/components/site";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — UniLoop" },
      { name: "description", content: "Your UniLoop profile, verification status and activity." },
      { property: "og:title", content: "Dashboard — UniLoop" },
      { property: "og:description", content: "Manage your UniLoop account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user, profile, refreshProfile, loading } = useAuth();
  const [name, setName] = useState("");
  const [college, setCollege] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  useEffect(() => { if (profile) { setName(profile.full_name); setCollege(profile.college); } }, [profile]);

  if (loading || !user) return <Page><Loader /></Page>;
  if (!profile) return <Page><p className="py-20 text-center text-muted-foreground">Your profile isn't set up yet. Make sure the database setup script has been run, then refresh.</p></Page>;

  const save = async () => {
    if (name.trim().length < 2 || college.trim().length < 2) return toast.error("Name and college are required.");
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ full_name: name.trim(), college: college.trim() }).eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved"); refreshProfile();
  };

  const uploadAvatar = async (file: File) => {
    const path = `${user.id}/avatar-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("listing-images").upload(path, file);
    if (error) return toast.error(error.message);
    const url = supabase.storage.from("listing-images").getPublicUrl(path).data.publicUrl;
    await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
    refreshProfile();
  };

  const uploadIdCard = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5 MB.");
    setUploading(true);
    const path = `${user.id}/id-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("id-cards").upload(path, file);
    if (!error) await supabase.from("profiles").update({ id_card_url: path }).eq("id", user.id);
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("ID card submitted for review"); refreshProfile();
  };

  return (
    <Page>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft md:col-span-1">
          <label className="mx-auto block w-fit cursor-pointer" title="Change photo">
            <Avatar name={profile.full_name} url={profile.avatar_url} size={16} />
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
          </label>
          <p className="mt-3 text-center font-display text-xl font-bold">{profile.full_name || "Student"}</p>
          <p className="text-center text-sm text-muted-foreground">{profile.college}</p>
          <div className="mt-2 flex justify-center"><VerifiedBadge verified={profile.verified} status={profile.verification_status} /></div>
          <Link to="/u/$id" params={{ id: user.id }} className="mt-4 block text-center text-sm font-semibold text-accent">View public profile →</Link>
        </div>
        <div className="space-y-6 md:col-span-2">
          <div className="grid grid-cols-3 gap-3">
            {([["/my-listings", "My Listings"], ["/my-requests", "My Requests"], ["/messages", "Messages"]] as const).map(([to, l]) => (
              <Link key={to} to={to} className="rounded-2xl border border-border bg-card p-4 text-center text-sm font-semibold shadow-soft hover:border-accent">{l}</Link>
            ))}
          </div>
          {!profile.verified && (
            <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
              <h2 className="font-display text-lg font-bold">Get verified</h2>
              {profile.verification_status === "pending" ? (
                <p className="mt-1 text-sm text-muted-foreground">Your college ID card is pending review. We'll add your badge once it's approved.</p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-muted-foreground">Signed up without a college email? Upload a photo of your college ID card.</p>
                  <label className="btn-primary mt-4 cursor-pointer gap-2 px-5 py-2.5 text-sm">
                    <Upload className="h-4 w-4" />{uploading ? "Uploading…" : "Upload ID card"}
                    <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => e.target.files?.[0] && uploadIdCard(e.target.files[0])} />
                  </label>
                </>
              )}
            </div>
          )}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-lg font-bold">Edit profile</h2>
            <label className="mt-4 block text-sm font-medium">Full name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={`${inputCls} mt-1`} /></label>
            <label className="mt-4 block text-sm font-medium">College<input value={college} onChange={(e) => setCollege(e.target.value)} maxLength={120} placeholder="Type your college name" className={`${inputCls} mt-1`} /></label>
            <button onClick={save} disabled={busy} className="btn-primary mt-4 px-5 py-2.5 text-sm disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </div>
    </Page>
  );
}
