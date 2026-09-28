import "server-only";

/**
 * Textbook ingest helpers (AI Studio v2) — PDF rasterisation.
 *
 * Renders each page of an uploaded textbook PDF to a PNG so the vision OCR step
 * ({@link ../ai/ocr#ocrPage}) can read it. Backed by `pdf-to-img`, which wraps
 * pdfjs + a canvas; it is Node-only (needs the Node canvas factory), so this
 * module is `server-only` and must run inside an ingest STEP, never the
 * deterministic workflow body.
 *
 * @see ../ai/workflows/textbookIngest.ts
 */
import { pdf } from "pdf-to-img";

/** A rendered page: its 1-based number and the PNG bytes. */
export interface RasterizedPage {
  pageNumber: number;
  /** PNG image bytes for the page. */
  png: Buffer;
}

/**
 * How many times the PDF is scaled up when rasterising. 2× yields legible text
 * for OCR without ballooning image size; bump via the `scale` option if needed.
 */
const DEFAULT_SCALE = 2;

/**
 * Render every page of a PDF to a PNG, returning them in order.
 *
 * Loads the whole set into memory; fine for the per-textbook sizes we ingest. A
 * very large book should prefer {@link rasterizePdfPagesIter} (async iterable)
 * to keep at most one page's bytes resident at a time.
 *
 * @param pdfBuf The raw PDF bytes (e.g. from `MaterialStorage.read`).
 * @param opts.scale Render scale (default {@link DEFAULT_SCALE}).
 * @returns One {@link RasterizedPage} per page, 1-based.
 */
export async function rasterizePdfPages(
  pdfBuf: Buffer,
  opts?: { scale?: number },
): Promise<RasterizedPage[]> {
  const pages: RasterizedPage[] = [];
  for await (const page of rasterizePdfPagesIter(pdfBuf, opts)) {
    pages.push(page);
  }
  return pages;
}

/**
 * Async-iterable variant of {@link rasterizePdfPages}: yields one rendered page
 * at a time so a caller can process-and-discard without holding every PNG in
 * memory. The underlying `pdf-to-img` document is destroyed when iteration ends
 * or throws.
 *
 * @param pdfBuf The raw PDF bytes.
 * @param opts.scale Render scale (default {@link DEFAULT_SCALE}).
 */
export async function* rasterizePdfPagesIter(
  pdfBuf: Buffer,
  opts?: { scale?: number },
): AsyncGenerator<RasterizedPage, void, void> {
  const doc = await pdf(pdfBuf, { scale: opts?.scale ?? DEFAULT_SCALE });
  let pageNumber = 0;
  try {
    for await (const png of doc) {
      pageNumber += 1;
      yield { pageNumber, png };
    }
  } finally {
    await doc.destroy();
  }
}

/**
 * Count the pages in a PDF without rendering them. Useful to set
 * `textbooks.pageCount` up front so the UI can show progress as `n / total`.
 *
 * @param pdfBuf The raw PDF bytes.
 */
export async function countPdfPages(pdfBuf: Buffer): Promise<number> {
  const doc = await pdf(pdfBuf, { scale: 1 });
  try {
    return doc.length;
  } finally {
    await doc.destroy();
  }
}
