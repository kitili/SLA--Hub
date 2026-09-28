import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/db";
import { tools, toolCategories } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { importToolRowSchema, IMPORT_TOOL_COLUMNS } from "@/lib/validation/tool";
import { logAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/request";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 2000;

const COLUMN_KEYS: Record<(typeof IMPORT_TOOL_COLUMNS)[number], string> = {
  "Asset Tag": "assetTag",
  Name: "name",
  Category: "category",
  Brand: "brand",
  Model: "model",
  Specifications: "specifications",
  "Serial Number": "serialNumber",
  "Purchase Date": "purchaseDate",
  "Purchase Price": "purchasePrice",
};

function cellToString(value: ExcelJS.CellValue): string | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && "text" in value) return String(value.text).trim() || undefined;
  if (typeof value === "object" && "result" in value) return String(value.result ?? "").trim() || undefined;
  const str = String(value).trim();
  return str.length > 0 ? str : undefined;
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireModule("tech_tools", "manage");
  if (response) return response;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File is too large (max 5MB)" }, { status: 400 });
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Could not read the file — is it a valid .xlsx spreadsheet?" }, { status: 400 });
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return NextResponse.json({ error: "The spreadsheet has no worksheets" }, { status: 400 });
  }

  const headerRow = sheet.getRow(1);
  const columnIndexToKey = new Map<number, string>();
  headerRow.eachCell((cell, colNumber) => {
    const header = cellToString(cell.value)?.trim();
    const key = header ? COLUMN_KEYS[header as (typeof IMPORT_TOOL_COLUMNS)[number]] : undefined;
    if (key) columnIndexToKey.set(colNumber, key);
  });

  if (!columnIndexToKey.size || ![...columnIndexToKey.values()].includes("assetTag")) {
    return NextResponse.json(
      { error: `Missing recognized column headers. Expected columns: ${IMPORT_TOOL_COLUMNS.join(", ")}` },
      { status: 400 },
    );
  }

  const dataRowCount = sheet.rowCount - 1;
  if (dataRowCount > MAX_ROWS) {
    return NextResponse.json({ error: `Too many rows (max ${MAX_ROWS} per import)` }, { status: 400 });
  }

  const categories = await db.select().from(toolCategories);
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));

  const errors: { row: number; message: string }[] = [];
  const toInsert: (typeof tools.$inferInsert)[] = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    if (row.cellCount === 0) continue;

    const raw: Record<string, string | undefined> = {};
    row.eachCell((cell, colNumber) => {
      const key = columnIndexToKey.get(colNumber);
      if (key) raw[key] = cellToString(cell.value);
    });

    if (!raw.assetTag && !raw.name) continue; // skip blank rows

    const parsed = importToolRowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row: rowNumber, message: parsed.error.issues.map((i) => i.message).join("; ") });
      continue;
    }

    const category = categoryByName.get(parsed.data.category.toLowerCase());
    if (!category) {
      errors.push({ row: rowNumber, message: `Unknown category "${parsed.data.category}" — add it under Manage categories first` });
      continue;
    }

    toInsert.push({
      assetTag: parsed.data.assetTag,
      name: parsed.data.name,
      categoryId: category.id,
      brand: parsed.data.brand,
      model: parsed.data.model,
      specifications: parsed.data.specifications,
      serialNumber: parsed.data.serialNumber,
      purchaseDate: parsed.data.purchaseDate,
      purchasePrice: parsed.data.purchasePrice,
    });
  }

  let created = 0;
  for (const row of toInsert) {
    try {
      await db.insert(tools).values(row);
      created += 1;
    } catch {
      errors.push({ row: -1, message: `Asset tag "${row.assetTag}" could not be saved (it may already exist)` });
    }
  }

  await logAudit({
    actorUserId: session.user.id,
    action: "tool.import",
    targetType: "tool_import",
    metadata: { created, errorCount: errors.length },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ created, errors });
}
