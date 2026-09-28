export type MessageChannel = "sms" | "whatsapp" | "stub";

export type MessageStatus = "queued" | "sent" | "failed" | "skipped";

export type MessageLog = {
  id: string;
  student_id: string | null;
  parent_phone: string;
  channel: MessageChannel;
  provider: string;
  template_key: string | null;
  body: string;
  status: MessageStatus;
  provider_message_id: string | null;
  error_message: string | null;
  boarding_event_id: string | null;
  created_by: string | null;
  created_at: string;
  sent_at: string | null;
};

export type ParentNotifyResult = {
  notified: boolean;
  status: MessageStatus;
  channel: MessageChannel;
  provider: string;
  message_log_id: string | null;
  error?: string;
};
