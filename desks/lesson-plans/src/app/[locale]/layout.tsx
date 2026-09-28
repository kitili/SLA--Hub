import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import Image from "next/image";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth";
import { brand } from "@/lib/brand";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import LogoutButton from "@/components/LogoutButton";
import AdminNavLink from "@/components/AdminNavLink";
import "../globals.css";

/**
 * Silverleaf brand font — loaded via next/font/google (no external @import).
 * The className is applied to <body> so the CSS variable --font-sans resolves
 * to the font-face Next.js inlines at build time.
 *
 * Weights match legacy/client/src/index.css (300 400 600 700 800).
 */
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Silverleaf Lesson Plans",
  description: "Silverleaf Academy — find and manage lesson plans",
};

/**
 * Mobile viewport. Next.js injects a sensible default, but we declare it
 * explicitly to lock in `width=device-width, initial-scale=1` and — crucially —
 * leave zoom unrestricted (no `maximum-scale`/`user-scalable`) so the layout
 * stays accessible to users who pinch-zoom.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * Pre-render a static page per locale (`/en`, `/sw`) at build time.
 * @see docs/i18n.md
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  // Validate the dynamic segment — unknown locales (the segment acts as a
  // catch-all for unmatched paths) must 404 rather than render an empty shell.
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Opt this request's Server Components into static rendering for `locale`.
  setRequestLocale(locale);

  const t = await getTranslations("nav");

  // Drives the header logout control — only signed-in users see it.
  const user = await getCurrentUser();

  return (
    <html lang={locale} className={montserrat.variable}>
      <body className={montserrat.className}>
        <NextIntlClientProvider>
          {/* Site-wide nav — Silverleaf brandmark links home; links live to
              its right. */}
          <nav className="site-nav">
            <Link href="/" className="site-nav__brand" aria-label={brand.name}>
              <Image
                src={brand.logos.brandmarkElectricBlue}
                alt={brand.name}
                width={118}
                height={52}
                priority
                /* SVG is vector — skip the optimizer (which 400s on SVG
                   unless images.dangerouslyAllowSVG is enabled). */
                unoptimized
              />
            </Link>
            <div className="site-nav__links">
              <Link href="/">{t("dashboard")}</Link>
              {user && <Link href="/search">{t("search")}</Link>}
              <AdminNavLink isAdmin={Boolean(user?.isAdmin)} />
              <LocaleSwitcher />
              {user && <LogoutButton />}
            </div>
          </nav>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
