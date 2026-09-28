import { renderEmailLayout } from "@/lib/email/layout";

export function loginOtpEmail(code: string) {
  const body = `
    <p>Your Silverleaf Data &amp; Tech sign-in code is:</p>
    <div style="text-align:center;margin:24px 0;">
      <span style="display:inline-block;font-size:30px;font-weight:700;letter-spacing:8px;color:#002368;background:#f7f7f7;padding:14px 22px;border-radius:8px;">${code}</span>
    </div>
    <p style="color:#666666;font-size:13px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
  `;
  return {
    subject: "Your sign-in code",
    html: renderEmailLayout(body),
  };
}
