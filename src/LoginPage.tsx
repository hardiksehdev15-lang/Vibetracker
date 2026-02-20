/**
 * LoginPage.tsx
 *
 * FIX 1: Proper sign-in / sign-up with two clearly separated forms.
 * - "Sign In" tab  → email + password → signInWithPassword()
 * - "Create Account" tab → email + password + confirm → signUp()
 * - Friendly error messages (no raw Supabase text shown to users)
 * - Handles email-confirmation flow gracefully
 *
 * IMPORTANT — if you see "Anonymous sign-ins are disabled":
 *   Supabase Dashboard → Authentication → Providers → Email
 *   → toggle "Enable Email Signup" ON → Save
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";

type Mode = "signin" | "signup";

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-20" cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function mapError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid credentials"))
    return "Incorrect email or password. Please try again.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email address first — check your inbox.";
  if (m.includes("user already registered") || m.includes("already exists"))
    return "An account with this email already exists. Try signing in instead.";
  if (m.includes("anonymous") || m.includes("signups not allowed") || m.includes("signup is disabled"))
    return "Account registration is disabled. Go to Supabase Dashboard → Authentication → Providers → Email → enable \"Email Signup\".";
  if (m.includes("password") && (m.includes("weak") || m.includes("short") || m.includes("least")))
    return "Password is too weak. Use at least 8 characters.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts — please wait a moment and try again.";
  if (m.includes("fetch") || m.includes("network") || m.includes("timeout"))
    return "Network error. Check your connection and try again.";
  if (process.env.NODE_ENV === "development") return `Auth error: ${msg}`;
  return "Something went wrong. Please try again.";
}

const INPUT = [
  "w-full rounded-xl border bg-white/5 px-4 py-3 text-sm text-white",
  "placeholder-white/30 outline-none transition-all",
  "focus:border-orange-400/60 focus:ring-2 focus:ring-orange-400/15",
  "disabled:opacity-40 disabled:cursor-not-allowed",
].join(" ");

const BTN_PRIMARY = [
  "w-full flex items-center justify-center gap-2 rounded-xl",
  "bg-orange-500 hover:bg-orange-400 active:scale-[0.98]",
  "py-3.5 text-sm font-bold text-white transition-all",
  "disabled:opacity-40 disabled:cursor-not-allowed",
].join(" ");

export default function LoginPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  // Preserve the page the user was trying to visit
  const from = (location.state as any)?.from?.pathname ?? "/";

  const [mode, setMode]         = useState<Mode>("signin");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [checkEmail, setCheckEmail] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);

  // If already logged in, skip straight to dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate(from, { replace: true });
    });
  }, []);

  // Clear errors and focus email when switching tabs
  useEffect(() => {
    setError("");
    setCheckEmail(false);
    emailRef.current?.focus();
  }, [mode]);

  // ── Sign In ────────────────────────────────────────────────────────────────
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Please enter your email."); return; }
    if (!password)     { setError("Please enter your password."); return; }
    setError(""); setLoading(true);

    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);
    if (err)           { setError(mapError(err.message)); return; }
    if (data.session)  navigate(from, { replace: true });
  }

  // ── Sign Up ────────────────────────────────────────────────────────────────
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) { setError("Please enter your email."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address."); return;
    }
    if (!password)              { setError("Please enter a password."); return; }
    if (password.length < 8)    { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm)   { setError("Passwords do not match."); return; }
    setError(""); setLoading(true);

    const { data, error: err } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: { emailRedirectTo: window.location.origin },
    });

    setLoading(false);
    if (err) { setError(mapError(err.message)); return; }

    if (data.session) {
      // Email confirmation disabled in Supabase → instant login
      navigate(from, { replace: true });
    } else {
      // Email confirmation required → show instruction screen
      setCheckEmail(true);
    }
  }

  // ── Email confirmation screen ──────────────────────────────────────────────
  if (checkEmail) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl
            border border-white/10 bg-white/5 text-3xl">✉️</div>
          <div>
            <h2 className="text-lg font-bold text-white">Check your inbox</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              We sent a confirmation link to{" "}
              <span className="font-semibold text-white/80">{email}</span>.
              <br />Click it to activate your account, then come back to sign in.
            </p>
          </div>
          <button
            onClick={() => { setCheckEmail(false); setMode("signin"); }}
            className="text-sm text-orange-400 underline underline-offset-4
              hover:text-orange-300 transition-colors"
          >
            Back to sign in
          </button>
        </div>
      </Shell>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <Shell>
      {/* Mode tabs */}
      <div className="flex rounded-xl bg-white/5 p-1 mb-6 gap-1">
        {(["signin", "signup"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={[
              "flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
              mode === m
                ? "bg-orange-500 text-white shadow-lg"
                : "text-white/35 hover:text-white/70",
            ].join(" ")}
          >
            {m === "signin" ? "Sign In" : "Create Account"}
          </button>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div role="alert" aria-live="polite"
          className="mb-4 rounded-xl border border-red-400/25 bg-red-400/8
            px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* ── SIGN IN FORM ── */}
      {mode === "signin" && (
        <form onSubmit={handleSignIn} noValidate className="flex flex-col gap-4">
          <div>
            <label htmlFor="si-email"
              className="block mb-1.5 text-xs font-semibold uppercase tracking-widest text-white/50">
              Email
            </label>
            <input ref={emailRef} id="si-email" type="email"
              value={email} onChange={e => { setEmail(e.target.value); setError(""); }}
              disabled={loading} autoComplete="email" placeholder="you@example.com"
              className={`${INPUT} border-white/10 hover:border-white/20`} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="si-pass"
                className="text-xs font-semibold uppercase tracking-widest text-white/50">
                Password
              </label>
              <span className="text-xs text-white/30">Forgot? (coming soon)</span>
            </div>
            <input id="si-pass" type="password"
              value={password} onChange={e => { setPassword(e.target.value); setError(""); }}
              disabled={loading} autoComplete="current-password" placeholder="••••••••"
              className={`${INPUT} border-white/10 hover:border-white/20`} />
          </div>

          <button type="submit" disabled={loading} className={BTN_PRIMARY}>
            {loading ? <><Spinner /> Signing in…</> : "Sign In →"}
          </button>

          <p className="text-center text-xs text-white/30">
            No account?{" "}
            <button type="button" onClick={() => setMode("signup")}
              className="text-orange-400 underline underline-offset-2 hover:text-orange-300">
              Create one
            </button>
          </p>
        </form>
      )}

      {/* ── SIGN UP FORM ── separate from sign-in, never merged ── */}
      {mode === "signup" && (
        <form onSubmit={handleSignUp} noValidate className="flex flex-col gap-4">
          <div>
            <label htmlFor="su-email"
              className="block mb-1.5 text-xs font-semibold uppercase tracking-widest text-white/50">
              Email
            </label>
            <input ref={emailRef} id="su-email" type="email"
              value={email} onChange={e => { setEmail(e.target.value); setError(""); }}
              disabled={loading} autoComplete="email" placeholder="you@example.com"
              className={`${INPUT} border-white/10 hover:border-white/20`} />
          </div>

          <div>
            <label htmlFor="su-pass"
              className="block mb-1.5 text-xs font-semibold uppercase tracking-widest text-white/50">
              Password{" "}
              <span className="normal-case font-normal text-white/25">(min 8 chars)</span>
            </label>
            <input id="su-pass" type="password"
              value={password} onChange={e => { setPassword(e.target.value); setError(""); }}
              disabled={loading} autoComplete="new-password" placeholder="••••••••"
              className={`${INPUT} border-white/10 hover:border-white/20`} />
          </div>

          <div>
            <label htmlFor="su-confirm"
              className="block mb-1.5 text-xs font-semibold uppercase tracking-widest text-white/50">
              Confirm Password
            </label>
            <input id="su-confirm" type="password"
              value={confirm} onChange={e => { setConfirm(e.target.value); setError(""); }}
              disabled={loading} autoComplete="new-password" placeholder="••••••••"
              className={`${INPUT} border-white/10 hover:border-white/20`} />
          </div>

          {/* Supabase settings hint */}
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5
            px-3 py-2.5 text-xs text-amber-300/80 leading-relaxed">
            <strong className="block mb-0.5 text-amber-300">Before registering:</strong>
            Make sure <em>Enable Email Signup</em> is <strong>ON</strong> in{" "}
            Supabase → Authentication → Providers → Email.
          </div>

          <button type="submit" disabled={loading} className={BTN_PRIMARY}>
            {loading ? <><Spinner /> Creating account…</> : "Create Account →"}
          </button>

          <p className="text-center text-xs text-white/30">
            Already have an account?{" "}
            <button type="button" onClick={() => setMode("signin")}
              className="text-orange-400 underline underline-offset-2 hover:text-orange-300">
              Sign in
            </button>
          </p>
        </form>
      )}
    </Shell>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-tight text-white"
            style={{ fontFamily: "'Courier New', monospace", letterSpacing: "-0.03em" }}>
            Vibe<span className="text-orange-400">Tracker</span>
          </h1>
          <p className="text-sm text-white/35 mt-1">accountability, daily</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-7
          shadow-2xl backdrop-blur-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
