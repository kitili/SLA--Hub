"use client";

import Image from "next/image";
import { brand } from "@/lib/brand";

export function BrandLogo({
  variant,
  height = 42,
  priority = false,
}: {
  variant: "brandmark" | "logomark" | "tagline" | "white";
  height?: number;
  priority?: boolean;
}) {
  const src =
    variant === "white"
      ? brand.logos.brandmarkWhite
      : variant === "tagline"
        ? brand.logos.brandmarkTaglineWhite
        : variant === "logomark"
          ? brand.logos.logomarkElectricBlue
          : brand.logos.brandmarkElectricBlue;

  const width = variant === "logomark" ? height : Math.round(height * 2.28);

  return (
    <Image
      src={src}
      alt={brand.name}
      width={width}
      height={height}
      priority={priority}
      unoptimized
    />
  );
}
