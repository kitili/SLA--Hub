import * as XLSX from "xlsx";
import type { SheetTab } from "@/lib/export/spreadsheet";
import { toCsv } from "@/lib/export/spreadsheet";

function safeSheetName(name: string) {
  return name.replaceAll(/[\\/*?:\[\]]/g, "-").slice(0, 31);
}

/** Real .xlsx workbook — opens cleanly in Excel and Google Sheets. */
export function toXlsxBuffer(tabs: SheetTab[]): ArrayBuffer {
  const book = XLSX.utils.book_new();

  for (const tab of tabs) {
    const normalized = tab.rows.map((row) =>
      row.map((cell) => (cell == null ? "" : cell)),
    );
    const sheet = XLSX.utils.aoa_to_sheet(normalized);

    // Approximate column widths from content
    const colCount = Math.max(0, ...normalized.map((r) => r.length));
    const cols = Array.from({ length: colCount }, (_, col) => {
      let max = 10;
      for (const row of normalized) {
        const v = row[col];
        const len = v == null ? 0 : String(v).length;
        if (len > max) max = Math.min(len + 2, 48);
      }
      return { wch: max };
    });
    sheet["!cols"] = cols;

    XLSX.utils.book_append_sheet(book, sheet, safeSheetName(tab.name));
  }

  const out = XLSX.write(book, {
    bookType: "xlsx",
    type: "array",
    compression: true,
  }) as Uint8Array;

  return out.buffer.slice(
    out.byteOffset,
    out.byteOffset + out.byteLength,
  ) as ArrayBuffer;
}

/** UTF-8 BOM CSV — Google Sheets / Excel detect encoding correctly. */
export function toCsvWithBom(rows: (string | number | null | undefined)[][]) {
  return `\uFEFF${toCsv(rows)}`;
}

/** Minimal store-only ZIP (no compression) for a CSV pack. */
export function zipStoreFiles(
  files: { name: string; content: string }[],
): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  function u16(n: number) {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, n, true);
    return b;
  }
  function u32(n: number) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n, true);
    return b;
  }
  function concat(chunks: Uint8Array[]) {
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(total);
    let i = 0;
    for (const c of chunks) {
      out.set(c, i);
      i += c.length;
    }
    return out;
  }
  function crc32(data: Uint8Array) {
    let c = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      c ^= data[i]!;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      data,
    ]);
    parts.push(local);

    const centralHeader = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);
    central.push(centralHeader);
    offset += local.length;
  }

  const centralDir = concat(central);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);

  return concat([...parts, centralDir, end]);
}
