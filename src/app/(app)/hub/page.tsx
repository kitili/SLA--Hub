import type { Metadata } from "next";
import { recordCurrentAccess } from "@/lib/access";
import { resolveDepartments } from "@/lib/departments";
import { getCurrentUser } from "@/lib/auth";
import { listAccessEvents } from "@/lib/db/repositories/access";
import { getWorkplaceKpis } from "@/lib/workplace-kpis";
import HubHome from "@/components/HubHome";

export const metadata: Metadata = {
  title: "Workplace",
};

export const dynamic = "force-dynamic";

export default async function HubPage() {
  const user = await getCurrentUser();
  const firstName = user?.fullName?.split(" ")[0];
  await recordCurrentAccess({ action: "opened_hub", path: "/hub" });

  const recent = user?.isAdmin ? await listAccessEvents(8) : [];
  const kpis = user?.isAdmin ? await getWorkplaceKpis() : null;

  return (
    <HubHome
      firstName={firstName}
      departments={resolveDepartments()}
      isAdmin={user?.isAdmin === true}
      isSuperAdmin={user?.isSuperAdmin === true}
      deskKpis={kpis?.departments ?? []}
      recentAccess={recent.map((event) => ({
        id: event.id,
        name: event.fullName,
        email: event.email,
        action: event.action,
        part: event.departmentName ?? (event.action === "opened_hub" ? "Hub" : null),
        at: event.createdAt.toISOString(),
      }))}
    />
  );
}
