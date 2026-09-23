import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { recordDeskOpen } from "@/lib/access";
import { entryUrl, getDepartment, resolveDepartment } from "@/lib/departments";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const department = getDepartment(slug);
  return { title: department?.name ?? "Desk" };
}

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const found = getDepartment(slug);
  if (!found) notFound();
  await recordDeskOpen(found.id, `/departments/${found.id}`);
  if (found.id === "onboarding") redirect(entryUrl(resolveDepartment(found)));

  const department = resolveDepartment(found);
  await recordDeskOpen(department.id, `/departments/${department.id}`);
  redirect(entryUrl(department));
}
