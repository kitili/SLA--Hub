import { renderEmailLayout } from "@/lib/email/layout";

export function ticketResolvedEmail(ticketNumber: string) {
  const body = `
    <p>Good news — your ticket <strong>${ticketNumber}</strong> has been marked resolved by our tech team.</p>
    <p>If the issue persists, please submit a new ticket referencing this one.</p>
  `;
  return {
    subject: `Your ticket has been resolved (${ticketNumber})`,
    html: renderEmailLayout(body),
  };
}
