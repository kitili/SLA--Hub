import { Queue } from "bullmq";
import IORedis from "ioredis";
import { getEnv } from "@/lib/env";

export type WhatsAppJobPayload = {
  phone: string;
  body: string;
  waMessageId: string;
  rawPayload: unknown;
};

let connection: IORedis | null = null;
let queue: Queue<WhatsAppJobPayload> | null = null;

function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(getEnv().REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return connection;
}

export function getWhatsAppQueue(): Queue<WhatsAppJobPayload> {
  if (!queue) {
    queue = new Queue<WhatsAppJobPayload>("whatsapp-inbound", {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }
  return queue;
}

export async function enqueueWhatsAppMessage(payload: WhatsAppJobPayload): Promise<void> {
  try {
    await getWhatsAppQueue().add("process-message", payload, {
      jobId: payload.waMessageId,
    });
  } catch (error) {
    // Fallback for local dev without Redis — process inline
    if (process.env.NODE_ENV === "development") {
      const { processInboundWhatsAppMessage } = await import("@/lib/services/message-handler");
      await processInboundWhatsAppMessage(payload);
      return;
    }
    throw error;
  }
}
