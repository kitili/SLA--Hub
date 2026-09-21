import "server-only";
import nodemailer from "nodemailer";

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
}

/** Email OTP is offered only when mail can actually be delivered. */
export function isOtpSignInAvailable(): boolean {
  return isSmtpConfigured() || process.env.NODE_ENV !== "production";
}

export async function sendOtpEmail(
  to: string,
  code: string,
): Promise<{ ok: boolean; error?: string; previewCode?: string }> {
  if (!isSmtpConfigured()) {
    // Local/dev fallback — prints the code to the server console.
    // In production this must fail loudly: otherwise the UI says "code sent"
    // while no email is delivered.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[otp-mail] SMTP_HOST/SMTP_USER/SMTP_PASS are not set — cannot send OTP email",
      );
      return {
        ok: false,
        error: "Email delivery is not configured. Contact HR or IT.",
      };
    }
    console.info(`[otp-mail:stub] OTP for ${to}: ${code}`);
    return { ok: true, previewCode: code };
  }

  try {
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
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:2rem">
          <img
            src="https://sla-onboarding-hub-tau.vercel.app/logos/logomark-electric-blue.png"
            alt="Silverleaf Academy"
            width="48"
            style="margin-bottom:1.5rem"
          />
          <h2 style="color:#002368;margin:0 0 0.5rem">Your sign-in code</h2>
          <p style="color:#444;margin:0 0 1.5rem">
            Use this code to sign in to the Silverleaf Staff Onboarding Hub.
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
          <hr style="border:none;border-top:1px solid #eee;margin:2rem 0"/>
          <p style="color:#bbb;font-size:0.75rem;margin:0">
            Silverleaf Academy Staff Onboarding Hub
          </p>
        </div>
      `,
    });

    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[otp-mail:error]", error);
    return { ok: false, error };
  }
}
