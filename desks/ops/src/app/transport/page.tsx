import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/app/login/LoginForm";
import { isRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

/**
 * Transport entry from the Ops hub.
 * Signed-in admin/finance go to the full admin shell (all tabs).
 * Everyone else sees transport sign-in.
 */
export default async function TransportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    role = profile?.role && isRole(profile.role) ? profile.role : null;
  }

  if (role === "admin" || role === "finance" || role === "transport") {
    redirect("/admin/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
            Transport dashboard
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">
            Sign in to continue
          </h1>
        </div>
        <Link
          href="/ops"
          className="text-sm font-semibold text-electric-blue no-underline hover:underline"
        >
          ← Dashboards
        </Link>
      </div>

      {user ? (
        <p className="mb-4 rounded-[var(--radius-sm)] border border-gold/40 bg-gold-15 px-4 py-3 text-sm text-ink-muted">
          This dashboard needs a transport, finance, or SLT admin account.
        </p>
      ) : null}

      <Suspense fallback={<p className="text-ink-muted">Loading sign-in…</p>}>
        <LoginForm
          embedded
          redirectTo="/admin/dashboard"
          title="Transport sign-in"
          subtitle="Baraka or Shikunzi — opens the transport admin tabs."
        />
      </Suspense>
    </main>
  );
}
