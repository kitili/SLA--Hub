import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/rbac";
import { addOneToFiveFeedback } from "@/lib/one-to-fives";
import { oneToFiveFeedbackSchema } from "@/lib/validation/one-to-fives";

export async function POST(req: NextRequest) {
  const { session, response } = await requireSession();
  if (response || !session) return response;

  const parsed = oneToFiveFeedbackSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const result = await addOneToFiveFeedback({
    oneToFiveId: parsed.data.oneToFiveId,
    authorId: session.user.id,
    body: parsed.data.body,
  });
  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result, { status: 201 });
}
