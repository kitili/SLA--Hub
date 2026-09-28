import { requireAdmin } from "@/lib/auth";
import { hasApiKey } from "@/lib/ai/model";

import BatchClient from "./BatchClient";

/** Live, authenticated AI tooling — never prerender or cache. */
export const dynamic = "force-dynamic";

/**
 * AI Studio — batch generation.
 *
 * Pick a scheme of work, choose which of its lessons to generate, and run them
 * through a foreground bounded-concurrency pool (one `POST /api/ai/batch/lesson`
 * per lesson) that reuses the v2 single-generation pipeline. The admin layout
 * already gates `/admin/**`; we re-assert `requireAdmin` defensively. We pass
 * whether a key is configured so the UI can say so up-front.
 *
 * The model and prompts are not chosen here — they are admin settings
 * (AI Studio → Settings) that the batch route resolves server-side.
 */
export default async function AiStudioBatchPage() {
  await requireAdmin();

  return <BatchClient apiKeyConfigured={hasApiKey()} />;
}
