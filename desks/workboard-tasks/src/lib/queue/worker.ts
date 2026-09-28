import { Worker } from "bullmq";
import IORedis from "ioredis";
import { getEnv } from "@/lib/env";
import { processInboundWhatsAppMessage } from "@/lib/services/message-handler";
import type { WhatsAppJobPayload } from "@/lib/queue/index";

const connection = new IORedis(getEnv().REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const worker = new Worker<WhatsAppJobPayload>(
  "whatsapp-inbound",
  async (job) => {
    await processInboundWhatsAppMessage(job.data);
  },
  {
    connection,
    concurrency: 50,
  },
);

worker.on("completed", (job) => {
  console.log(`[worker] processed ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`[worker] failed ${job?.id}:`, error.message);
});

console.log("[worker] WhatsApp queue worker started");
