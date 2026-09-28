import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTodaySheet, submitDailyFive } from "@/lib/services/daily-sheet";

const submitSchema = z.object({
  userId: z.string(),
  slots: z
    .array(
      z.object({
        title: z.string().min(1),
        priority: z.enum(["LOWEST", "LOW", "MEDIUM", "HIGH", "HIGHEST"]),
      }),
    )
    .length(5),
});

export async function GET() {
  const sheet = await getTodaySheet();
  return NextResponse.json(sheet);
}

export async function POST(request: NextRequest) {
  try {
    const body = submitSchema.parse(await request.json());
    const sheet = await submitDailyFive(body.userId, body.slots);
    return NextResponse.json(sheet);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the 1–5";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
