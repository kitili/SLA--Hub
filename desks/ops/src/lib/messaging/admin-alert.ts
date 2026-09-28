/**
 * Optional admin SMS alert (Africa's Talking) — stubs when keys missing.
 */

export type AdminAlertResult = {
  sent: boolean;
  provider: "africastalking" | "stub";
  error?: string;
};

export async function notifyAdminSms(input: {
  message: string;
}): Promise<AdminAlertResult> {
  const phone = process.env.ADMIN_ALERT_PHONE?.trim();
  const apiKey = process.env.AFRICASTALKING_API_KEY?.trim();
  const username = process.env.AFRICASTALKING_USERNAME?.trim();

  if (!phone) {
    return {
      sent: false,
      provider: "stub",
      error: "ADMIN_ALERT_PHONE not set",
    };
  }

  if (!apiKey || !username) {
    console.info("[admin-alert stub]", phone, input.message);
    return {
      sent: false,
      provider: "stub",
      error: "Africa's Talking keys missing — logged stub",
    };
  }

  try {
    const body = new URLSearchParams({
      username,
      to: phone.startsWith("+") ? phone : `+${phone}`,
      message: input.message.slice(0, 480),
    });

    const res = await fetch(
      "https://api.africastalking.com/version1/messaging",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          apiKey,
        },
        body,
      },
    );

    if (!res.ok) {
      const text = await res.text();
      return {
        sent: false,
        provider: "africastalking",
        error: text.slice(0, 200),
      };
    }

    return { sent: true, provider: "africastalking" };
  } catch (e) {
    return {
      sent: false,
      provider: "africastalking",
      error: e instanceof Error ? e.message : "SMS failed",
    };
  }
}
