import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Silverleaf Matron — native Android wrapper around the live Next.js /matron app.
 * Uses server.url so APIs, auth cookies, GPS, and boarding stay on Vercel.
 */
const config: CapacitorConfig = {
  appId: "tz.co.silverleaf.driver",
  appName: "SL Matron",
  webDir: "mobile/www",
  server: {
    url: "https://ops-transport-system.vercel.app/matron",
    cleartext: false,
    allowNavigation: [
      "https://ops-transport-system.vercel.app/*",
      "https://*.vercel.app/*",
      "https://*.supabase.co/*",
      "https://maps.googleapis.com/*",
      "https://maps.gstatic.com/*",
      "https://*.google.com/*",
      "https://*.googleapis.com/*",
    ],
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#001a4d",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#001a4d",
      showSpinner: false,
    },
  },
};

export default config;
