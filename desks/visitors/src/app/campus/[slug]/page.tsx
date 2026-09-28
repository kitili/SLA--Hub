import { notFound } from "next/navigation";
import { FrontDeskApp } from "@/components/FrontDeskApp";
import { campusFromSlug } from "@/lib/campus-routes";

export default async function CampusDeskPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const campus = campusFromSlug(slug);
  if (!campus) notFound();
  return <FrontDeskApp campus={campus.name} />;
}
