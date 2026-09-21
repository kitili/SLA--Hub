/**
 * ESM `resolve` hook: lets extensionless relative/absolute imports (e.g.
 * `./schema`, `../client`) resolve to their `.ts` / `/index.ts` files when run
 * under plain Node. Bare package specifiers (e.g. `drizzle-orm`) are left to the
 * default resolver. Only used by the db CLI scripts (migrate/seed).
 *
 * Dependency-free: `node:fs` + `node:url` only.
 */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const CANDIDATE_SUFFIXES = [".ts", ".mts", "/index.ts"];

export async function resolve(specifier, context, nextResolve) {
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
