import { getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/lib/auth";
import { Link, redirect } from "@/i18n/navigation";
import AdminNav from "@/components/admin/AdminNav";
import SlaBotWidget from "@/components/SlaBot";
import styles from "@/components/admin/admin.module.css";

/**
 * Admin pages are live, per-user and authenticated — never prerender or cache
 * them. `force-dynamic` also keeps the DB out of the build-time static pass.
 * (No `setRequestLocale` here: it opts into static rendering, which we don't
 * want for the admin subtree; the locale is still resolved per-request.)
 */
export const dynamic = "force-dynamic";

/**
 * Admin area gate + shell.
 *
 * Gating happens HERE so the whole `/[locale]/admin/**` subtree is protected by
 * a single check. We use `getCurrentUser()` + the locale-aware `redirect` (from
 * `@/i18n/navigation`) so a non-admin is sent to `/[locale]` (the member hub),
 * per spec — rather than `requireAdmin()`'s `/unauthorized` target which has no
 * page in this app yet.
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
    // Locale-aware redirect to the member hub root (`/[locale]`).
    redirect({ href: "/", locale });
  }

  const t = await getTranslations("admin");

  return (
    <div className={styles.shell}>
      <SlaBotWidget variant="admin" />
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandTitle}>{t("title")}</span>
          <span className={styles.brandSubtitle}>{t("subtitle")}</span>
        </div>
        <div className={styles.topbarRight}>
          <Link href="/" className={styles.backLink}>
            ← {t("nav.backToHub")}
          </Link>
        </div>
      </header>
      <div className={styles.body}>
        <AdminNav />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
