import { tzs } from "./money";
import type { KpiReport } from "./kpis";

export function weeklyPack(report: KpiReport) {
  const where = report.campusName ?? "All five campuses";
  const day = report.asOf.toISOString().slice(0, 10);
  const lines = [
    "Silverleaf uniforms — weekly pack",
    `${where} · ${day}`,
    "",
    `Payments: ${tzs(report.paymentsTzs)}`,
    `Outstanding: ${tzs(report.outstandingTzs)}`,
    `Ready to collect: ${report.readyToCollect}`,
    `Low sizes: ${report.lowSizes}`,
    `Kit coverage: ${report.coveragePct}% (${report.withKit} of ${report.enrolled || report.onFile} planned children have a piece)`,
  ];
  if (report.quietCampuses.length) {
    lines.push(`Quiet campuses: ${report.quietCampuses.join(", ")}`);
  }
  if (report.readyList[0]) {
    lines.push(`Oldest ready kit: ${report.readyList[0].ref} ${report.readyList[0].studentName} (${report.readyList[0].days} days)`);
  }
  lines.push("", "Imani still runs stock. This pack is read-only.");
  return lines.join("\n");
}

export function weeklyWhatsAppHref(text: string) {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}
