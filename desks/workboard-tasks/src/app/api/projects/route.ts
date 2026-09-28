import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertApiSecret } from "@/lib/auth/api-secret";

const createProjectSchema = z.object({
  organizationId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    assertApiSecret(request);
    const organizationId = request.nextUrl.searchParams.get("organizationId") ?? undefined;

    const projects = await db.project.findMany({
      where: { organizationId, isActive: true },
      include: {
        _count: {
          select: {
            tasks: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    assertApiSecret(request);
    const body = createProjectSchema.parse(await request.json());

    const project = await db.project.create({
      data: body,
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
