import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

// Google Workspace SMTP with an App Password (requires 2-Step Verification on the sending
// account). If Workspace policy disables App Passwords, swap this module for one built on
// OAuth2 (Google Cloud Console client + refresh token) — sendEmail() callers don't change.
export function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SMTP_HOST,
      port: Number(process.env.EMAIL_SMTP_PORT ?? 465),
      secure: true,
      auth: {
        user: process.env.EMAIL_SMTP_USER,
        pass: process.env.EMAIL_SMTP_APP_PASSWORD,
      },
    });
  }
  return transporter;
}
