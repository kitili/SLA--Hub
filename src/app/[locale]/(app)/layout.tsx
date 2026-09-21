import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { resolveDepartments } from "@/lib/departments";
import HubShell from "@/components/HubShell";
import IdleLogout from "@/components/IdleLogout";
import OnboardingBar from "@/components/OnboardingBar";
import SlaBotWidget from "@/components/SlaBot";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await getTranslations("nav");
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <HubShell user={{ fullName: user.fullName ?? "", email: user.email }} departments={resolveDepartments()}>
      <IdleLogout />
      <SlaBotWidget />
      <OnboardingBar isAdmin={user.isAdmin} />
      {children}
    </HubShell>
  );
}
