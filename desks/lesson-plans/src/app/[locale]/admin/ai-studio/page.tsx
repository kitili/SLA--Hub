import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasApiKey } from "@/lib/ai/model";

import AiStudioClient from "./AiStudioClient";
import pageStyles from "./AiStudioPage.module.css";

/** Live, authenticated AI tooling — never prerender or cache. */
export const dynamic = "force-dynamic";

/**
 * AI Studio — single-plan generation.
 *
 * The admin layout already gates the `/admin/**` subtree; we re-assert
 * `requireAdmin` here defensively. The interactive form + streaming preview
 * live in the client component. We pass whether a key is configured so the UI
 * can show a friendly note up-front (the form still renders either way).
 *
 * A link to the batch-generation tool (`/admin/ai-studio/batch` — a foreground
 * client-driven pool, see docs/ai-studio.md) sits above the single-plan form.
 */
export default async function AiStudioPage() {
  await requireAdmin();
  const t = await getTranslations("lpStudio");

  return (
    <div className={pageStyles.wrap}>
      <div className={pageStyles.toolbar}>
        <Link href="/admin/ai-studio/batch" className={pageStyles.batchLink}>
          {t("batchLink")}
        </Link>
      </div>
      <AiStudioClient apiKeyConfigured={hasApiKey()} />
    </div>
  );
}
