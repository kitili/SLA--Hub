import type { MessagingProvider, SendMessageResult } from "@/lib/messaging/types";

/** Day 6 stub — always succeeds so demos work without provider keys. */
export const stubProvider: MessagingProvider = {
  name: "stub",
  async send(input): Promise<SendMessageResult> {
    return {
      ok: true,
      provider: "stub",
      channel: "stub",
      providerMessageId: `stub-${Date.now()}`,
      stubbed: true,
      error: `Stubbed send to ${input.to}`,
    };
  },
};
