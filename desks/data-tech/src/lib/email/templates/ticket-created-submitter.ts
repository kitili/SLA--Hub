import { renderEmailLayout } from "@/lib/email/layout";

export function ticketCreatedSubmitterEmail(ticketNumber: string) {
  const body = `
    <p>Thanks for reaching out to Silverleaf IT Support.</p>
    <p>Your ticket <strong>${ticketNumber}</strong> has been received. Our tech team will be back to you shortly.</p>
  `;
  return {
    subject: `We received your ticket (${ticketNumber})`,
    html: renderEmailLayout(body),
  };
}
