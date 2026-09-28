import { redirect } from "@/i18n/navigation";

/** Legacy job detail — redirect to candidate board. */
export default async function LegacyJobPage({
  params,
}: {
  params: Promise<{ locale: string; jobId: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/admin/hiring", locale });
}
