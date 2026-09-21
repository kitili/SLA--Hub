import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";
import ThemeInit from "@/components/ThemeInit";
import "../onboarding.css";

export const metadata: Metadata = {
  title: {
    default: "Onboarding",
    template: "%s · Silverleaf Hub",
  },
  description: "Silverleaf Academy staff onboarding",
};

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
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <>
      <ThemeInit />
      <NextIntlClientProvider>{children}</NextIntlClientProvider>
    </>
  );
}
