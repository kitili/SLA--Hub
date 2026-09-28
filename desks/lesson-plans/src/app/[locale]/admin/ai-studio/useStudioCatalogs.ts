"use client";

/**
 * Shared scheme bootstrap for the AI Studio clients.
 *
 * The single-plan Studio (`AiStudioClient`) and the batch client
 * (`BatchClient`) both need the scheme list on mount, so it is loaded here once
 * and the logic lives in one place.
 *
 * This used to load the model catalogue and prompt parts too. Both moved to the
 * Settings tab, which is a Server Component and loads them server-side — the
 * generation clients no longer know or send either.
 */
import { useCallback, useEffect, useState } from "react";

import { listSchemes } from "@/lib/actions/schemes";

import type { SchemeSummary } from "./types";

/**
 * Load the scheme catalogue on mount.
 *
 * `refreshSchemes` re-fetches the list (e.g. after a SOW upload).
 */
export function useStudioCatalogs(): {
  schemes: SchemeSummary[];
  refreshSchemes: () => Promise<void>;
} {
  const [schemes, setSchemes] = useState<SchemeSummary[]>([]);

  const refreshSchemes = useCallback(async () => {
    const res = await listSchemes();
    if (res.ok && res.schemes) {
      setSchemes(
        res.schemes.map((s) => ({
          id: s.id,
          title: s.title,
          grade: s.grade,
          gradeNum: s.gradeNum,
          subject: s.subject,
          term: s.term,
          rowCount: s.rowCount,
        })),
      );
    }
  }, []);

  useEffect(() => {
    void refreshSchemes();
  }, [refreshSchemes]);

  return { schemes, refreshSchemes };
}
