import "server-only";

import nodemailer from "nodemailer";

export type HubEmailInput = {
  to: string | string[];
  subject: string;
  htmlBody: string;
  replyTo?: string;
};

export type HubEmailResult = {
  ok: boolean;
  stubbed: boolean;
  messageId?: string;
  error?: string;
};

function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
}

/** General hub mail (SLA-bot alerts). Stubs to console when SMTP is unset. */
export async function sendHubEmail(input: HubEmailInput): Promise<HubEmailResult> {
  const fromName = process.env.HUB_FROM_NAME || "Silverleaf Onboarding Hub";
  const fromEmail =
    process.env.HUB_FROM_EMAIL || process.env.SMTP_USER || "noreply@silverleaf.co.tz";
  const to = Array.isArray(input.to) ? input.to.join(", ") : input.to;

  if (!smtpConfigured()) {
    console.info("[hub-email:stub]", {
      to,
      subject: input.subject,
      from: `${fromName} <${fromEmail}>`,
    });
    return { ok: true, stubbed: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      replyTo: input.replyTo,
      subject: input.subject,
      html: input.htmlBody,
    });
    return { ok: true, stubbed: false, messageId: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[hub-email:error]", message);
    return { ok: false, stubbed: false, error: message };
  }
}

export const SLA_BOT_TECH_EMAILS = [
  "mourine@silverleaf.co.tz",
  "it@silverleaf.co.tz",
] as const;
