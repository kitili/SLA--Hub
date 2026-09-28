import type { Metadata, Viewport } from "next";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";
import "@fontsource/bai-jamjuree/400.css";
import "@fontsource/bai-jamjuree/500.css";
import "@fontsource/bai-jamjuree/600.css";
import "@fontsource/bai-jamjuree/700.css";
import { OfflineBanner } from "@/components/offline-banner";
import { PwaRegister } from "@/components/pwa";
import { brand } from "@/lib/brand";
import "./globals.css";

export const preferredRegion = "fra1";

export const metadata: Metadata = {
  title: `${brand.shortName} ${brand.productName}`,
  description: "Inventory, distribution, parent orders, sewing, and finance across five campuses.",
  applicationName: `${brand.shortName} ${brand.productName}`,
  appleWebApp: {
    capable: true,
    title: "Silverleaf",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#002368",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <PwaRegister />
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
