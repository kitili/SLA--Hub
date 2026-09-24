import { NextIntlClientProvider } from "next-intl";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { resolveDepartments } from "@/lib/departments";
import HubShell from "@/components/HubShell";
import IdleLogout from "@/components/IdleLogout";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <NextIntlClientProvider
      locale="en"
      messages={{
        idle: {
          title: "Still there?",
          message: "You'll be signed out for inactivity in {seconds} seconds.",
          stay: "Stay signed in",
        },
      }}
    >
      <HubShell user={{ fullName: user.fullName ?? "", email: user.email, isAdmin: user.isAdmin }} departments={resolveDepartments()}>
        <IdleLogout />
        {children}
      </HubShell>
    </NextIntlClientProvider>
  );
}
