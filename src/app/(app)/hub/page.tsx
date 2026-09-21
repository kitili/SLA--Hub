import type { Metadata } from "next";
import { resolveDepartments } from "@/lib/departments";
import { getCurrentUser } from "@/lib/auth";
import HubHome from "@/components/HubHome";

export const metadata: Metadata = {
  title: "Workplace",
};

export const dynamic = "force-dynamic";

export default async function HubPage() {
  const user = await getCurrentUser();
  const firstName = user?.fullName?.split(" ")[0];

  return <HubHome firstName={firstName} departments={resolveDepartments()} />;
}
