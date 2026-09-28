import { escapeHtml } from "@/lib/email/escape-html";
import { renderEmailLayout, emailButton, calloutBox } from "@/lib/email/layout";

export function systemLeadAssignedEmail(params: {
  systemName: string;
  description: string | null;
  systemUrl: string;
}) {
  const body = `
    <p>You've been made the project lead for:</p>
    ${calloutBox(
      "#002368",
      `<div style="font-weight:600;font-size:15px;">${escapeHtml(params.systemName)}</div>
       ${params.description ? `<div style="color:#333333;font-size:13px;margin-top:6px;">${escapeHtml(params.description)}</div>` : ""}`,
    )}
    <p style="color:#666666;font-size:13px;">
      As lead, you can manage this project's task board even when it's closed to everyone else.
    </p>
    ${emailButton(params.systemUrl, "View project")}
  `;
  return {
    subject: `You're now the project lead: ${params.systemName}`,
    html: renderEmailLayout(body),
  };
}
