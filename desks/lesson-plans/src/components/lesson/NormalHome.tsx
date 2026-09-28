/**
 * NormalHome — the default teacher landing (outside Feedback Hour).
 *
 * A warm welcome, a prominent search entry (tap-through plus a quick search
 * box that GETs to /search), and the teacher's "next lessons" list.
 *
 * Default-export async Server Component, no props: it resolves the current
 * user itself via requireUser() (redirects to sign-in when unauthenticated).
 * Mobile-first.
 */
import { getTranslations } from "next-intl/server";

import { requireUser } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import UpcomingLessons from "@/components/lesson/UpcomingLessons";
import styles from "./NormalHome.module.css";

export default async function NormalHome() {
  const user = await requireUser();
  const t = await getTranslations("lpHome");

  // Prefer the first name for a friendlier greeting; fall back gracefully.
  const firstName = user.fullName?.trim().split(/\s+/)[0] ?? null;

  return (
    <main className={styles.home}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>{t("eyebrow")}</p>
        <h1 className={styles.greeting}>
          {firstName ? t("greetingNamed", { name: firstName }) : t("greeting")}
        </h1>
        <p className={styles.subtitle}>{t("subtitle")}</p>
      </header>

      <section className={styles.searchCard} aria-labelledby="search-heading">
        <h2 id="search-heading" className={styles.searchHeading}>
          {t("searchHeading")}
        </h2>

        {/* Quick search — a plain GET form so it works without JS. */}
        <form className={styles.searchForm} action="/search" method="get">
          <input
            type="search"
            name="q"
            className={styles.searchInput}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchAriaLabel")}
            autoComplete="off"
          />
          <button type="submit" className={styles.searchSubmit}>
            {t("searchSubmit")}
          </button>
        </form>

        <Link href="/search" className={styles.browseLink}>
          {t("browseAll")}
        </Link>
      </section>

      <UpcomingLessons />
    </main>
  );
}
