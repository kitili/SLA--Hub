/**
 * ESM `resolve` hook: lets the db CLI scripts run under plain Node even though
 * the source uses Next.js bundler-style imports. Two rewrites:
 *
 *   1. `@/x` (the tsconfig path alias) → `<repo>/src/x`, so db scripts use the
 *      same import style as the rest of src/.
 *   2. Extensionless relative/absolute imports (e.g. `./schema`, `../client`)
 *      → their `.ts` / `/index.ts` files.
 *
 * Bare package specifiers (e.g. `drizzle-orm`) are left to the default
 * resolver. Only used by the db CLI scripts (see the `db:run` npm script).
 *
 * Dependency-free: `node:fs` + `node:url` only.
 */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const CANDIDATE_SUFFIXES = [".ts", ".mts", "/index.ts"];

/** `src/` as a file URL — this hook file lives at src/lib/db/scripts/. */
const SRC_ROOT = new URL("../../../", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  // Rewrite the "@/" path alias (tsconfig `paths`) to its absolute file URL,
  // then let the extensionless-candidate logic below finish the job.
  if (specifier.startsWith("@/")) {
    specifier = new URL(specifier.slice(2), SRC_ROOT).href;
  }

  const isRelativeOrAbsolute =
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith("/") ||
    specifier.startsWith("file:");

  if (isRelativeOrAbsolute) {
    try {
      return await nextResolve(specifier, context);
    } catch (err) {
      // Resolve failed as-is; try TypeScript extensions.
      const base = context.parentURL ?? pathToFileURL(process.cwd() + "/").href;
      const resolvedUrl = new URL(specifier, base);
      const asPath = fileURLToPath(resolvedUrl);
      for (const suffix of CANDIDATE_SUFFIXES) {
        const candidate = asPath + suffix;
        if (existsSync(candidate)) {
          // Re-resolve the concrete `.ts` URL through the default resolver so
          // Node applies its built-in TypeScript loader (type stripping) based
          // on the file extension. Returning the URL with a forced `format`
          // here would skip stripping and break on `export type` etc.
          return await nextResolve(pathToFileURL(candidate).href, context);
        }
      }
      throw err;
    }
  }

  return nextResolve(specifier, context);
}
