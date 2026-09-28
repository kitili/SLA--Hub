import { escapeHtml } from "@/lib/email/escape-html";
import { renderEmailLayout, emailButton, calloutBox } from "@/lib/email/layout";

function urgencyLabel(daysUntil: number) {
  if (daysUntil === 0) return { text: "Renews today", color: "#991b1b" };
  if (daysUntil <= 2) return { text: `Renews in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`, color: "#a16207" };
  return { text: `Renews in ${daysUntil} days`, color: "#002368" };
}

export function subscriptionReminderEmail(params: {
  name: string;
  description: string | null;
  renewalDate: string;
  daysUntil: number;
  departments: string[];
  manageUrl: string;
}) {
  const urgency = urgencyLabel(params.daysUntil);
  const body = `
    <p>A subscription renewal is coming up:</p>
    ${calloutBox(
      urgency.color,
      `<div style="font-weight:600;font-size:15px;margin-bottom:6px;">${escapeHtml(params.name)}</div>
       <div style="margin-bottom:6px;"><span style="display:inline-block;background:${urgency.color};color:#ffffff;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:600;">${urgency.text}</span></div>
       <div style="color:#666666;font-size:13px;">Renewal date: ${params.renewalDate}</div>
       ${params.departments.length ? `<div style="color:#666666;font-size:13px;margin-top:4px;">Used by: ${escapeHtml(params.departments.join(", "))}</div>` : ""}
       ${params.description ? `<div style="color:#333333;font-size:13px;margin-top:8px;">${escapeHtml(params.description)}</div>` : ""}`,
    )}
    ${emailButton(params.manageUrl, "Manage subscriptions")}
  `;
  return {
    subject: `${urgency.text}: ${params.name}`,
    html: renderEmailLayout(body),
  };
}
