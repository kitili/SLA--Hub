import { escapeHtml } from "@/lib/email/escape-html";
import { renderEmailLayout, emailButton, calloutBox } from "@/lib/email/layout";

function urgencyLabel(daysUntil: number) {
  if (daysUntil === 0) return { text: "Due today", color: "#991b1b" };
  if (daysUntil <= 2) return { text: `Due in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`, color: "#a16207" };
  return { text: `Due in ${daysUntil} days`, color: "#002368" };
}

export function toolReminderEmail(params: {
  toolLabel: string;
  reminderLabel: string;
  date: string;
  daysUntil: number;
  toolUrl: string;
}) {
  const urgency = urgencyLabel(params.daysUntil);
  const body = `
    <p>A reminder date on a device is coming up:</p>
    ${calloutBox(
      urgency.color,
      `<div style="font-weight:600;font-size:15px;margin-bottom:6px;">${escapeHtml(params.toolLabel)} — ${escapeHtml(params.reminderLabel)}</div>
       <div style="margin-bottom:6px;"><span style="display:inline-block;background:${urgency.color};color:#ffffff;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:600;">${urgency.text}</span></div>
       <div style="color:#666666;font-size:13px;">Date: ${params.date}</div>`,
    )}
    ${emailButton(params.toolUrl, "View device")}
  `;
  return {
    subject: `${urgency.text}: ${params.reminderLabel} — ${params.toolLabel}`,
    html: renderEmailLayout(body),
  };
}
