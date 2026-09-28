/** Escape text for SpreadsheetML / CSV cells. */

export function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

function xmlEscape(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type SheetTab = {
  name: string;
  rows: (string | number | null | undefined)[][];
};

/**
 * Multi-worksheet Excel XML (SpreadsheetML).
 * Opens in Excel, LibreOffice, and imports into Google Sheets.
 */
export function toSpreadsheetMl(tabs: SheetTab[]): string {
  const worksheets = tabs
    .map((tab) => {
      const safeName = tab.name.replaceAll(/[\\/*?:\[\]]/g, "-").slice(0, 31);
      const tableRows = tab.rows
        .map((row) => {
          const cells = row
            .map((cell) => {
              const isNum =
                typeof cell === "number" ||
                (typeof cell === "string" &&
                  cell !== "" &&
                  !Number.isNaN(Number(cell)) &&
                  /^-?\d+(\.\d+)?$/.test(cell));
              const type = isNum ? "Number" : "String";
              const raw =
                typeof cell === "number" ? cell : isNum ? Number(cell) : cell;
              return `<Cell><Data ss:Type="${type}">${xmlEscape(raw)}</Data></Cell>`;
            })
            .join("");
          return `<Row>${cells}</Row>`;
        })
        .join("");
      return `<Worksheet ss:Name="${xmlEscape(safeName)}"><Table>${tableRows}</Table></Worksheet>`;
    })
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
${worksheets}
</Workbook>`;
}
