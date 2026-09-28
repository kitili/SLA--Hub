/**
 * Shared SOW upload encoding — turn a picked File into the `SowUploadInput`
 * the `previewSowUpload` / `createSchemeFromUpload` server actions accept.
 *
 * Used by both upload surfaces (the Studio's Scheme & Lesson panel and the
 * Schemes admin page) so the CSV/docx detection and the base64 encoding can
 * never drift between them.
 */
import type { SowUploadInput } from "@/lib/actions/schemes";

/** Read a File as base64 (data-URL body, prefix stripped). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip data-url prefix
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsDataURL(file);
  });
}

/**
 * Encode an uploaded SOW file for the server actions: CSV files travel as
 * text, everything else (docx) as base64 bytes.
 */
export async function fileToSowUploadInput(file: File): Promise<SowUploadInput> {
  const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
  if (isCsv) {
    const text = await file.text();
    return { kind: "csv", text, filename: file.name };
  }
  const dataBase64 = await fileToBase64(file);
  return { kind: "docx", dataBase64, filename: file.name };
}
