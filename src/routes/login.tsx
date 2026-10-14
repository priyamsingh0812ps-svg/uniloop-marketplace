import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Page, inputCls } from "@/components/site";
import { supabase } from "@/lib/supabase";
import { friendlyAuthError, safeRedirect } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string | undefined } => ({ redirect: typeof s.redirect === "string" ? s.redirect : undefined }),
  head: () => ({
    meta: [
      { title: "Log in — UniLoop" },
      { name: "description", content: "Log in to UniLoop to buy, rent, sell and exchange with students on your campus." },
      { property: "og:title", content: "Log in — UniLoop" },
      { property: "og:description", content: "Welcome back to your campus marketplace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const { redirect } = Route.useSearch();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!email.includes("@") || password.length < 6) return setErr("Enter your email and password (at least 6 characters).");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setErr(friendlyAuthError(error.message));
    router.history.push(safeRedirect(redirect));
  };

  return (
    <Page>
      <form onSubmit={submit} className="mx-auto max-w-sm rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
        <h1 className="font-display text-3xl font-bold">Log in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Welcome back to the loop.</p>
        <label className="mt-6 block text-sm font-medium">Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputCls} mt-1`} autoComplete="email" />
        </label>
        <label className="mt-4 block text-sm font-medium">Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputCls} mt-1`} autoComplete="current-password" />
        </label>
        <div className="mt-2 text-right"><Link to="/forgot-password" className="text-sm font-medium text-primary">Forgot password?</Link></div>
        {err && <p role="alert" className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
        <button disabled={busy} className="btn-primary mt-5 w-full gap-2 py-3 disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Log in</button>
        <p className="mt-4 text-center text-sm text-muted-foreground">New here? <Link to="/signup" className="font-semibold text-primary">Create an account</Link></p>
      </form>
    </Page>
  );
}
