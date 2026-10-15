import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Page, inputCls } from "@/components/site";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — UniLoop" },
      { name: "description", content: "Choose a new password for your UniLoop account." },
      { property: "og:title", content: "Set a new password — UniLoop" },
      { property: "og:description", content: "Choose a new UniLoop password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setErr("Password must be at least 8 characters.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(error.message.includes("session") ? "This reset link has expired. Request a new one." : error.message);
    toast.success("Password updated");
    nav({ to: "/browse" });
  };
  return (
    <Page>
      <form onSubmit={submit} className="mx-auto max-w-sm rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
        <h1 className="font-display text-2xl font-bold">Set a new password</h1>
        <input type="password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} className={`${inputCls} mt-5`} />
        {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
        <button disabled={busy} className="btn-primary mt-5 w-full py-3 disabled:opacity-60">{busy ? "Saving…" : "Save password"}</button>
      </form>
    </Page>
  );
}
