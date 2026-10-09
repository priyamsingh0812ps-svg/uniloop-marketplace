import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Page, inputCls } from "@/components/site";
import { supabase } from "@/lib/supabase";
import { friendlyAuthError } from "@/lib/auth";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password — UniLoop" },
      { name: "description", content: "Get a link to reset your UniLoop password." },
      { property: "og:title", content: "Reset password — UniLoop" },
      { property: "og:description", content: "Reset your UniLoop password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Forgot,
});

function Forgot() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (error) setErr(friendlyAuthError(error.message)); else setMsg("If that email has an account, a reset link is on its way.");
  };
  return (
    <Page>
      <form onSubmit={submit} className="mx-auto max-w-sm rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
        <h1 className="font-display text-2xl font-bold">Forgot password</h1>
        <input type="email" required placeholder="you@college.ac.in" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputCls} mt-5`} />
        {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
        {msg && <p className="mt-3 text-sm text-primary">{msg}</p>}
        <button disabled={busy} className="btn-primary mt-5 w-full py-3 disabled:opacity-60">{busy ? "Sending…" : "Send reset link"}</button>
        <Link to="/login" className="mt-4 block text-center text-sm text-primary">Back to login</Link>
      </form>
    </Page>
  );
}
