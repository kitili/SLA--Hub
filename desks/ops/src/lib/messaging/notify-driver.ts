import { createAfricasTalkingProvider } from "@/lib/messaging/africastalking";
import { notifyAdminSms } from "@/lib/messaging/admin-alert";

export type SmsNotifyResult = {
  sent: boolean;
  provider: string;
  error?: string;
};

/** SMS to a driver phone (TZ local 0… → +255…). Stubs when AT keys missing. */
export async function notifyDriverSms(input: {
  phone: string | null | undefined;
  message: string;
}): Promise<SmsNotifyResult> {
  const phone = input.phone?.trim();
  if (!phone) {
    return { sent: false, provider: "stub", error: "No driver phone on file" };
  }

  const provider = createAfricasTalkingProvider();
  if (!provider) {
    console.info("[driver-sms stub]", phone, input.message);
    return {
      sent: false,
      provider: "stub",
      error: "Africa's Talking keys missing — logged stub",
    };
  }

  const result = await provider.send({
    to: phone,
    body: input.message.slice(0, 480),
  });

  return {
    sent: result.ok,
    provider: result.provider,
    error: result.ok ? undefined : result.error,
  };
}

export { notifyAdminSms };
