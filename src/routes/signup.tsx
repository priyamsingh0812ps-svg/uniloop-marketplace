import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { Page, inputCls } from "@/components/site";
import { supabase } from "@/lib/supabase";
import { friendlyAuthError } from "@/lib/auth";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — UniLoop" },
      { name: "description", content: "Join UniLoop with your college email and get the Verified Student badge." },
      { property: "og:title", content: "Sign up — UniLoop" },
      { property: "og:description", content: "Join the student-only marketplace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Signup,
});

const isCollege = (e: string) => /\.(edu|ac\.in|edu\.in|ac\.[a-z]{2})$/i.test(e.trim());

function Signup() {
  const [f, setF] = useState({ name: "", college: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (f.name.trim().length < 2) return setErr("Please enter your full name.");
    if (f.college.trim().length < 2) return setErr("Please enter your college name.");
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return setErr("Please enter a valid email.");
    if (f.password.length < 8) return setErr("Password must be at least 8 characters.");
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { full_name: f.name.trim(), college: f.college.trim() } },
    });
    setBusy(false);
    if (error) return setErr(friendlyAuthError(error.message));
    setSent(true);
  };

  if (sent) return (
    <Page>
      <div className="mx-auto max-w-sm rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
        <MailCheck className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 font-display text-2xl font-bold">Check your inbox</h1>
        <p className="mt-2 text-sm text-muted-foreground">We sent a verification link to <b>{f.email}</b>. Click it, then log in.</p>
        {!isCollege(f.email) && <p className="mt-3 rounded-xl bg-accent/15 p-3 text-sm">You can use your personal email. Upload your college ID card from your Dashboard to get verified as a student.</p>}
        <Link to="/login" className="btn-primary mt-6 px-6 py-3">Go to login</Link>
      </div>
    </Page>
  );

  return (
    <Page>
      <form onSubmit={submit} className="mx-auto max-w-sm rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
        <h1 className="font-display text-3xl font-bold">Join UniLoop</h1>
        <p className="mt-1 text-sm text-muted-foreground">Use your college email to get the Verified Student badge.</p>
        {([["name", "Full name", "text"], ["college", "College name", "text"], ["email", "Email", "email"], ["password", "Password (8+ characters)", "password"]] as const).map(([k, label, type]) => (
          <label key={k} className="mt-4 block text-sm font-medium">{label}
            <input type={type} value={f[k]} onChange={set(k)} className={`${inputCls} mt-1`} />
          </label>
        ))}
        {f.email && !isCollege(f.email) && <p className="mt-2 text-xs text-muted-foreground">This doesn't look like a college email. You can still join and upload your college ID card later for review.</p>}
        {err && <p role="alert" className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
        <button disabled={busy} className="btn-primary mt-5 w-full gap-2 py-3 disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Create account</button>
        <p className="mt-4 text-center text-sm text-muted-foreground">Already have an account? <Link to="/login" className="font-semibold text-primary">Log in</Link></p>
      </form>
    </Page>
  );
}
