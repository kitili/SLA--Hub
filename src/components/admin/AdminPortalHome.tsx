"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import styles from "./admin.module.css";

/**
 * HR backend launcher — one app, two workspaces:
 * onboarding (content + member progress) and hiring (pipeline).
 */
export default function AdminPortalHome() {
  const t = useTranslations("admin.portal");

  const portals = [
    {
      href: "/admin/members",
      title: t("onboarding.title"),
      description: t("onboarding.description"),
      cta: t("onboarding.cta"),
      icon: "📚",
      links: [
        { href: "/admin/sections", label: t("onboarding.links.sections") },
        { href: "/admin/materials", label: t("onboarding.links.materials") },
        { href: "/admin/quizzes", label: t("onboarding.links.quizzes") },
        { href: "/admin/campuses", label: t("onboarding.links.campuses") },
        { href: "/admin/sla-bot", label: "SLA-bot alerts" },
      ],
    },
    {
      href: "/admin/hiring",
      title: t("hiring.title"),
      description: t("hiring.description"),
      cta: t("hiring.cta"),
      icon: "🧑‍💼",
      links: [
        { href: "/apply", label: "Public apply (/apply)" },
        { href: "/admin/hiring/candidates/new", label: "Add candidate" },
      ],
    },
  ] as const;

  return (
    <div className={styles.portalGrid}>
      {portals.map((portal) => (
        <article key={portal.href} className={styles.portalCard}>
          <span className={styles.portalIcon} aria-hidden="true">
            {portal.icon}
          </span>
          <h2>{portal.title}</h2>
          <p className={styles.muted}>{portal.description}</p>
          <Link href={portal.href} className={styles.portalCta}>
            {portal.cta} →
          </Link>
          {portal.links.length > 0 && (
            <ul className={styles.portalLinks}>
              {portal.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </div>
  );
}
