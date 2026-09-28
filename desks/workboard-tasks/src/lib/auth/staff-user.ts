import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { setSession } from "@/lib/auth/session";

export async function openStaffSession(input: {
  email: string;
  name?: string | null;
  jobTitle?: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  const name = input.name?.trim() || null;
  const jobTitle = input.jobTitle?.trim() || null;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (!existing.isActive) return { ok: false as const, error: "inactive" as const };
    await db.user.update({
      where: { id: existing.id },
      data: {
        name: existing.name?.trim() ? existing.name : name,
        jobTitle: existing.jobTitle?.trim() ? existing.jobTitle : jobTitle,
      },
    });
    await setSession(existing.id);
    const refreshed = await db.user.findUnique({ where: { id: existing.id } });
    return { ok: true as const, isNew: !refreshed?.name?.trim() };
  }

  const env = getEnv();
  const org =
    (await db.organization.findUnique({ where: { slug: env.DEFAULT_ORG_SLUG } })) ??
    (await db.organization.create({
      data: { slug: env.DEFAULT_ORG_SLUG, name: "Silverleaf Academy" },
    }));

  const local = email.split("@")[0]?.replace(/[^a-z0-9._-]/g, "") || "staff";
  let username = local;
  const clash = await db.user.findUnique({ where: { username } });
  if (clash) username = `${local}.${email.length}`;

  const user = await db.user.create({
    data: {
      email,
      username,
      name,
      jobTitle,
      phone: `mail:${email}`,
      organizationId: org.id,
    },
  });
  await setSession(user.id);
  return { ok: true as const, isNew: !name };
}
