import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional();

/** Extra apply-form fields stored as encrypted hiring notes. */
export const applicationDetailSchema = z.object({
  whatsapp: optionalText(50),
  phone: optionalText(50),
  otherPhone: optionalText(50),
  location: optionalText(200),
  hearAboutUs: optionalText(500),
  employed: optionalText(20),
  currentRole: optionalText(200),
  employer: optionalText(200),
  yearsExperience: optionalText(20),
  relevantExperience: optionalText(4000),
  whySilverleaf: optionalText(4000),
  noticePeriod: optionalText(50),
  expectedSalary: optionalText(50),
});

export type ApplicationDetails = z.infer<typeof applicationDetailSchema>;

export function buildApplicationNotes(
  details: ApplicationDetails,
  extra?: { source?: string; existingNotes?: string },
): string {
  const whatsapp = details.whatsapp || details.phone || "";
  const parts = [
    whatsapp ? `Phone: ${whatsapp}` : "",
    details.otherPhone ? `Other phone: ${details.otherPhone}` : "",
    details.location ? `Location: ${details.location}` : "",
    details.hearAboutUs ? `Heard about us: ${details.hearAboutUs}` : "",
    details.employed ? `Employed: ${details.employed}` : "",
    details.currentRole ? `Current role: ${details.currentRole}` : "",
    details.employer ? `Employer: ${details.employer}` : "",
    details.yearsExperience
      ? `Years similar role: ${details.yearsExperience}`
      : "",
    details.noticePeriod ? `Notice (days): ${details.noticePeriod}` : "",
    details.expectedSalary
      ? `Expected salary (TZS): ${details.expectedSalary}`
      : "",
    details.relevantExperience
      ? `Relevant experience:\n${details.relevantExperience}`
      : "",
    details.whySilverleaf ? `Why Silverleaf:\n${details.whySilverleaf}` : "",
    extra?.existingNotes?.trim() || "",
    extra?.source ? `Source: ${extra.source}` : "",
  ];
  return parts.filter(Boolean).join("\n");
}
