import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { resolveRole, ROLE_HOME, roleCanAccess, type Role } from "@/lib/roles";

const ALLOWED_DOMAIN = "silverleaf.co.tz";

function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

/**
 * OAuth PKCE callback for Google (and any future providers).
 * Exchanges ?code= for a session, then enforces @silverleaf.co.tz.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = (user?.email ?? "").toLowerCase();
  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=domain`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .maybeSingle();

  const role = resolveRole(profile?.role, user?.user_metadata?.role);
  if (!role) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/?error=role`);
  }
  const home = ROLE_HOME[role];
  const destination =
    next && roleCanAccess(role, next) ? next : home;

  return NextResponse.redirect(`${origin}${destination}`);
}
