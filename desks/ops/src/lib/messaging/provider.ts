import { createAfricasTalkingProvider } from "@/lib/messaging/africastalking";
import { stubProvider } from "@/lib/messaging/stub";
import type { MessagingProvider } from "@/lib/messaging/types";

/** Prefer Africa's Talking when keys exist; otherwise stub (Day 6 demo-safe). */
export function getMessagingProvider(): MessagingProvider {
  return createAfricasTalkingProvider() ?? stubProvider;
}
