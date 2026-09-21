import "server-only";

import { slaBotRepo } from "@/lib/db/repositories";
import { buildAdminHowToChunks } from "@/lib/sla-bot-admin";

export { buildAdminHowToChunks } from "@/lib/sla-bot-admin";

export async function syncSlaBotAdminKnowledge(): Promise<number> {
  return slaBotRepo.replaceKnowledge(buildAdminHowToChunks(), "admin");
}
