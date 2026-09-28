import Image from "next/image";
import { brand } from "@/lib/brand";

type Props = {
  /** Soft header mark vs large faded watermark */
  variant?: "header" | "watermark" | "hero";
  className?: string;
};

/**
 * Proportioned Silverleaf mark for matron surfaces.
 * Keeps aspect ratio and uses opacity so brand feels present, not loud.
 */
export function MatronBrandMark({
  variant = "header",
  className = "",
}: Props) {
  if (variant === "watermark") {
    return (
      <div
        className={`pointer-events-none select-none ${className}`}
        aria-hidden
      >
        <Image
          src={brand.logos.logomarkElectricBlue}
          alt=""
          width={280}
          height={280}
          className="h-auto w-[min(58vw,17rem)] opacity-[0.07] sm:w-[15rem]"
          style={{ width: "min(58vw, 17rem)", height: "auto" }}
          priority={false}
        />
      </div>
    );
  }

  if (variant === "hero") {
    return (
      <div
        className={`pointer-events-none select-none ${className}`}
        aria-hidden
      >
        <Image
          src={brand.logos.logomarkWhite}
          alt=""
          width={220}
          height={220}
          className="h-auto w-[min(42vw,11rem)] opacity-[0.14]"
          style={{ width: "min(42vw, 11rem)", height: "auto" }}
        />
      </div>
    );
  }

  return (
    <span
      className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-card-border ${className}`}
    >
      <Image
        src={brand.logos.logomarkElectricBlue}
        alt={brand.shortName}
        width={36}
        height={36}
        className="h-6 w-6 object-contain"
        style={{ width: "1.5rem", height: "1.5rem" }}
        priority
      />
    </span>
  );
}
