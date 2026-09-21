export const ROLE_OPTIONS = [
  "Fundraising and Partnerships Associate",
  "Finance Manager",
  "Data & System Consultant (Pro Bono)",
  "Company Admin Assistant - DOS",
  "Head of Section - Lower Primary (Cluster)",
  "Head of Section - Middle Primary (Cluster)",
  "Head of Section - Upper Primary (Cluster)",
  "Social Media Manager",
  "Technical Product Manager",
  "Other",
] as const;

/** Resolve role from apply-form fields; unknown titles are kept (Google Form). */
export function parseRoleApplied(input: {
  roleApplied?: string;
  roleOther?: string;
}): string {
  const raw = String(input.roleApplied || "").trim();
  const roleOther = String(input.roleOther || "").trim();

  if (raw === "Other") {
    if (!roleOther) {
      throw new Error("Please specify the role when selecting Other.");
    }
    return roleOther;
  }

  if (!raw) {
    throw new Error(
      "Invalid role. Choose from the list or select Other with a description.",
    );
  }

  if ((ROLE_OPTIONS as readonly string[]).includes(raw)) return raw;
  if (raw.length >= 2 && raw.length <= 255) return raw;

  throw new Error(
    "Invalid role. Choose from the list or select Other with a description.",
  );
}
