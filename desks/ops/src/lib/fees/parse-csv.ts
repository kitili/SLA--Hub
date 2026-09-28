export type FeeCsvRow = {
  studentId?: string;
  qrCode?: string;
  balance: number;
  currency: string;
};

/**
 * Minimal CSV parser for fee sync.
 * Expected headers (any order): student_id | qr_code, balance, currency?
 */
export function parseFeeCsv(text: string): {
  rows: FeeCsvRow[];
  errors: string[];
} {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  if (lines.length === 0) {
    return { rows: [], errors: ["CSV is empty"] };
  }

  const headers = splitCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const studentIdIdx = headers.findIndex((h) =>
    ["student_id", "studentid", "id"].includes(h),
  );
  const qrIdx = headers.findIndex((h) =>
    ["qr_code", "qrcode", "code"].includes(h),
  );
  const balanceIdx = headers.findIndex((h) =>
    ["balance", "amount", "owed"].includes(h),
  );
  const currencyIdx = headers.findIndex((h) =>
    ["currency", "curr"].includes(h),
  );

  if (balanceIdx < 0) {
    return { rows: [], errors: ["CSV must include a `balance` column"] };
  }
  if (studentIdIdx < 0 && qrIdx < 0) {
    return {
      rows: [],
      errors: ["CSV must include `student_id` and/or `qr_code`"],
    };
  }

  const rows: FeeCsvRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]!);
    const balanceRaw = cols[balanceIdx]?.replace(/,/g, "").trim() ?? "";
    const balance = Number(balanceRaw);

    if (!Number.isFinite(balance)) {
      errors.push(`Line ${i + 1}: invalid balance "${balanceRaw}"`);
      continue;
    }

    const studentId =
      studentIdIdx >= 0 ? cols[studentIdIdx]?.trim() || undefined : undefined;
    const qrCode = qrIdx >= 0 ? cols[qrIdx]?.trim() || undefined : undefined;

    if (!studentId && !qrCode) {
      errors.push(`Line ${i + 1}: missing student_id and qr_code`);
      continue;
    }

    rows.push({
      studentId,
      qrCode,
      balance,
      currency: (currencyIdx >= 0 ? cols[currencyIdx]?.trim() : "") || "TZS",
    });
  }

  return { rows, errors };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}
