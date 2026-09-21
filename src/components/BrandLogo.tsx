"use client";

import Image from "next/image";
import { brand } from "@/lib/brand";

export default function BrandLogo({
  variant,
  width,
  height,
  className,
  priority = false,
}: {
  variant: "brandmark" | "logomark" | "tagline";
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}) {
  const src =
    variant === "brandmark"
      ? brand.logos.brandmarkElectricBlue
      : variant === "tagline"
        ? brand.logos.brandmarkTaglineWhite
        : brand.logos.logomarkElectricBlue;

  return (
    <Image
      className={className}
      src={src}
      alt={brand.name}
      width={width}
      height={height}
      priority={priority}
      unoptimized
    />
  );
}
