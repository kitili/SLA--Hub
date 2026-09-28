import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { normalizePhone } from "@/lib/whatsapp/client";

export async function getOrCreateUserByPhone(phone: string) {
  const normalized = normalizePhone(phone);
  const env = getEnv();

  const existing = await db.user.findUnique({
    where: { phone: normalized },
    include: { organization: true },
  });

  if (existing) {
    return existing;
  }

  const org =
    (await db.organization.findUnique({ where: { slug: env.DEFAULT_ORG_SLUG } })) ??
    (await db.organization.create({
      data: {
        slug: env.DEFAULT_ORG_SLUG,
        name: env.DEFAULT_ORG_NAME,
      },
    }));

  return db.user.create({
    data: {
      phone: normalized,
      organizationId: org.id,
      name: null,
    },
    include: { organization: true },
  });
}
