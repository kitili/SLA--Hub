import type { ReactNode } from "react";

/**
 * Root layout.
 *
 * With next-intl's `[locale]` segment, the real document shell
 * (`<html lang>` + `<body>` + fonts + `NextIntlClientProvider`) lives in
 * `src/app/[locale]/layout.tsx`. Next.js still requires a root layout, so this
 * one only forwards its children — it intentionally renders no `<html>`/`<body>`
 * to avoid nesting two document shells.
 *
 * @see src/app/[locale]/layout.tsx
 * @see docs/i18n.md
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
