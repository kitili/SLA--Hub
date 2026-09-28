"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import styles from "./lessonPlanDocument.module.css";

/**
 * PrintButton — converts a print-ready document into a real PDF (one page per
 * `[data-print-page]` section, rasterised with html2canvas and assembled into an
 * A4 `jsPDF`) and opens that PDF in a new tab, so what gets printed / saved is
 * the generated PDF file itself rather than the live page.
 *
 * Shared by both documents on the plan page: the portrait Silverleaf booklet
 * (`LessonPlanDocument`, the defaults below) and the landscape government form
 * (`ComplianceDocument`, which passes `orientation="landscape"`). Everything
 * except the page geometry is orientation-agnostic.
 *
 * The capture never uses the on-screen layout directly: embedded in a narrow
 * reading column (e.g. the ~712px teacher card) a document renders through its
 * squished `@container` single-column styles, and stretching that capture onto
 * A4 warps the type. Instead the `[data-print-root]` document is cloned into an
 * off-screen stage wider than its container breakpoint (`stageWidth`), so every
 * page is photographed at its true desktop layout, then placed on the A4 page at
 * its captured aspect ratio (uniform scale only — never stretched).
 *
 * jsPDF + html2canvas are dynamically imported so they never ship in the
 * initial bundle — only pulled in the moment a teacher actually clicks print.
 *
 * When the conversion fails (html2canvas is unmaintained and can choke on
 * newer CSS) the error is logged and surfaced to the teacher — we do NOT
 * auto-fire `window.print()`, which would print the whole app page. The
 * `@media print` rules in plan.module.css keep a manual browser print usable.
 *
 * Kept as its own client component so `LessonPlanDocument` can stay a plain
 * presentational component — server-renderable on the plan page yet client-safe
 * for the Studio preview (the document markup carries no interactivity). The
 * button's strings come from the `lpPlan` catalog: the document body is
 * deliberately English-only content, but the button is app chrome and follows
 * the active locale.
 */
export default function PrintButton({
  className,
  fileName = "lesson-plan.pdf",
  label,
  orientation = "portrait",
  stageWidth = "232mm",
}: {
  className?: string;
  fileName?: string;
  /** Button text; defaults to the branded document's "Print / Save as PDF". */
  label?: string;
  /** Page geometry of the document being captured. */
  orientation?: "portrait" | "landscape";
  /** Off-screen capture width — must exceed the document's `@container` breakpoint. */
  stageWidth?: string;
}) {
  const t = useTranslations("lpPlan");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    setError(null);

    // Resolve the document containing THIS button — a page can hold more than
    // one `[data-print-root]` (e.g. an admin preview), and a global
    // querySelector would always grab the first one.
    const root =
      event.currentTarget.closest<HTMLElement>("[data-print-root]") ??
      document.querySelector<HTMLElement>("[data-print-root]");
    const livePages = root
      ? Array.from(root.querySelectorAll<HTMLElement>("[data-print-page]"))
      : [];
    if (!root || livePages.length === 0) {
      window.print();
      return;
    }

    setBusy(true);

    // Off-screen stage wider than the document's @container breakpoint, so the
    // clone lays out at its full A4 width even when the live one sits squished
    // inside a narrow reading column.
    const stage = document.createElement("div");
    stage.setAttribute("aria-hidden", "true");
    stage.style.cssText = `position:fixed;top:0;left:-10000px;width:${stageWidth};z-index:-1;pointer-events:none;`;
    stage.appendChild(root.cloneNode(true));
    document.body.appendChild(stage);

    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      // Give the browser a frame to lay the stage out before capturing it.
      // rAF never fires in hidden tabs (e.g. the teacher switches away while
      // the PDF is preparing), so a timeout backstop keeps this from hanging.
      await new Promise<void>((resolve) => {
        const backstop = setTimeout(resolve, 200);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            clearTimeout(backstop);
            resolve();
          }),
        );
      });

      const pages = Array.from(
        stage.querySelectorAll<HTMLElement>("[data-print-page]"),
      );
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation, compress: true });
      const landscape = orientation === "landscape";
      const pageW = landscape ? 297 : 210;
      const pageH = landscape ? 210 : 297;

      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i]!, {
          scale: 3,
          useCORS: true,
          backgroundColor: "#ffffff",
        });
        const imgData = canvas.toDataURL("image/jpeg", 0.98);
        if (i > 0) pdf.addPage();
        // Place at the captured aspect ratio — uniform scaling only. Forcing
        // the image onto the exact A4 rectangle stretches the glyphs whenever a
        // section isn't one: pages set a `min-height`, so content may run
        // longer, and such a page shrinks to fit rather than being clipped.
        const naturalH = (canvas.height * pageW) / canvas.width;
        if (naturalH <= pageH) {
          pdf.addImage(imgData, "JPEG", 0, 0, pageW, naturalH);
        } else {
          const fitW = (canvas.width * pageH) / canvas.height;
          pdf.addImage(imgData, "JPEG", (pageW - fitW) / 2, 0, fitW, pageH);
        }
      }

      pdf.setProperties({ title: fileName.replace(/\.pdf$/i, "") });

      // jsPDF's typings claim `URL`, but "bloburl" returns the object-URL string.
      const blobUrl = pdf.output("bloburl") as unknown as string;
      const printWindow = window.open(blobUrl, "_blank");
      if (!printWindow) {
        // Popup blocked — fall back to a direct download of the same PDF.
        pdf.save(fileName);
        URL.revokeObjectURL(blobUrl);
      } else {
        // Free the multi-MB blob once the new tab has had time to load it —
        // revoking immediately would break the tab's fetch of the URL.
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      }
    } catch (err) {
      console.error("[PrintButton] PDF export failed:", err);
      setError(t("printFailed"));
    } finally {
      stage.remove();
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={handleClick}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? t("preparingPdf") : (label ?? t("printLabel"))}
      </button>
      {error ? (
        <span className={styles.printError} role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}
