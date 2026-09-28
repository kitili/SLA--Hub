import { escapeHtml } from "@/lib/email/escape-html";
import { renderEmailLayout, emailButton, calloutBox } from "@/lib/email/layout";

export function userWelcomeEmail(name: string, email: string, tempPassword: string, loginUrl: string) {
  const body = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>An account has been created for you on the Silverleaf Data &amp; Tech platform.</p>
    ${calloutBox(
      "#002368",
      `<div style="margin-bottom:8px;"><strong>Email:</strong> ${escapeHtml(email)}</div>
       <div><strong>Temporary password:</strong> <code style="background:#ececec;padding:2px 6px;border-radius:4px;">${escapeHtml(tempPassword)}</code></div>`,
    )}
    <p>You'll be asked to set your own password the first time you log in.</p>
    ${emailButton(loginUrl, "Sign in")}
  `;
  return {
    subject: "Your Silverleaf Data & Tech account",
    html: renderEmailLayout(body),
  };
}
