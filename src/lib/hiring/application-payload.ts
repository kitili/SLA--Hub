/**
 * Map a Google Form / Sheets webhook body onto hiring ingest fields.
 *
 * Apps Script `onFormSubmit` often posts `namedValues` (question title →
 * string[]) and question titles drift (punctuation, "Email" vs "Preferred
 * Email"). Exact-key matching dropped those rows, so the form showed more
 * applicants than the board.
 *
 * Requirements to ingest: full name + any email. Role, LinkedIn, and CV are
 * optional — missing links land in `incomplete_application` instead of 400.
 */

export type MappedApplication = {
  fullName?: string;
  email?: string;
  preferredEmail?: string;
  linkedin?: string;
  cvLink?: string;
  roleApplied?: string;
  notes?: string;
};

function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value).trim();
}

function flattenPayload(body: Record<string, unknown>): Record<string, unknown> {
  const nested = body["namedValues"];
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return { ...body, ...(nested as Record<string, unknown>) };
  }
  return body;
}

function indexFields(
  body: Record<string, unknown>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(flattenPayload(body))) {
    const text = cell(value);
    if (!text) continue;
    const normalized = normalizeKey(key);
    if (!normalized || normalized === "namedvalues" || normalized === "values") {
      continue;
    }
    if (!out.has(normalized)) out.set(normalized, text);
  }
  return out;
}

function pickField(
  fields: Map<string, string>,
  aliases: string[],
  opts?: { skipIfKeyIncludes?: string[] },
): string | undefined {
  const skip = (opts?.skipIfKeyIncludes ?? []).map(normalizeKey);
  const skipKey = (key: string) =>
    skip.some((token) => token && key.includes(token));

  const wanted = aliases.map(normalizeKey).filter(Boolean);

  for (const alias of wanted) {
    const exact = fields.get(alias);
    if (exact && !skipKey(alias)) return exact;
  }

  // Short aliases ("name", "email", "cv") stay exact-only so "Name of
  // Current Employer" cannot steal fullName when the name column is blank.
  for (const alias of wanted) {
    if (alias.length < 6) continue;
    for (const [key, value] of fields) {
      if (skipKey(key)) continue;
      if (key.includes(alias) || alias.includes(key)) return value;
    }
  }
  return undefined;
}

function applicationNotesFromFields(
  fields: Map<string, string>,
  existingNotes?: string,
): string | undefined {
  const phone = pickField(fields, [
    "phone",
    "preferred contact number",
    "whatsapp number",
    "whatsapp",
    "other preferred number",
  ]);
  const location = pickField(fields, [
    "location",
    "where do you reside currently",
    "where do you reside",
  ]);
  const employed = pickField(fields, ["are you currently employed"]);
  const currentRole = pickField(fields, [
    "what is your current role",
    "current role title",
    "current role",
  ]);
  const employer = pickField(fields, [
    "name of current employer",
    "current employer",
  ]);
  const years = pickField(fields, [
    "how many years have you been in a role similar",
    "years similar role",
    "how many years",
  ]);
  const experience = pickField(fields, [
    "most relevant experience",
    "relevant experience",
  ]);
  const why = pickField(fields, [
    "why are you applying to this role",
    "why silverleaf",
  ]);
  const notice = pickField(fields, ["notice period"]);
  const salary = pickField(fields, [
    "expected monthly gross salary",
    "expected salary",
  ]);
  const source = pickField(fields, ["how did you hear about us"]);

  const noteParts = [
    phone ? `Phone: ${phone}` : "",
    location ? `Location: ${location}` : "",
    employed ? `Employed: ${employed}` : "",
    currentRole ? `Current role: ${currentRole}` : "",
    employer ? `Employer: ${employer}` : "",
    years ? `Years similar role: ${years}` : "",
    notice ? `Notice (days): ${notice}` : "",
    salary ? `Expected salary (TZS): ${salary}` : "",
    source ? `Heard about us: ${source}` : "",
    experience ? `Relevant experience:\n${experience}` : "",
    why ? `Why Silverleaf:\n${why}` : "",
    existingNotes || "",
  ].filter(Boolean);

  return noteParts.length ? noteParts.join("\n") : undefined;
}

/** Why a payload cannot be ingested. Empty array → ok to insert. */
export function missingApplicationRequirements(
  mapped: MappedApplication,
): string[] {
  const missing: string[] = [];
  if (!mapped.fullName) missing.push("fullName");
  if (!mapped.email) missing.push("email");
  return missing;
}

export function mapApplicationPayload(
  body: Record<string, unknown>,
): MappedApplication {
  const fields = indexFields(body);

  const preferredEmail = pickField(fields, [
    "preferred email address",
    "preferred email",
    "preferredEmail",
  ]);
  const email =
    pickField(fields, ["email address", "email", "emailAddress"], {
      skipIfKeyIncludes: ["preferred"],
    }) || preferredEmail;

  const existingNotes = pickField(fields, ["notes"]);

  return {
    fullName: pickField(fields, ["full name", "fullname", "name"], {
      skipIfKeyIncludes: ["file", "user", "role"],
    }),
    email,
    preferredEmail,
    linkedin: pickField(fields, [
      "linkedin profile link",
      "linkedin profile",
      "linkedin",
    ]),
    cvLink: pickField(fields, [
      "paste a link to your most recent cv",
      "most recent cv",
      "cv link",
      "cvLink",
      "cv",
    ]),
    roleApplied: pickField(
      fields,
      [
        "which position would you like to be considered for",
        "role applied",
        "roleApplied",
        "position",
      ],
      { skipIfKeyIncludes: ["current", "employer"] },
    ),
    notes: applicationNotesFromFields(fields, existingNotes),
  };
}
