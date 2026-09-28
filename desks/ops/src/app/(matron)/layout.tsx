import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isRole, ROLE_HOME, type Role } from "@/lib/roles";
import { MatronShell } from "@/components/layout/MatronShell";

export const metadata: Metadata = {
  title: "Matron · Silverleaf",
  manifest: "/matron-manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SL Matron",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#002368",
};

function canAccessMatron(role: Role) {
  // One field app: boarding + GPS path. Legacy driver logins land here.
  return role === "matron" || role === "admin" || role === "driver";
}

export default async function MatronLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?next=/matron");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role && isRole(profile.role) ? profile.role : null;

  if (!role || !canAccessMatron(role)) {
    redirect(role ? ROLE_HOME[role] : "/login");
  }

  return <MatronShell>{children}</MatronShell>;
}
