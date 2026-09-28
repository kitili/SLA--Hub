import type { Metadata, Viewport } from "next";
import "@fontsource/bai-jamjuree/400.css";
import "@fontsource/bai-jamjuree/500.css";
import "@fontsource/bai-jamjuree/600.css";
import "@fontsource/bai-jamjuree/700.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import { brand } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Visitor Log · Silverleaf Academy",
    template: "%s · Silverleaf Academy",
  },
  description:
    "Sign visitors in and out across Silverleaf Academy campuses, with QR self check-in for guests.",
};

export const viewport: Viewport = {
  themeColor: "#002368",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <span className="sr-only">{brand.tagline}</span>
      </body>
    </html>
  );
}
