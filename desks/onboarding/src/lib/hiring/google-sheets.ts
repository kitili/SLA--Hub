import "server-only";

const SHEET_ID =
  process.env.GOOGLE_SHEETS_HIRING_FORM_ID ||
  "1CgixRZWX0lcCXx_DMZZgXCnkMn2m0s354XFvU6Atvyo";

// Column indices (0-based) in the hiring form sheet
const COL = {
  timestamp: 0,
  email: 1,
  fullName: 2,
  whatsapp: 3,
  preferredEmail: 5,
  linkedin: 6,
  hearAboutUs: 7,
  location: 8,
  employed: 9,
  currentRole: 10,
  employer: 11,
  roleApplied: 12,
  yearsExperience: 13,
  relevantExperience: 14,
  whySilverleaf: 15,
  cvLink: 16,
  noticePeriod: 17,
  expectedSalary: 18,
};

export type SheetCandidate = {
  rowIndex: number; // 1-based row in sheet (excluding header)
  timestamp: string;
  email: string;
  fullName: string;
  whatsapp: string;
  preferredEmail: string;
  linkedin: string;
  hearAboutUs: string;
  location: string;
  employed: string;
  currentRole: string;
  employer: string;
  roleApplied: string;
  yearsExperience: string;
  relevantExperience: string;
  whySilverleaf: string;
  cvLink: string;
  noticePeriod: string;
  expectedSalary: string;
};

function rowToCandidate(row: string[], rowIndex: number): SheetCandidate {
  const get = (i: number) => (row[i] ?? "").trim();
  return {
    rowIndex,
    timestamp: get(COL.timestamp),
    email: get(COL.email).toLowerCase(),
    fullName: get(COL.fullName),
    whatsapp: get(COL.whatsapp),
    preferredEmail: get(COL.preferredEmail).toLowerCase(),
    linkedin: get(COL.linkedin),
    hearAboutUs: get(COL.hearAboutUs),
    location: get(COL.location),
    employed: get(COL.employed),
    currentRole: get(COL.currentRole),
    employer: get(COL.employer),
    roleApplied: get(COL.roleApplied),
    yearsExperience: get(COL.yearsExperience),
    relevantExperience: get(COL.relevantExperience),
    whySilverleaf: get(COL.whySilverleaf),
    cvLink: get(COL.cvLink),
    noticePeriod: get(COL.noticePeriod),
    expectedSalary: get(COL.expectedSalary),
  };
}

async function getSheetRows(): Promise<string[][]> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
  const creds = JSON.parse(raw);

  const { google } = await import("googleapis");
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheetsApi = google.sheets({ version: "v4", auth });

  const res = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "A2:Z", // skip header row; no row cap
  });

  return (res.data.values ?? []) as string[][];
}

/** Search by position (partial, case-insensitive). Returns all matching rows. */
export async function searchByPosition(
  position: string,
): Promise<SheetCandidate[]> {
  const rows = await getSheetRows();
  const q = position.toLowerCase();
  return rows
    .map((row, i) => rowToCandidate(row, i + 2)) // +2: 1-based + skip header
    .filter(
      (c) => c.email && c.fullName && c.roleApplied.toLowerCase().includes(q),
    );
}

/**
 * Return every unique non-empty role value from the sheet, sorted alphabetically,
 * with a count of how many applicants listed each one.
 */
export async function listRoles(): Promise<{ role: string; count: number }[]> {
  const rows = await getSheetRows();
  const counts = new Map<string, number>();
  for (const row of rows) {
    const role = (row[COL.roleApplied] ?? "").trim();
    if (role) counts.set(role, (counts.get(role) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => a.role.localeCompare(b.role));
}

/** Search by email (exact, case-insensitive). Returns at most one match. */
export async function searchByEmail(
  email: string,
): Promise<SheetCandidate | null> {
  const rows = await getSheetRows();
  const q = email.toLowerCase().trim();
  const row = rows.find((r) => (r[COL.email] ?? "").toLowerCase().trim() === q);
  if (!row) return null;
  const idx = rows.indexOf(row);
  return rowToCandidate(row, idx + 2);
}
