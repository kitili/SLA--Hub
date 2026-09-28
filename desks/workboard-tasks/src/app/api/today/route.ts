import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { addTodayTask, getTodaySheet } from "@/lib/services/daily-sheet";

const prioritySchema = z.enum(["LOWEST", "LOW", "MEDIUM", "HIGH", "HIGHEST"]).nullable().optional();

const listSchema = z.object({
  slots: z
    .array(
      z.object({
        title: z.string(),
        priority: prioritySchema,
        slot: z.number().int().min(1).max(5).optional(),
      }),
    )
    .min(1)
    .max(8),
});

const extraSchema = z.object({
  title: z.string().min(1),
  priority: prioritySchema,
  status: z.enum(["TODO", "IN_PROGRESS", "BACKLOG", "COMPLETED"]).optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  const sheet = await getTodaySheet(user.organizationId);
  const me = sheet.people.find((person) => person.id === user.id) ?? null;
  return NextResponse.json({ user, me });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Log in first" }, { status: 401 });

  try {
    const body = await request.json();
    if (body && Array.isArray(body.slots)) {
      const list = listSchema.parse(body);
      const filled = list.slots.filter((slot) => slot.title.trim());
      if (filled.length === 0) {
        return NextResponse.json({ error: "Fill in at least one task" }, { status: 400 });
      }
      for (const slot of filled) {
        await addTodayTask(user.id, {
          title: slot.title,
          priority: slot.priority ?? null,
          slot: slot.slot,
        });
      }
    } else {
      const extra = extraSchema.parse(body);
      await addTodayTask(user.id, {
        title: extra.title,
        priority: extra.priority ?? null,
        status: extra.status,
      });
    }
    const sheet = await getTodaySheet(user.organizationId);
    return NextResponse.json({ me: sheet.people.find((person) => person.id === user.id) ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
