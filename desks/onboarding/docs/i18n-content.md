# Localized database content (`*_en` / `*_sw`)

next-intl message catalogs (see [`i18n.md`](./i18n.md)) cover **UI chrome** —
button labels, nav, static copy. **Content that lives in the database**
(section titles, document descriptions, quiz questions, …) is localized with a
different mechanism: per-locale columns plus an English fallback.

## Column convention

A logical, translatable field `X` is stored as one column per locale, suffixed
with the locale code:

| Logical field | Columns                         |
|---------------|---------------------------------|
| `title`       | `title_en`, `title_sw`          |
| `description` | `description_en`, `description_sw` |

Rules:

- **`*_en` is mandatory** and acts as the fallback for every other locale.
- `*_<locale>` for non-English locales is **optional / nullable** — a row may be
  only partially translated.
- Locale suffixes match the codes in `src/i18n/routing.ts` exactly (`en`, `sw`).
- Add a locale → add a `X_<locale>` column for each translatable field (a DB
  migration), then backfill where possible.

## Resolving at read time

Use [`resolveLocalized`](../src/lib/i18n-content.ts) to read the right column
for the active locale, with automatic EN fallback:

```ts
import { useLocale } from "next-intl";
import { resolveLocalized } from "@/lib/i18n-content";

const locale = useLocale();                       // "en" | "sw"
const title = resolveLocalized(section, "title", locale);
```

Resolution order:

1. `row[`${field}_${locale}`]` if it is a non-empty string.
2. else `row[`${field}_en`]` if it is a non-empty string.
3. else `undefined`.

This means a missing or empty Swahili value transparently falls back to English,
so a half-translated row still renders meaningfully.

## Why two mechanisms?

| Concern        | UI chrome (next-intl)        | DB content (`*_en`/`*_sw`)      |
|----------------|------------------------------|---------------------------------|
| Source of text | `messages/<locale>.json`     | database columns                |
| Who edits it   | developers (in the repo)     | content authors (via the app)   |
| Lookup         | `t("namespace.key")`         | `resolveLocalized(row, field, locale)` |
| Fallback       | next-intl default-locale     | explicit EN fallback in helper  |

Keeping content out of the message catalogs lets non-developers translate it
without code changes, while keeping fixed UI strings versioned with the code.
