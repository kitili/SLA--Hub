import { prisma } from "./prisma";

export async function writeAudit(input: {
  actorId?: string | null;
  actorName: string;
  action: string;
  entity: string;
  entityId?: string;
  ref?: string;
  note?: string;
}) {
  await prisma.auditEvent.create({
    data: {
      actorId: input.actorId ?? null,
      actorName: input.actorName,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? "",
      ref: input.ref ?? "",
      note: input.note ?? "",
    },
  });
}
