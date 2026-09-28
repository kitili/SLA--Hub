/**
 * Message-catalog integrity — pins the cross-file i18n contracts (docs/i18n.md):
 *
 *   1. en and sw ship the same catalog files with identical (recursive) key
 *      sets. English is the source of truth for which keys exist; other
 *      locales mirror its shape exactly.
 *   2. The files on disk are exactly the ones `src/i18n/request.ts` merges
 *      (listed in `src/i18n/catalogs.ts`), and no two files own the same
 *      top-level namespace — the merge is a shallow `Object.assign`, so a
 *      shared namespace would silently shadow one file's keys.
 *   3. Every namespace passed to `useTranslations()` / `getTranslations()` in
 *      `src/` resolves to an object in the merged English catalog, so a typo'd
 *      or deleted namespace fails here instead of rendering raw keys at
 *      runtime (missing messages don't throw in production).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { catalogFiles } from "@/i18n/catalogs";
import { routing } from "@/i18n/routing";

const MESSAGES_DIR = path.join(process.cwd(), "messages");
const SRC_DIR = path.join(process.cwd(), "src");

type Catalog = Record<string, unknown>;

function readCatalog(locale: string, file: string): Catalog {
  const raw = readFileSync(path.join(MESSAGES_DIR, locale, file), "utf8");
  return JSON.parse(raw) as Catalog;
}

function catalogFilesOnDisk(locale: string): string[] {
  return readdirSync(path.join(MESSAGES_DIR, locale))
    .filter((f) => f.endsWith(".json"))
    .sort();
}

/** Flatten a catalog into sorted dot-paths of every leaf (string) value. */
function leafPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Catalog).flatMap(([k, v]) =>
      leafPaths(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  // Catalogs hold only strings and nested objects — anything else is a bug.
  throw new Error(`unexpected ${typeof value} at "${prefix}"`);
}

const translationTargets = routing.locales.filter(
  (l) => l !== routing.defaultLocale,
);

describe("message catalogs", () => {
  it("every locale ships exactly the files request.ts merges", () => {
    const expected = [...catalogFiles].map((n) => `${n}.json`).sort();
    for (const locale of routing.locales) {
      expect(catalogFilesOnDisk(locale), `messages/${locale}`).toEqual(
        expected,
      );
    }
  });

  it("en and translated locales have identical key sets per catalog", () => {
    for (const file of catalogFilesOnDisk(routing.defaultLocale)) {
      const enKeys = leafPaths(readCatalog(routing.defaultLocale, file)).sort();
      for (const locale of translationTargets) {
        const locKeys = leafPaths(readCatalog(locale, file)).sort();
        expect(locKeys, `messages/${locale}/${file}`).toEqual(enKeys);
      }
    }
  });

  it("each top-level namespace is owned by exactly one catalog file", () => {
    const owners = new Map<string, string[]>();
    for (const file of catalogFilesOnDisk(routing.defaultLocale)) {
      for (const ns of Object.keys(readCatalog(routing.defaultLocale, file))) {
        owners.set(ns, [...(owners.get(ns) ?? []), file]);
      }
    }
    const shared = [...owners].filter(([, files]) => files.length > 1);
    expect(shared, "namespaces defined in more than one file").toEqual([]);
  });

  it("every t() namespace used in src/ exists in the merged catalog", () => {
    const merged: Catalog = Object.assign(
      {},
      ...catalogFiles.map((n) => readCatalog(routing.defaultLocale, `${n}.json`)),
    );

    const sourceFiles = (function walk(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) return walk(p);
        return /\.(ts|tsx)$/.test(entry.name) ? [p] : [];
      });
    })(SRC_DIR);

    const used = new Set<string>();
    const call = /\b(?:useTranslations|getTranslations)\(\s*["']([^"']+)["']/g;
    for (const file of sourceFiles) {
      for (const match of readFileSync(file, "utf8").matchAll(call)) {
        used.add(match[1]!);
      }
    }
    // Guard against the regex rotting: the app uses dozens of namespaces.
    expect(used.size).toBeGreaterThan(10);

    for (const namespace of used) {
      let node: unknown = merged;
      for (const segment of namespace.split(".")) {
        expect(
          node !== null && typeof node === "object" && segment in node,
          `namespace "${namespace}" is missing from the catalogs`,
        ).toBe(true);
        node = (node as Catalog)[segment];
      }
    }
  });
});
