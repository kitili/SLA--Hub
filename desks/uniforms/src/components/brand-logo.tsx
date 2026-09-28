import Image from "next/image";
import { brand } from "@/lib/brand";

type Variant = "brandmark" | "logomark" | "logomark-white";

const SRC: Record<Variant, string> = {
  brandmark: brand.logos.brandmarkElectricBlue,
  logomark: brand.logos.logomarkElectricBlue,
  "logomark-white": brand.logos.logomarkWhite,
};

export function BrandLogo({
  variant,
  width,
  height,
  className,
  priority = false,
}: {
  variant: Variant;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={SRC[variant]}
      alt={brand.name}
      width={width}
      height={height}
      className={className}
      priority={priority}
      unoptimized
    />
  );
}
