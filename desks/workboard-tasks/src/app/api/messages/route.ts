import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assertApiSecret } from "@/lib/auth/api-secret";

export async function GET(request: NextRequest) {
  try {
    assertApiSecret(request);
    const params = request.nextUrl.searchParams;
    const phone = params.get("phone") ?? undefined;
    const userId = params.get("userId") ?? undefined;
    const limit = Math.min(Number(params.get("limit") ?? 50), 200);
    const offset = Number(params.get("offset") ?? 0);

    const [messages, total] = await Promise.all([
      db.chatMessage.findMany({
        where: { phone, userId },
        include: {
          user: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.chatMessage.count({ where: { phone, userId } }),
    ]);

    return NextResponse.json({ messages, total, limit, offset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
