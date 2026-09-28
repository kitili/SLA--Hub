import { escapeHtml } from "@/lib/email/escape-html";
import { renderEmailLayout, emailButton, priorityBadge, calloutBox } from "@/lib/email/layout";

export function ticketAssignedEmail(params: {
  ticketNumber: string;
  issue: string;
  priority: string;
  ticketUrl: string;
}) {
  const body = `
    <p>A ticket has been assigned to you:</p>
    ${calloutBox(
      "#002368",
      `<div style="font-weight:600;margin-bottom:6px;">${params.ticketNumber}</div>
       <div style="color:#333333;margin-bottom:6px;">${escapeHtml(params.issue)}</div>
       <div>${priorityBadge(params.priority)}</div>`,
    )}
    ${emailButton(params.ticketUrl, "View ticket")}
  `;
  return {
    subject: `Ticket assigned to you: ${params.ticketNumber}`,
    html: renderEmailLayout(body),
  };
}
