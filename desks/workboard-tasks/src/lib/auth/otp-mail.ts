import nodemailer from "nodemailer";

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function isOtpSignInAvailable(): boolean {
  return isSmtpConfigured() || isResendConfigured() || process.env.NODE_ENV !== "production";
}

export async function sendOtpEmail(
  to: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSmtpConfigured() && !isResendConfigured()) {
    if (process.env.NODE_ENV === "production") {
      console.error("[otp-mail] No mail sender is configured — cannot send OTP email");
      return { ok: false, error: "Email delivery is not configured. Contact HR or IT." };
    }
    console.info(`[otp-mail:stub] OTP for ${to}: ${code}`);
    return { ok: true };
  }

  try {
    if (isResendConfigured()) {
      return await sendViaResend(to, code);
    }
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Silverleaf Academy" <${process.env.SMTP_USER ?? "jobs@silverleaf.co.tz"}>`,
      to,
      subject: `Your sign-in code: ${code}`,
      html: otpHtml(code),
    });

    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[otp-mail:error]", error);
    return { ok: false, error };
  }
}

function otpHtml(code: string): string {
  return `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:2rem">
          <h2 style="color:#002368;margin:0 0 0.5rem">Your sign-in code</h2>
          <p style="color:#444;margin:0 0 1.5rem">
            Use this code to sign in to Silverleaf tasks.
          </p>
          <div style="
            display:inline-block;
            font-size:2.25rem;
            font-weight:700;
            letter-spacing:0.25em;
            color:#002368;
            background:#f0f4fa;
            border-radius:8px;
            padding:0.75rem 1.5rem;
            margin-bottom:1.5rem;
          ">${code}</div>
          <p style="color:#666;font-size:0.875rem;margin:0 0 0.5rem">
            This code expires in <strong>10 minutes</strong> and can only be used once.
          </p>
          <p style="color:#999;font-size:0.8rem">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `;
}

async function sendViaResend(to: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const domain = (process.env.RESEND_EMAIL_DOMAIN || "silverleaf.co.tz").replace(/^@/, "");
  const from = process.env.OTP_FROM_EMAIL || `Silverleaf Academy <tasks@${domain}>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Your sign-in code: ${code}`,
      html: otpHtml(code),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("[otp-mail:resend]", response.status, detail);
    return { ok: false, error: "Email delivery failed. Contact HR or IT." };
  }
  return { ok: true };
}
