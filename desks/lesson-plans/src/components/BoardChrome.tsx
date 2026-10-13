"use client";

import type { ReactNode } from "react";
import { useLocale } from "next-intl";

import { usePathname } from "@/i18n/navigation";

export function HideOnBoards({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (
    pathname === "/" ||
    pathname.startsWith("/feedback") ||
    pathname.startsWith("/curriculum") ||
    pathname.startsWith("/kg") ||
    pathname.startsWith("/assessment")
  ) {
    return null;
  }
  return children;
}

export function AcademicsHomeLink({
  className,
  children,
  ariaLabel,
}: {
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  const locale = useLocale();
  return (
    <a className={className} href={`/${locale}`} target="_top" aria-label={ariaLabel}>
      {children}
    </a>
  );
}
