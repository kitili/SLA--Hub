import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isRole, ROLE_HOME, type Role } from "@/lib/roles";
import { KitchenStaffShell } from "@/components/layout/KitchenStaffShell";

function canAccessKitchenStaff(role: Role) {
  return role === "admin" || role === "cook" || role === "head_of_kitchens";
}

export default async function KitchenStaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?next=/kitchen");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role && isRole(profile.role) ? profile.role : null;

  if (!role || !canAccessKitchenStaff(role)) {
    redirect(role ? ROLE_HOME[role] : "/login");
  }

  return <KitchenStaffShell>{children}</KitchenStaffShell>;
}
