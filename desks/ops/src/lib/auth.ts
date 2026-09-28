import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isRole, type Role } from "@/lib/roles";

export type SessionProfile = {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: Role;
};

export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  if (!role || !isRole(role)) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name ?? null,
    role,
  };
}
