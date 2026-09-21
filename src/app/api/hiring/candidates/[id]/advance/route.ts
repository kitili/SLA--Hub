import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { hiringPerformanceTasks } from "@/lib/db/schema/hiring";
import { advanceCandidateSchema } from "@/lib/hiring/admin-schemas";
import {
  hiringErrorResponse,
  invalidIdResponse,
} from "@/lib/hiring/http";
import { parseUuidParam } from "@/lib/hiring/ids";
import { advanceStage } from "@/lib/hiring/pipeline";
import { requireAdminApi } from "@/lib/hiring/require-admin-api";
import { pickAllowedFields } from "@/lib/security/fields";
import type { PipelineAction } from "@/lib/hiring/types";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseUuidParam((await context.params).id);
  if (!id) return invalidIdResponse();

  const raw = await request.json().catch(() => null);
  const parsed = advanceCandidateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid advance request" }, { status: 400 });
  }
  const body = pickAllowedFields(parsed.data, [
    "action",
    "interviewDate",
    "interviewStart",
    "interviewEnd",
    "interviewLocation",
    "interviewers",
    "taskId",
    "reviewDepts",
  ]);
  const action = body.action as PipelineAction;

  let schedule: {
    startIso: string;
    endIso: string;
    dateLabel: string;
    timeLabel: string;
    additionalAttendees: string[];
  } | null = null;

  if (
    action === "online_interview" &&
    body.interviewDate &&
    body.interviewStart &&
    body.interviewEnd
  ) {
    const date = body.interviewDate;
    const start = body.interviewStart;
    const end = body.interviewEnd;
    const additionalAttendees = body.interviewers
      ? body.interviewers
          .split(",")
          .map((email) => email.trim().toLowerCase())
          .filter((email) => email.includes("@"))
          .slice(0, 10)
      : [];

    schedule = {
      startIso: `${date}T${start}:00+03:00`,
      endIso: `${date}T${end}:00+03:00`,
      dateLabel: new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Africa/Dar_es_Salaam",
      }).format(new Date(`${date}T${start}:00+03:00`)),
      timeLabel: `${start} – ${end} (EAT, Dar es Salaam)`,
      additionalAttendees,
    };
  }

  let locationSchedule: {
    location: string;
    dateLabel: string;
    timeLabel: string;
    additionalAttendees: string[];
  } | null = null;

  if (
    action === "in_person" &&
    body.interviewDate &&
    body.interviewStart &&
    body.interviewLocation
  ) {
    const date = body.interviewDate;
    const start = body.interviewStart;
    const location = body.interviewLocation;
    const additionalAttendees = body.interviewers
      ? body.interviewers
          .split(",")
          .map((email) => email.trim().toLowerCase())
          .filter((email) => email.includes("@"))
          .slice(0, 10)
      : [];

    locationSchedule = {
      location,
      dateLabel: new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Africa/Dar_es_Salaam",
      }).format(new Date(`${date}T${start}:00+03:00`)),
      timeLabel: `${start} EAT`,
      additionalAttendees,
    };
  }

  let performanceTask: {
    taskId: string;
    title: string;
    description: string | null;
    fileLink: string | null;
    managerEmail: string | null;
  } | null = null;

  if (action === "performance" && body.taskId) {
    const [task] = await db
      .select()
      .from(hiringPerformanceTasks)
      .where(eq(hiringPerformanceTasks.id, body.taskId))
      .limit(1);
    if (task) {
      // reviewDepts overrides the task-level managerEmail with HR-selected dept emails
      const deptEmails = body.reviewDepts
        ? body.reviewDepts
            .split(",")
            .map((e) => e.trim().toLowerCase())
            .filter((e) => e.includes("@"))
            .slice(0, 10)
            .join(",")
        : null;
      performanceTask = {
        taskId: task.id,
        title: task.title,
        description: task.description,
        fileLink: task.fileLink,
        managerEmail: deptEmails || task.managerEmail,
      };
    }
  }

  try {
    const result = await advanceStage(
      id,
      action,
      admin.id,
      schedule,
      locationSchedule,
      performanceTask,
    );
    return NextResponse.json({
      ok: true,
      action: result.action,
      emailStubbed: result.emailStubbed,
    });
  } catch (err) {
    // Admin-only route — expose the real error so HR can act on it
    const msg = err instanceof Error ? err.message : "Could not advance candidate";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
