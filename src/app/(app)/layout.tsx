import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { resolveDepartments } from "@/lib/departments";
import HubShell from "@/components/HubShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <HubShell user={{ fullName: user.fullName ?? "", email: user.email, isAdmin: user.isAdmin }} departments={resolveDepartments()}>
      {children}
    </HubShell>
  );
}
