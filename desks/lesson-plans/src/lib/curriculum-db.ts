import "server-only";

import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";
import { neon } from "@neondatabase/serverless";
import { env } from "@/lib/env";

setDefaultAutoSelectFamilyAttemptTimeout(10_000);

export function curriculumSql() {
  const url = env.CURRICULUM_DATABASE_URL;
  if (!url) return null;
  return neon(url);
}
