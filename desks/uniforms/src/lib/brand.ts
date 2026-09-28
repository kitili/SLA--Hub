/**
 * Silverleaf Academy brand constants — shared with Ops, Onboarding, Marketing.
 * CSS tokens live in src/app/globals.css. Asset paths live here.
 * Source: Silverleaf Academy Brand Guidelines — March 2023
 */

export const brand = {
  name: "Silverleaf Academy",
  shortName: "Silverleaf",
  productName: "Uniform Tracker",
  tagline: "The Future Starts Here",

  logos: {
    brandmarkWhite: "/assets/branding/brandmark-white.svg",
    brandmarkElectricBlue: "/assets/branding/brandmark-electric-blue.svg",
    brandmarkTaglineWhite: "/assets/branding/brandmark-tagline-white.svg",
    logomarkWhite: "/assets/branding/logomark-white.svg",
    logomarkElectricBlue: "/assets/branding/logomark-electric-blue.svg",
  },
} as const;

export type Brand = typeof brand;
