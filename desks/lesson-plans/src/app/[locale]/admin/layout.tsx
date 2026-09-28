import { getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import AdminShell from "@/components/admin/AdminShell";

/**
 * Admin pages are live, per-user and authenticated — never prerender or cache.
 * `force-dynamic` also keeps the DB out of the build-time static pass.
 */
export const dynamic = "force-dynamic";

/**
 * Admin area gate + shell.
 *
 * Gating happens HERE so the whole `/[locale]/admin/**` subtree is protected by
 * a single check. A non-admin is sent to `/[locale]` (the teacher home) via the
 * locale-aware redirect. The modern chrome — navy sidebar, content top-bar and
 * mobile drawer — lives in the client {@link @/components/admin/AdminShell}.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    redirect({ href: "/", locale });
  }
  // `redirect` throws, so control only reaches here for an authenticated admin;
  // assert non-null since the i18n redirect isn't typed as `never`.
  const admin = user!;

  const t = await getTranslations("admin");

  const userName =
    admin.fullName?.trim() || admin.email.split("@")[0] || admin.email;
  const roleLabel = admin.jobTitle?.trim() || t("title");

  return (
    <AdminShell userName={userName} roleLabel={roleLabel}>
      {children}
    </AdminShell>
  );
}
