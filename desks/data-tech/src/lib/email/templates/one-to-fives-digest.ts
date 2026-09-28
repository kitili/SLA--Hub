import { escapeHtml } from "@/lib/email/escape-html";
import { renderEmailLayout, emailButton } from "@/lib/email/layout";

export function oneToFivesDigestEmail(params: {
  workDate: string;
  missed: { name: string; email: string }[];
  late: { name: string; email: string }[];
  skippedNoReason: { name: string; email: string }[];
  pulseMissed?: { name: string }[];
  boardUrl: string;
}) {
  const missedList =
    params.missed.length === 0
      ? `<p style="color:#666666;">Everyone expected today submitted a 1–5.</p>`
      : `<ul>${params.missed.map((p) => `<li>${escapeHtml(p.name)} &lt;${escapeHtml(p.email)}&gt;</li>`).join("")}</ul>`;

  const lateList =
    params.late.length === 0
      ? ""
      : `<p><strong>Late (after 9:30 a.m.)</strong></p><ul>${params.late
          .map((p) => `<li>${escapeHtml(p.name)}</li>`)
          .join("")}</ul>`;

  const skipped =
    params.skippedNoReason.length === 0
      ? ""
      : `<p><strong>Skipped with no reason</strong></p><ul>${params.skippedNoReason
          .map((p) => `<li>${escapeHtml(p.name)}</li>`)
          .join("")}</ul>`;

  const pulse =
    params.pulseMissed && params.pulseMissed.length > 0
      ? `<p><strong>Thursday pulse not in</strong></p><ul>${params.pulseMissed
          .map((d) => `<li>${escapeHtml(d.name)}</li>`)
          .join("")}</ul>`
      : "";

  const subject =
    params.missed.length === 0 && (!params.pulseMissed || params.pulseMissed.length === 0)
      ? `1–5s ${params.workDate}: all in`
      : `1–5s ${params.workDate}: ${params.missed.length} missed`;

  const html = renderEmailLayout(`
    <p>Automatic close for <strong>${escapeHtml(params.workDate)}</strong> (deadline 9:30 a.m. Nairobi).</p>
    <p><strong>Missed 1–5s</strong></p>
    ${missedList}
    ${lateList}
    ${skipped}
    ${pulse}
    ${emailButton(params.boardUrl, "Open 1–5s board")}
  `);

  return { subject, html };
}
