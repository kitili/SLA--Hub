import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isRole, ROLE_HOME, type Role } from "@/lib/roles";
import { AdminShell } from "@/components/layout/AdminShell";

function canAccessAdmin(role: Role) {
  return (
    role === "admin" ||
    role === "finance" ||
    role === "transport" ||
    role === "director" ||
    role === "farm" ||
    role === "ops_manager"
  );
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?next=/admin/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role && isRole(profile.role) ? profile.role : null;

  if (!role || !canAccessAdmin(role)) {
    redirect(role ? ROLE_HOME[role] : "/login");
  }

  return <AdminShell role={role}>{children}</AdminShell>;
}
