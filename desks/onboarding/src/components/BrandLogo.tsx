"use client";

import Image from "next/image";

import { brand } from "@/lib/brand";

interface BrandLogoProps {
  variant: "brandmark" | "logomark";
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}

/**
 * Brand artwork that swaps navy/white files with the active color theme so the
 * mark stays visible on both light and dark chrome.
 */
export default function BrandLogo({
  variant,
  width,
  height,
  className,
  priority = false,
}: BrandLogoProps) {
  const light =
    variant === "brandmark"
      ? brand.logos.brandmarkElectricBlue
      : brand.logos.logomarkElectricBlue;
  const dark =
    variant === "brandmark"
      ? brand.logos.brandmarkWhite
      : brand.logos.logomarkWhite;

  return (
    <span className={className}>
      <Image
        className="brand-logo brand-logo--light"
        src={light}
        alt={brand.name}
        width={width}
        height={height}
        priority={priority}
        unoptimized
      />
      <Image
        className="brand-logo brand-logo--dark"
        src={dark}
        alt=""
        width={width}
        height={height}
        priority={priority}
        unoptimized
        aria-hidden
      />
    </span>
  );
}
