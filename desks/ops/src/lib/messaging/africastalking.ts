import type { MessagingProvider, SendMessageResult } from "@/lib/messaging/types";

/**
 * Africa's Talking SMS provider.
 * Docs: https://developers.africastalking.com/docs/sms/sending/bulk
 */
export function createAfricasTalkingProvider(): MessagingProvider | null {
  const apiKey = process.env.AFRICASTALKING_API_KEY?.trim();
  const username = process.env.AFRICASTALKING_USERNAME?.trim();
  if (!apiKey || !username) return null;

  const from = process.env.AFRICASTALKING_FROM?.trim();

  return {
    name: "africastalking",
    async send(input): Promise<SendMessageResult> {
      const params = new URLSearchParams({
        username,
        to: normalizePhone(input.to),
        message: input.body,
      });
      if (from) params.set("from", from);

      try {
        const res = await fetch(
          "https://api.africastalking.com/version1/messaging",
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/x-www-form-urlencoded",
              apiKey,
            },
            body: params.toString(),
          },
        );

        const text = await res.text();
        let data: {
          SMSMessageData?: {
            Recipients?: Array<{
              statusCode?: number;
              status?: string;
              messageId?: string;
            }>;
            Message?: string;
          };
        } = {};
        try {
          data = JSON.parse(text) as typeof data;
        } catch {
          // non-JSON error body
        }

        const recipient = data.SMSMessageData?.Recipients?.[0];
        const statusCode = recipient?.statusCode;
        const ok =
          res.ok &&
          (statusCode === undefined || statusCode === 100 || statusCode === 101);

        if (!ok) {
          return {
            ok: false,
            provider: "africastalking",
            channel: "sms",
            error:
              recipient?.status ??
              data.SMSMessageData?.Message ??
              text.slice(0, 240) ??
              `HTTP ${res.status}`,
          };
        }

        return {
          ok: true,
          provider: "africastalking",
          channel: "sms",
          providerMessageId: recipient?.messageId,
        };
      } catch (err) {
        return {
          ok: false,
          provider: "africastalking",
          channel: "sms",
          error: err instanceof Error ? err.message : "Africa's Talking request failed",
        };
      }
    },
  };
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0") && digits.length >= 9) {
    // Tanzania local → E.164 guess
    return `+255${digits.slice(1)}`;
  }
  if (digits.startsWith("255")) return `+${digits}`;
  return digits;
}
