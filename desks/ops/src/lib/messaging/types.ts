export type SendMessageInput = {
  to: string;
  body: string;
};

export type SendMessageResult = {
  ok: boolean;
  provider: string;
  channel: "sms" | "whatsapp" | "stub";
  providerMessageId?: string;
  error?: string;
  /** True when no live provider keys — message was only logged locally */
  stubbed?: boolean;
};

export interface MessagingProvider {
  readonly name: string;
  send(input: SendMessageInput): Promise<SendMessageResult>;
}
