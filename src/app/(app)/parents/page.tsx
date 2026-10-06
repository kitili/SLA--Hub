import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ParentApp from "@/components/ParentApp";

export const metadata: Metadata = {
  title: "Parents",
};

export const dynamic = "force-dynamic";

export default async function ParentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <ParentApp />;
}
