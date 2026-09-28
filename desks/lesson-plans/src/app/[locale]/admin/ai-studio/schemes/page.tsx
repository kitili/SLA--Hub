import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/auth";
import { listSchemes } from "@/lib/actions/schemes";

import SchemesClient from "./SchemesClient";

/** Live admin data — never prerender or cache. */
export const dynamic = "force-dynamic";

/**
 * Admin Schemes of Work listing page.
 *
 * Server side: gate with requireAdmin, load schemes list, pass to client.
 * All mutations (upload, create, edit, delete) live in the client component.
 */
export default async function AdminSchemesPage() {
  await requireAdmin();
  const t = await getTranslations("lpManage.schemes");

  const result = await listSchemes();
  const schemes = result.schemes ?? [];

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "0.75rem",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
        }}
      >
        <h1>{t("heading")}</h1>
        <span style={{ fontSize: "0.875rem", color: "var(--ink-muted)" }}>
          {t("count", { count: schemes.length })}
        </span>
      </div>

      {!result.ok ? (
        <p style={{ color: "var(--ink-muted)", marginBottom: "1rem" }}>
          {t("errorGeneric")}
        </p>
      ) : null}

      <SchemesClient initialSchemes={schemes} />
    </div>
  );
}
