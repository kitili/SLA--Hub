import type { Locale } from "@/i18n/routing";

/**
 * Locale-aware resolver for **database content** (as opposed to UI chrome,
 * which lives in `messages/*.json` and is served by next-intl).
 *
 * Translatable content columns follow the `*_en` / `*_sw` convention: a logical
 * field `title` is stored as `title_en` and `title_sw`. This helper reads the
 * column for the requested locale and transparently falls back to the English
 * (`*_en`) source when the localized value is missing or empty — so a
 * half-translated row still renders.
 *
 * @example
 * ```ts
 * // row: { title_en: "Welcome", title_sw: "Karibu" }
 * resolveLocalized(row, "title", "sw"); // → "Karibu"
 * resolveLocalized(row, "title", "en"); // → "Welcome"
 *
 * // row: { title_en: "Welcome", title_sw: null }
 * resolveLocalized(row, "title", "sw"); // → "Welcome"  (EN fallback)
 * ```
 *
 * @param row    A record whose keys include `${field}_en` and `${field}_<locale>`.
 * @param field  Logical field name without the locale suffix (e.g. `"title"`).
 * @param locale Active locale from next-intl.
 * @returns The localized value, the English fallback, or `undefined` if neither
 *          column holds a non-empty value.
 *
 * @see docs/i18n-content.md
 */
export function resolveLocalized<
  Field extends string,
  Row extends Partial<Record<`${Field}_${Locale}`, string | null>>,
>(row: Row, field: Field, locale: Locale): string | undefined {
  const localized = row[`${field}_${locale}` as keyof Row] as
    | string
    | null
    | undefined;
  if (localized != null && localized !== "") {
    return localized;
  }

  const fallback = row[`${field}_en` as keyof Row] as
    | string
    | null
    | undefined;
  return fallback != null && fallback !== "" ? fallback : undefined;
}
