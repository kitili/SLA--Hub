import { requireWhatsApp } from "@/lib/env";

type SendTextOptions = {
  to: string;
  body: string;
};

export async function sendWhatsAppText({ to, body }: SendTextOptions): Promise<string | null> {
  try {
    requireWhatsApp();
  } catch {
    if (process.env.NODE_ENV === "development") {
      console.log(`[whatsapp:dev] → ${to}\n${body}`);
      return `dev-${Date.now()}`;
    }
    throw new Error("WhatsApp credentials are not configured");
  }

  const { token, phoneNumberId, apiVersion } = requireWhatsApp();
  const normalizedTo = to.replace(/\D/g, "");

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizedTo,
        type: "text",
        text: { body },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WhatsApp send failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    messages?: Array<{ id: string }>;
  };

  return data.messages?.[0]?.id ?? null;
}

export function normalizePhone(input: string): string {
  return input.replace(/\D/g, "");
}
