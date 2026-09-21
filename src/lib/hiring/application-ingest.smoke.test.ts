/**
 * Smoke: Google Form payloads that used to 400 still reach the hiring board.
 *
 * Requirements to land in the app: full name + email. Role / LinkedIn / CV
 * are optional (missing links → incomplete_application, still listed).
 */
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/lib/db/client";
import { hiringCandidates } from "@/lib/db/schema/hiring";
import {
  mapApplicationPayload,
  missingApplicationRequirements,
} from "@/lib/hiring/application-payload";
import { ingestApplication, importCandidatesFromCsv, listAllCandidates } from "@/lib/hiring/pipeline";
import { parseRoleApplied } from "@/lib/hiring/roles";

/** Real Google Form question titles (namedValues arrays, drifted punctuation). */
function googleFormRow(
  over: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    namedValues: {
      Timestamp: ["2/09/2026 12:04:11"],
      "Full Name": ["Amina Hassan"],
      "Preferred Email Address": ["amina.hassan@example.com"],
      "WhatsApp Number": ["+255700000001"],
      "Where do you reside currently?": ["Dar es Salaam, Tanzania"],
      "How did you hear about us?": ["LinkedIn"],
      "Are you currently employed?": ["Yes"],
      "What is your current role (Title)": ["Teacher"],
      "Name of Current Employer": ["Example School"],
      "Which position would you like to be considered for": [
        "Head of Section - Lower Primary (Cluster)",
      ],
      "How many years have you been in a role similar to the one that you are applying for at Silverleaf Academy? (Input Numerical Value Only)":
        ["4"],
      "What is your most relevant experience to the role that you are applying for at Silverleaf Academy?":
        ["Led a lower-primary team."],
      "Why are you applying to this role at Silverleaf Academy. After reviewing the JD for the role- what makes you a strong fit?":
        ["Mission fit."],
      "LinkedIn Profile link": ["https://linkedin.com/in/amina"],
      "Paste a link to your most recent CV. (Ensure that view access is granted)":
        ["https://drive.google.com/file/d/cv-amina"],
      "Notice Period (in days)": ["30"],
      "State your expected monthly gross salary in Tanzanian Shillings (TZS), before tax.":
        ["1500000"],
    },
    ...over,
  };
}

