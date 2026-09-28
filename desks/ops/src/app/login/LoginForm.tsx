"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ROLE_HOME,
  resolveRole,
  roleCanAccess,
  type Role,
} from "@/lib/roles";
import { brand } from "@/lib/brand";

function oauthErrorMessage(code: string | null): string | null {
  if (code === "domain") {
    return "Only @silverleaf.co.tz Google accounts can sign in.";
  }
  if (code === "oauth") {
    return "Google sign-in failed. Try again or use email/password.";
  }
  if (code === "role") {
    return "Your account has no Ops role yet. Ask Kai to set profiles.role (e.g. ops_manager for Kusaduka), then sign in again.";
  }
  return null;
}

type LoginFormProps = {
  /** Prefer this path after login when the role can access it. */
  redirectTo?: string;
  /** Compact panel for embedding inside a dashboard page. */
  embedded?: boolean;
  title?: string;
  subtitle?: string;
};

export function LoginForm({
  redirectTo,
  embedded = false,
  title = brand.name,
  subtitle = "Staff Management System",
}: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = redirectTo || searchParams.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    oauthErrorMessage(searchParams.get("error")),
  );
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  function resolveDestination(role: Role) {
    const home = ROLE_HOME[role];
    const requested =
      next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    return requested && roleCanAccess(role, requested) ? requested : home;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword(
        { email, password },
      );

      if (signInError) {
        setError(signInError.message);
        return;
      }

      const userId = data.user?.id;
      if (!userId) {
        setError("No user returned");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      const role = resolveRole(
        profile?.role,
        data.user?.user_metadata?.role,
      );

      if (!role) {
        setError(
          profileError?.message?.toLowerCase().includes("recursion")
            ? "Profile policy error — run supabase/fix_profiles_rls.sql in Supabase."
            : "No role on your profile. Ask Kai to set profiles.role (ops_manager, admin, matron, etc.), then try again.",
        );
        return;
      }

      router.push(resolveDestination(role));
      router.refresh();
    } catch {
      setError(
        "Login failed. Check NEXT_PUBLIC_SUPABASE_URL and anon key in .env.local",
      );
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleSignIn() {
    setGoogleLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const requested =
        next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      const callback = requested
        ? `${origin}/auth/callback?next=${encodeURIComponent(requested)}`
        : `${origin}/auth/callback`;

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callback,
          queryParams: {
            hd: "silverleaf.co.tz",
            prompt: "select_account",
          },
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        setGoogleLoading(false);
      }
    } catch {
      setError("Google sign-in failed. Check Supabase Google provider setup.");
      setGoogleLoading(false);
    }
  }

  const panel = (
    <div
      className={`ui-rise w-full max-w-[420px] rounded-2xl bg-white px-8 py-10 text-center shadow-[0_20px_60px_rgba(0,35,104,0.18)] sm:px-10 sm:py-12 ${
        embedded ? "border border-card-border shadow-[var(--shadow-lg)]" : ""
      }`}
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.15rem] bg-electric-blue shadow-[0_10px_28px_rgba(0,35,104,0.28)]">
        <Image
          src={brand.logos.logomarkWhite}
          alt=""
          width={40}
          height={42}
          className="h-10 w-auto"
          priority
        />
      </div>

      <h1 className="mt-6 font-display text-[1.65rem] font-extrabold tracking-tight text-electric-blue sm:text-[1.85rem]">
        {title}
      </h1>
      <p className="mt-1.5 text-[0.95rem] text-ink-muted">{subtitle}</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4 text-left">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-electric-blue">Email Address</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-[#d8dee8] bg-[#f7f9fc] px-3.5 py-3 text-ink outline-none transition placeholder:text-ink-faint focus:border-light-blue focus:bg-white focus:ring-[3px] focus:ring-[rgba(255,201,82,0.35)]"
            placeholder="yourname@silverleaf.co.tz"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-electric-blue">Password</span>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[#d8dee8] bg-[#f7f9fc] px-3.5 py-3 pr-11 text-ink outline-none transition placeholder:text-ink-faint focus:border-light-blue focus:bg-white focus:ring-[3px] focus:ring-[rgba(255,201,82,0.35)]"
              placeholder="Enter your password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-faint transition hover:text-electric-blue"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOffIcon />
              ) : (
                <EyeIcon />
              )}
            </button>
          </div>
        </label>

        {error ? (
          <p
            className="rounded-lg bg-danger-15 px-3 py-2 text-sm text-danger"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="mt-1 flex min-h-12 w-full items-center justify-center rounded-lg bg-electric-blue px-4 text-base font-bold text-white shadow-[0_10px_24px_rgba(0,35,104,0.25)] transition hover:bg-navy-light disabled:cursor-wait disabled:opacity-70"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        <span className="h-px flex-1 bg-[#e4e9f0]" />
        or
        <span className="h-px flex-1 bg-[#e4e9f0]" />
      </div>

      <button
        type="button"
        onClick={onGoogleSignIn}
        disabled={loading || googleLoading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#d8dee8] bg-white px-3 py-2.5 text-sm font-semibold text-ink transition hover:border-light-blue hover:bg-[#f7f9fc] disabled:cursor-wait disabled:opacity-70"
      >
        {googleLoading ? "Redirecting to Google…" : "Continue with Google"}
      </button>

      <p className="mt-7 text-center text-[0.78rem] leading-relaxed text-ink-muted">
        New accounts sign in with the temporary password issued by their
        administrator, and will be prompted to change it on first login.
      </p>
      <p className="mt-3 text-center text-[0.78rem]">
        <a
          href="/get-driver"
          className="font-semibold text-electric-blue no-underline hover:underline"
        >
          Download Driver Android app (APK)
        </a>
      </p>
    </div>
  );

  if (embedded) {
    return <div className="relative mx-auto w-full max-w-[420px]">{panel}</div>;
  }

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[#001a4d] px-4 py-10 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_480px_at_15%_10%,rgba(128,191,236,0.28),transparent_55%),radial-gradient(700px_420px_at_90%_90%,rgba(255,201,82,0.16),transparent_50%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-light-blue/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-10 h-64 w-64 rounded-full bg-gold/20 blur-3xl"
      />
      {panel}
    </main>
  );
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 3l18 18M10.5 10.7a2.5 2.5 0 003.3 3.3M9.9 5.6A10.4 10.4 0 0112 5c6.5 0 10 7 10 7a18.3 18.3 0 01-4.2 4.8M6.1 6.3A18.1 18.1 0 002 12s3.5 7 10 7c1.4 0 2.7-.3 3.9-.8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
