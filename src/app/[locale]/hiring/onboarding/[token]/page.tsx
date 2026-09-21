import type { Metadata } from "next";

import OnboardingClient from "@/components/hiring/OnboardingClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Employee Account Setup — Silverleaf Academy",
  robots: { index: false },
};

export default function OnboardingPage() {
  return <OnboardingClient />;
}