describe("Google Form → board smoke", () => {
  it("maps namedValues, preferred-only email, and missing '?' on the role question", () => {
    const mapped = mapApplicationPayload(googleFormRow());
    expect(missingApplicationRequirements(mapped)).toEqual([]);
    expect(mapped.fullName).toBe("Amina Hassan");
    expect(mapped.email).toBe("amina.hassan@example.com");
    expect(mapped.preferredEmail).toBe("amina.hassan@example.com");
    expect(mapped.roleApplied).toBe(
      "Head of Section - Lower Primary (Cluster)",
    );
    expect(mapped.linkedin).toContain("linkedin.com/in/amina");
    expect(mapped.cvLink).toContain("drive.google.com");
    expect(mapped.notes).toContain("Phone: +255700000001");
    expect(mapped.notes).toContain("Location: Dar es Salaam, Tanzania");
    expect(mapped.notes).not.toBe(mapped.roleApplied);
  });

  it("maps live form titles with trailing spaces and nbsp", () => {
    const mapped = mapApplicationPayload({
      namedValues: {
        "Full Name": ["Amina Hassan"],
        "WhatsApp Number\u00a0": ["+255700000001"],
        "Preferred Email Address\u00a0": ["amina.hassan@example.com"],
        "Where do you reside currently?\u00a0": ["Dar es Salaam, Tanzania"],
        "Which position would you like to be considered for?": [
          "Finance Manager",
        ],
        "LinkedIn Profile link": ["https://linkedin.com/in/amina"],
        "Paste a link to your most recent CV. (Ensure that view access is granted)":
          ["https://drive.google.com/file/d/cv-amina"],
      },
    });
    expect(missingApplicationRequirements(mapped)).toEqual([]);
    expect(mapped.fullName).toBe("Amina Hassan");
    expect(mapped.email).toBe("amina.hassan@example.com");
    expect(mapped.roleApplied).toBe("Finance Manager");
    expect(mapped.notes).toContain("Phone: +255700000001");
  });

  it("does not treat employer as the applicant name", () => {
    const mapped = mapApplicationPayload({
      "Name of Current Employer": "Example School",
      "Preferred Email Address": "someone@example.com",
    });
    expect(mapped.fullName).toBeUndefined();
    expect(missingApplicationRequirements(mapped)).toEqual(["fullName"]);
  });

  it("does not drop a row when LinkedIn/CV/role are missing", () => {
    const mapped = mapApplicationPayload({
      "Full Name": "No Links Yet",
      "Email Address": "nolinks@example.com",
    });
    expect(missingApplicationRequirements(mapped)).toEqual([]);
    expect(mapped.roleApplied).toBeUndefined();
    expect(mapped.linkedin).toBeUndefined();
    expect(mapped.cvLink).toBeUndefined();
  });

  it("rejects only when name or email is absent", () => {
    expect(
      missingApplicationRequirements(
        mapApplicationPayload({ "Email Address": "x@example.com" }),
      ),
    ).toEqual(["fullName"]);
    expect(
      missingApplicationRequirements(
        mapApplicationPayload({ "Full Name": "No Email" }),
      ),
    ).toEqual(["email"]);
  });

  it("keeps Google Form roles that are not in the in-app dropdown", () => {
    expect(
      parseRoleApplied({ roleApplied: "Cluster Academic Lead" }),
    ).toBe("Cluster Academic Lead");
  });

  it("ingests every form row onto the board, including incomplete ones", async () => {
    const stamp = Date.now();
    const formRows: Record<string, unknown>[] = [
      googleFormRow({
        namedValues: {
          ...(googleFormRow().namedValues as Record<string, unknown>),
          "Preferred Email Address": [`amina.${stamp}@example.com`],
        },
      }),
      {
        "Full Name": `Incomplete ${stamp}`,
        "Preferred Email Address": [`incomplete.${stamp}@example.com`],
        "Which position would you like to be considered for?": [
          "Finance Manager",
        ],
      },
      {
        namedValues: {
          Name: [`Custom Role ${stamp}`],
          Email: [`custom.${stamp}@example.com`],
          "Which position would you like to be considered for?": [
            "Cluster Academic Lead",
          ],
          LinkedIn: ["https://linkedin.com/in/custom"],
          CV: ["https://drive.google.com/file/d/cv-custom"],
        },
      },
    ];

    const mapped = formRows.map(mapApplicationPayload);
    expect(mapped.every((row) => missingApplicationRequirements(row).length === 0)).toBe(
      true,
    );

    const created = [];
    for (const row of mapped) {
      created.push(
        await ingestApplication({
          fullName: row.fullName!,
          email: row.email!,
          preferredEmail: row.preferredEmail,
          linkedin: row.linkedin,
          cvLink: row.cvLink,
          roleApplied: row.roleApplied || "General",
          notes: row.notes,
        }),
      );
    }

    expect(created).toHaveLength(formRows.length);

    const board = await listAllCandidates();
    const emails = created.map((c) => c.candidate.email);
    const onBoard = board.filter((c) => emails.includes(c.email));
    expect(onBoard).toHaveLength(formRows.length);

    const incomplete = onBoard.find((c) =>
      c.email.startsWith(`incomplete.${stamp}`),
    );
    expect(incomplete?.stage).toBe("incomplete_application");
    expect(incomplete?.application_check).toBe("Missing CV + LinkedIn");

    const custom = onBoard.find((c) => c.email.startsWith(`custom.${stamp}`));
    expect(custom?.role_applied).toBe("Cluster Academic Lead");
    expect(custom?.stage).toBe("new");

    const [amina] = await db
      .select({ notes: hiringCandidates.notes })
      .from(hiringCandidates)
      .where(eq(hiringCandidates.email, `amina.${stamp}@example.com`))
      .limit(1);
    expect(amina?.notes).toBeTruthy();
  });

  it("imports a Google Form CSV export and skips duplicate emails", async () => {
    const stamp = Date.now();
    const email = `formcsv.${stamp}@example.com`;
    const csv = [
      'Timestamp,Full Name,Preferred Email Address\u00a0,Which position would you like to be considered for?,LinkedIn Profile link,Paste a link to your most recent CV. (Ensure that view access is granted)',
      `2/09/2026 09:00,${`Csv Person ${stamp}`},${email},Finance Manager,https://linkedin.com/in/csv,https://drive.google.com/file/d/cv`,
      `2/09/2026 09:01,${`Csv Person ${stamp}`},${email},Finance Manager,https://linkedin.com/in/csv,https://drive.google.com/file/d/cv`,
    ].join("\n");

    const first = await importCandidatesFromCsv(csv);
    expect(first.imported).toBe(1);
    expect(first.skipped).toBe(1);
    expect(first.errors).toEqual([]);

    const board = await listAllCandidates();
    expect(board.filter((c) => c.email === email)).toHaveLength(1);
  });

  it("imports a Google Form CSV row whose experience cell contains a newline", async () => {
    const stamp = Date.now();
    const email = `multiline.${stamp}@example.com`;
    const csv = [
      "Full Name,Preferred Email Address,Which position would you like to be considered for?,What is your most relevant experience to the role that you are applying for at Silverleaf Academy?,LinkedIn Profile link,Paste a link to your most recent CV. (Ensure that view access is granted)",
      `"Multi Line ${stamp}",${email},Finance Manager,"Led a team, then moved.\nSecond paragraph.",https://linkedin.com/in/ml,https://drive.google.com/file/d/cv`,
    ].join("\n");

    const result = await importCandidatesFromCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.imported).toBe(1);

    const board = await listAllCandidates();
    const person = board.find((c) => c.email === email);
    expect(person?.full_name).toBe(`Multi Line ${stamp}`);
    expect(person?.notes).toContain("Second paragraph.");
  });
});
