/**
 * Silverleaf Academy brand constants — TypeScript single source of truth.
 *
 * IMPORTANT: CSS design tokens (hex values, shadows, radii) live in
 * src/app/globals.css as CSS custom properties. This file holds values that
 * are needed in TS/TSX: string constants, asset paths, and metadata.
 * Do NOT duplicate the CSS-var values here — reference --electric-blue etc.
 * in stylesheets, not this file.
 *
 * Source: Silverleaf Academy Brand Guidelines — March 2023
 */

export const brand = {
  name: "Silverleaf Academy",
  shortName: "Silverleaf",
  tagline: "The Future Starts Here",

  /**
   * Logo asset paths — relative to the Next.js /public directory.
   * Used in <img src={brand.logos.brandmarkWhite} … />.
   */
  logos: {
    /** Internal-facing (onboarding hub) — brandmark without tagline */
    brandmarkWhite: "/assets/branding/brandmark-white.svg",
    brandmarkElectricBlue: "/assets/branding/brandmark-electric-blue.svg",
    /** External / hero introductions — with tagline */
    brandmarkTaglineWhite: "/assets/branding/brandmark-tagline-white.svg",
    /** Watermark / favicon */
    logomarkWhite: "/assets/branding/logomark-white.svg",
    logomarkElectricBlue: "/assets/branding/logomark-electric-blue.svg",
  },

  tone: {
    style: ["Direct", "Honest", "Authoritative"] as const,
    language: "UK English",
  },
} as const;

export type Brand = typeof brand;
