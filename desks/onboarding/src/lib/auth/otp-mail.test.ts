import { describe, expect, it, vi, afterEach } from "vitest";

describe("sendOtpEmail SMTP gating", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("stubs in non-production when SMTP is unset", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASS", "");
    const { sendOtpEmail } = await import("./otp-mail");
    const result = await sendOtpEmail("hr@silverleaf.co.tz", "123456");
    expect(result.ok).toBe(true);
  });

  it("fails in production when SMTP is unset", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASS", "");
    const { sendOtpEmail } = await import("./otp-mail");
    const result = await sendOtpEmail("hr@silverleaf.co.tz", "123456");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not configured/i);
  });

  it("hides OTP sign-in in production when SMTP is unset", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASS", "");
    const { isOtpSignInAvailable } = await import("./otp-mail");
    expect(isOtpSignInAvailable()).toBe(false);
  });
});
