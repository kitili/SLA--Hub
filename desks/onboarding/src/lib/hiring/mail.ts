import nodemailer from "nodemailer";

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  htmlBody: string;
  cc?: string;
  attachments?: EmailAttachment[];
};

export type SendEmailResult = {
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

/** Sends hiring pipeline email. Stubs to console when SMTP is not configured. */
export async function sendHiringEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const fromName = process.env.HIRING_FROM_NAME || "Silverleaf Academy HR";
  const fromEmail = process.env.HIRING_FROM_EMAIL || "jobs@silverleaf.co.tz";
  const replyTo = process.env.HIRING_REPLY_TO || fromEmail;

  if (!smtpConfigured()) {
    console.info("[hiring-email:stub]", {
      to: input.to,
      cc: input.cc,
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
      to: input.to,
      cc: input.cc || undefined,
      replyTo,
      subject: input.subject,
      html: input.htmlBody,
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });

    return { ok: true, stubbed: false, messageId: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[hiring-email:error]", message);
    return { ok: false, stubbed: false, error: message };
  }
}
