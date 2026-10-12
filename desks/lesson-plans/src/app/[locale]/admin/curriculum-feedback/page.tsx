import { redirect } from "@/i18n/navigation";

export default async function CurriculumFeedbackRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/feedback", locale });
}
