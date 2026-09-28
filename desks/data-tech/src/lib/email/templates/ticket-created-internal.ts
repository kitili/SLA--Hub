import { escapeHtml } from "@/lib/email/escape-html";
import { renderEmailLayout, emailButton, calloutBox } from "@/lib/email/layout";

export function ticketCreatedInternalEmail(ticketNumber: string, issue: string, ticketUrl: string) {
  const body = `
    <p>A new support ticket was submitted.</p>
    ${calloutBox(
      "#ffc952",
      `<div style="font-weight:600;margin-bottom:4px;">${ticketNumber}</div>
       <div style="color:#333333;">${escapeHtml(issue)}</div>`,
    )}
    ${emailButton(ticketUrl, "View ticket")}
  `;
  return {
    subject: `New ticket submitted: ${ticketNumber}`,
    html: renderEmailLayout(body),
  };
}
