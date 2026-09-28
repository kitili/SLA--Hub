import { NextRequest, NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { createSubscriptionSchema } from "@/lib/validation/subscription";
import { applySubscriptionDepartments, applySubscriptionRecipients } from "@/lib/subscriptions";

export async function GET() {
  const { response } = await requireModule("tech_tools", "view");
  if (response) return response;

  const rows = await db.query.subscriptions.findMany({
    orderBy: asc(subscriptions.renewalDate),
    with: {
      departmentLinks: { with: { department: true } },
      notifyRecipients: true,
    },
  });

  return NextResponse.json({
    subscriptions: rows.map((s) => ({
      ...s,
      departments: s.departmentLinks.map((l) => l.department),
      notifyEmails: s.notifyRecipients.map((r) => r.email),
      departmentLinks: undefined,
      notifyRecipients: undefined,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { response } = await requireModule("tech_tools", "manage");
  if (response) return response;

  const parsed = createSubscriptionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const subscription = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(subscriptions)
      .values({
        name: parsed.data.name,
        description: parsed.data.description,
        url: parsed.data.url,
        renewalDate: parsed.data.renewalDate,
      })
      .returning();

    await applySubscriptionDepartments(tx, created.id, parsed.data.departmentIds);
    await applySubscriptionRecipients(tx, created.id, parsed.data.notifyEmails);

    return created;
  });

  return NextResponse.json({ subscription }, { status: 201 });
}
