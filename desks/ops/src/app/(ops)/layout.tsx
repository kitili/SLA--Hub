import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isRole, ROLE_HOME, type Role } from "@/lib/roles";
import { OpsShell } from "@/components/layout/OpsShell";

function canAccessOps(role: Role) {
  return (
    role === "admin" ||
    role === "finance" ||
    role === "ops_manager" ||
    role === "finance_manager" ||
    role === "cfo"
  );
}

export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?next=/ops");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role && isRole(profile.role) ? profile.role : null;

  if (!role || !canAccessOps(role)) {
    redirect(role ? ROLE_HOME[role] : "/login");
  }

  return <OpsShell role={role}>{children}</OpsShell>;
}
