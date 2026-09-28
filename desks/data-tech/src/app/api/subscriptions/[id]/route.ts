import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { updateSubscriptionSchema } from "@/lib/validation/subscription";
import { applySubscriptionDepartments, applySubscriptionRecipients } from "@/lib/subscriptions";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireModule("tech_tools", "view");
  if (response) return response;

  const { id } = await params;
  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.id, id),
    with: { departmentLinks: { with: { department: true } }, notifyRecipients: true },
  });
  if (!subscription) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    subscription: {
      ...subscription,
      departments: subscription.departmentLinks.map((l) => l.department),
      notifyEmails: subscription.notifyRecipients.map((r) => r.email),
      departmentLinks: undefined,
      notifyRecipients: undefined,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireModule("tech_tools", "manage");
  if (response) return response;

  const { id } = await params;
  const parsed = updateSubscriptionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { departmentIds, notifyEmails, ...fields } = parsed.data;

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(subscriptions)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    if (!row) return null;

    await applySubscriptionDepartments(tx, id, departmentIds);
    await applySubscriptionRecipients(tx, id, notifyEmails);

    return row;
  });

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ subscription: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireModule("tech_tools", "manage");
  if (response) return response;

  const { id } = await params;
  const [deleted] = await db.delete(subscriptions).where(eq(subscriptions.id, id)).returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
