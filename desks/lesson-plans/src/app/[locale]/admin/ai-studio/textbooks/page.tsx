import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/auth";
import { listTextbooks } from "@/lib/actions/textbooks";

import TextbooksClient from "./TextbooksClient";

/** Live admin data — never prerender or cache. */
export const dynamic = "force-dynamic";

/**
 * Admin Textbooks listing page.
 *
 * Server side: gate with requireAdmin, load textbooks list, pass to client.
 * All mutations (upload, detail, edit, delete) live in the client component.
 */
export default async function AdminTextbooksPage() {
  await requireAdmin();
  const t = await getTranslations("lpManage.textbooks");

  const result = await listTextbooks();
  const textbooks = result.textbooks ?? [];

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
          {t("count", { count: textbooks.length })}
        </span>
      </div>

      {!result.ok ? (
        <p style={{ color: "var(--ink-muted)", marginBottom: "1rem" }}>
          {t("errorGeneric")}
        </p>
      ) : null}

      <TextbooksClient initialTextbooks={textbooks} />
    </div>
  );
}
