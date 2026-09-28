import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${brand.shortName} ${brand.productName}`,
    short_name: "Silverleaf",
    description: "Order school uniforms, check sizes, and follow your FIFO place — works offline.",
    start_url: "/parent",
    scope: "/",
    display: "standalone",
    background_color: "#f3f8fd",
    theme_color: "#002368",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    ],
  };
}
