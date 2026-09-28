import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveRole, type Role } from "@/lib/roles";

type AuthSuccess = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  role: Role | null;
};

type AuthFailure = {
  response: NextResponse;
};

export async function requireUser(
  allowedRoles?: Role[],
): Promise<AuthSuccess | AuthFailure> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = resolveRole(profile?.role, user.user_metadata?.role);

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { supabase, userId: user.id, role };
}
