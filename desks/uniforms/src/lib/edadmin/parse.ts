/** Ed-admin GET API row — General API returns XML (see docs/EDADMIN.md). */
export type EdadminStudentRow = {
  edadminId: string;
  regNo: string;
  firstName: string;
  lastName: string;
  className: string | null;
  parentEdadminId: string | null;
  gender: string | null;
  campusName: string | null;
  active: boolean;
};

export type EdadminParentRow = {
  edadminId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  campusName: string | null;
};

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

/** Parse Ed-admin XML: repeated `<Students>...</Students>` under `<root>`. */
export function parseEdadminXmlRecords(xml: string, tagName: string): Record<string, string>[] {
  const records: Record<string, string>[] = [];
  const blockRe = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "gi");
  const fieldRe = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g;

  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRe.exec(xml)) !== null) {
    const row: Record<string, string> = {};
    let fieldMatch: RegExpExecArray | null;
    while ((fieldMatch = fieldRe.exec(blockMatch[1])) !== null) {
      row[fieldMatch[1]] = fieldMatch[2].trim();
    }
    if (Object.keys(row).length > 0) records.push(row);
  }
  return records;
}

function parentDisplayName(row: Record<string, unknown>): string {
  const mother = [pickString(row, ["MotherFName", "MFirstName"]), pickString(row, ["MotherLName", "MLastName"])]
    .filter(Boolean)
    .join(" ");
  if (mother.trim()) return mother.trim();
  const father = [pickString(row, ["FatherFName", "FFirstName"]), pickString(row, ["FatherLName", "FLastName"])]
    .filter(Boolean)
    .join(" ");
  if (father.trim()) return father.trim();
  return pickString(row, ["FullName", "Name"]) ?? "Parent";
}

export function parseEdadminStudents(
  rows: Record<string, string>[],
  classByStudentId?: Map<string, string>,
): EdadminStudentRow[] {
  return rows
    .map((row): EdadminStudentRow | null => {
      const rec = row as Record<string, unknown>;
      const edadminId = pickString(rec, ["ID", "StudentID", "StudentId", "id"]) ?? "";
      if (!edadminId) return null;

      const parentEdadminId = pickString(rec, ["ParentID", "ParentId", "parent_id"]);
      const grade = pickString(rec, ["InGrade", "Grade"]);
      const fromClasses = classByStudentId?.get(edadminId) ?? null;
      const className =
        fromClasses ??
        pickString(rec, ["Class", "class_name", "GradeDesc"]) ??
        (grade ? `Grade ${grade}` : null);

      const statusId = pickString(rec, ["StatusID", "StatusId"]);
      const active = statusId == null || statusId === "1";
      const regNo =
        pickString(rec, ["AdmNo", "AdmissionNo", "RegNo", "RegistrationNo"]) ??
        pickString(rec, ["StudentNo", "StudentNumber"]) ??
        "";

      return {
        edadminId,
        regNo,
        firstName: pickString(rec, ["FirstName", "first_name"]) ?? "Student",
        lastName: pickString(rec, ["LastName", "last_name"]) ?? "",
        className,
        parentEdadminId,
        gender: pickString(rec, ["Gender", "Sex"]),
        campusName: pickString(rec, ["CampusName", "Campus"]),
        active,
      };
    })
    .filter((row): row is EdadminStudentRow => row != null);
}

export function parseEdadminParents(rows: Record<string, string>[]): EdadminParentRow[] {
  return rows
    .map((row) => {
      const edadminId = pickString(row, ["ID", "ParentID", "ParentId", "id"]) ?? "";
      if (!edadminId) return null;
      return {
        edadminId,
        fullName: parentDisplayName(row),
        phone:
          pickString(row, ["MPCell", "MPHome", "FPCell", "FPHome", "Cell", "Phone"]) ??
          null,
        email: pickString(row, ["MEmail", "FEmail", "Email", "email"]),
        campusName: pickString(row, ["CampusName", "Campus"]),
      } satisfies EdadminParentRow;
    })
    .filter((row): row is EdadminParentRow => row != null);
}

export function parseStudentClasses(rows: Record<string, string>[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of rows) {
    const studentId = pickString(row, ["StudentID", "StudentId", "ID"]);
    if (!studentId) continue;
    const grade = pickString(row, ["Grade"]);
    const cls = pickString(row, ["Class"]);
    const label = [grade, cls].filter(Boolean).join(" ") || cls || grade;
    if (label) out.set(studentId, label);
  }
  return out;
}
