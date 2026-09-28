import { and, asc, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  departments,
  oneToFiveExtraDays,
  oneToFiveFeedback,
  oneToFiveHolidays,
  oneToFives,
  pulseChecks,
  userModules,
  users,
} from "@/db/schema";
import { sendEmail } from "@/lib/email/send-email";
import { oneToFivesDigestEmail } from "@/lib/email/templates/one-to-fives-digest";
import {
  addDays,
  isBeforeDeadline,
  nairobiDateString,
  ONE_TO_FIVE_DEADLINE_HOUR,
  ONE_TO_FIVE_DEADLINE_MINUTE,
  PULSE_DEADLINE_HOUR,
  PULSE_DEADLINE_MINUTE,
  latestThursday,
  weekdayForDate,
} from "@/lib/nairobi";
import { SAFE_USER_COLUMNS } from "@/lib/safe-columns";
import type { OneToFiveProgress, OneToFiveStatus } from "@/lib/one-to-fives-constants";

export type { OneToFiveProgress, OneToFiveStatus } from "@/lib/one-to-fives-constants";
export { PROGRESS_LABELS, STATUS_LABELS } from "@/lib/one-to-fives-constants";

function blank(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
}

export async function expectedSubmitters() {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      departmentId: users.departmentId,
      departmentName: departments.name,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(eq(users.isActive, true));

  return rows
    .filter((row) => isTrackedStaff(row.email, row.name))
    .sort((a, b) => {
      const dept = (a.departmentName ?? "No department").localeCompare(b.departmentName ?? "No department");
      return dept !== 0 ? dept : a.name.localeCompare(b.name);
    });
}

function isTrackedStaff(email: string, name: string) {
  if (/\.board@/i.test(email)) return false;
  if (/onboarding@/i.test(email)) return false;
  if (/product/i.test(name)) return false;
  return true;
}

export async function listHolidays() {
  return db.select().from(oneToFiveHolidays).orderBy(oneToFiveHolidays.holidayDate);
}

export async function listExtraDays() {
  return db.select().from(oneToFiveExtraDays).orderBy(oneToFiveExtraDays.workDate);
}

export async function isWorkDay(dateStr: string) {
  const [holiday] = await db
    .select({ id: oneToFiveHolidays.id })
    .from(oneToFiveHolidays)
    .where(eq(oneToFiveHolidays.holidayDate, dateStr))
    .limit(1);
  if (holiday) return false;

  const [extra] = await db
    .select({ id: oneToFiveExtraDays.id })
    .from(oneToFiveExtraDays)
    .where(eq(oneToFiveExtraDays.workDate, dateStr))
    .limit(1);
  if (extra) return true;

  const weekday = weekdayForDate(dateStr);
  return weekday !== 0 && weekday !== 6;
}

export async function previousWorkDate(fromDate: string) {
  for (let i = 1; i <= 14; i++) {
    const candidate = addDays(fromDate, -i);
    if (await isWorkDay(candidate)) return candidate;
  }
  return addDays(fromDate, -1);
}

export type SubmitOneToFiveInput = {
  userId: string;
  workDate?: string;
  slot1?: string;
  slot2?: string;
  slot3?: string;
  blockers?: string;
  notes?: string;
  priorSlot1Progress?: OneToFiveProgress | null;
  priorSlot2Progress?: OneToFiveProgress | null;
  priorSlot3Progress?: OneToFiveProgress | null;
  skipReason?: string;
  canManage: boolean;
  now?: Date;
};

export async function submitOneToFive(input: SubmitOneToFiveInput) {
  const now = input.now ?? new Date();
  const today = nairobiDateString(now);
  const workDate = input.workDate ?? today;

  if (workDate > today) {
    return { error: "Cannot file a 1–5 for a future date.", status: 400 as const };
  }
  if (!input.canManage && workDate !== today) {
    return { error: "Previous 1–5s are locked. Ask an admin if a correction is needed.", status: 403 as const };
  }
  if (!(await isWorkDay(workDate))) {
    return { error: "That date is a weekend or public holiday. An admin can add it as an extra work day.", status: 400 as const };
  }

  const skipReason = blank(input.skipReason);
  const slot1 = blank(input.slot1);
  const slot2 = blank(input.slot2);
  const slot3 = blank(input.slot3);
  if (!skipReason && !slot1 && !slot2 && !slot3) {
    return { error: "Fill at least one of today's three tasks, or give a skip reason.", status: 400 as const };
  }

  const [existing] = await db
    .select()
    .from(oneToFives)
    .where(and(eq(oneToFives.userId, input.userId), eq(oneToFives.workDate, workDate)))
    .limit(1);

  if (existing?.submittedAt && workDate !== today && !input.canManage) {
    return { error: "Previous 1–5s are not editable.", status: 403 as const };
  }

  const onTime = isBeforeDeadline(now, workDate, ONE_TO_FIVE_DEADLINE_HOUR, ONE_TO_FIVE_DEADLINE_MINUTE);
  const status: OneToFiveStatus = skipReason ? "skipped" : onTime && !existing?.submittedAt ? "on_time" : existing?.status === "on_time" ? "on_time" : "late";

  const values = {
    userId: input.userId,
    workDate,
    slot1,
    slot2,
    slot3,
    blockers: blank(input.blockers),
    notes: blank(input.notes),
    priorSlot1Progress: input.priorSlot1Progress ?? null,
    priorSlot2Progress: input.priorSlot2Progress ?? null,
    priorSlot3Progress: input.priorSlot3Progress ?? null,
    submittedAt: now,
    status,
    skipReason,
    updatedAt: now,
  };

  const [row] = existing
    ? await db.update(oneToFives).set(values).where(eq(oneToFives.id, existing.id)).returning()
    : await db.insert(oneToFives).values(values).returning();

  return { entry: row };
}

export type CloseOneToFiveInput = {
  userId: string;
  workDate?: string;
  slot1Progress?: OneToFiveProgress | null;
  slot2Progress?: OneToFiveProgress | null;
  slot3Progress?: OneToFiveProgress | null;
  canManage: boolean;
  now?: Date;
};

export async function closeOneToFiveDay(input: CloseOneToFiveInput) {
  const now = input.now ?? new Date();
  const today = nairobiDateString(now);
  const workDate = input.workDate ?? today;

  if (workDate > today) {
    return { error: "Cannot close a future 1–5.", status: 400 as const };
  }
  if (!input.canManage && workDate !== today) {
    return { error: "Only today's 1–5 can be closed out.", status: 403 as const };
  }

  const [existing] = await db
    .select()
    .from(oneToFives)
    .where(and(eq(oneToFives.userId, input.userId), eq(oneToFives.workDate, workDate)))
    .limit(1);

  if (!existing?.submittedAt || existing.status === "missed") {
    return { error: "Send this morning's 1–5 first.", status: 400 as const };
  }
  if (existing.status === "skipped") {
    return { error: "Skipped days don't need an end-of-day close.", status: 400 as const };
  }

  const [row] = await db
    .update(oneToFives)
    .set({
      slot1Progress: input.slot1Progress ?? existing.slot1Progress,
      slot2Progress: input.slot2Progress ?? existing.slot2Progress,
      slot3Progress: input.slot3Progress ?? existing.slot3Progress,
      closedAt: now,
      updatedAt: now,
    })
    .where(eq(oneToFives.id, existing.id))
    .returning();

  return { entry: row };
}

export async function addOneToFiveFeedback(input: { oneToFiveId: string; authorId: string; body: string }) {
  const body = blank(input.body);
  if (!body) return { error: "Write a short note.", status: 400 as const };

  const [entry] = await db.select({ id: oneToFives.id }).from(oneToFives).where(eq(oneToFives.id, input.oneToFiveId)).limit(1);
  if (!entry) return { error: "That 1–5 was not found.", status: 404 as const };

  const [row] = await db
    .insert(oneToFiveFeedback)
    .values({ oneToFiveId: input.oneToFiveId, authorId: input.authorId, body })
    .returning();
  return { feedback: row };
}

export type SubmitPulseInput = {
  userId: string;
  departmentId: string;
  weekThursday?: string;
  wins?: string;
  risks?: string;
  helpNeeded?: string;
  skipReason?: string;
  canManage: boolean;
  userDepartmentId?: string | null;
  now?: Date;
};

export async function submitPulse(input: SubmitPulseInput) {
  const now = input.now ?? new Date();
  const today = nairobiDateString(now);
  const weekThursday = input.weekThursday ?? latestThursday(today);

  if (weekdayForDate(weekThursday) !== 4) {
    return { error: "Pulse weeks are keyed to Thursday.", status: 400 as const };
  }
  if (weekThursday > today) {
    return { error: "Cannot file a pulse for a future Thursday.", status: 400 as const };
  }
  if (!input.canManage && weekThursday !== latestThursday(today)) {
    return { error: "Only this week's pulse can be edited.", status: 403 as const };
  }
  if (!input.canManage && input.userDepartmentId !== input.departmentId) {
    return { error: "You can only submit the pulse for your own department.", status: 403 as const };
  }
  if (!(await isWorkDay(weekThursday))) {
    return { error: "That Thursday is a holiday — no pulse is expected.", status: 400 as const };
  }

  const skipReason = blank(input.skipReason);
  const wins = blank(input.wins);
  const risks = blank(input.risks);
  const helpNeeded = blank(input.helpNeeded);
  if (!skipReason && !wins && !risks && !helpNeeded) {
    return { error: "Add wins, risks, or help needed — or a skip reason.", status: 400 as const };
  }

  const [existing] = await db
    .select()
    .from(pulseChecks)
    .where(and(eq(pulseChecks.departmentId, input.departmentId), eq(pulseChecks.weekThursday, weekThursday)))
    .limit(1);

  const onTime = isBeforeDeadline(now, weekThursday, PULSE_DEADLINE_HOUR, PULSE_DEADLINE_MINUTE);
  const status: OneToFiveStatus = skipReason
    ? "skipped"
    : onTime && !existing?.submittedAt
      ? "on_time"
      : existing?.status === "on_time"
        ? "on_time"
        : "late";

  const values = {
    departmentId: input.departmentId,
    weekThursday,
    wins,
    risks,
    helpNeeded,
    submittedBy: input.userId,
    submittedAt: now,
    status,
    skipReason,
    updatedAt: now,
  };

  const [row] = existing
    ? await db.update(pulseChecks).set(values).where(eq(pulseChecks.id, existing.id)).returning()
    : await db.insert(pulseChecks).values(values).returning();

  return { pulse: row };
}

export async function closeOneToFivesForDate(workDate: string, now = new Date()) {
  if (!(await isWorkDay(workDate))) {
    return { skipped: true as const, reason: "not_a_workday", marked: 0 };
  }
  if (isBeforeDeadline(now, workDate, ONE_TO_FIVE_DEADLINE_HOUR, ONE_TO_FIVE_DEADLINE_MINUTE)) {
    return { skipped: true as const, reason: "before_deadline", marked: 0 };
  }

  const expected = await expectedSubmitters();
  const existing = expected.length
    ? await db
        .select()
        .from(oneToFives)
        .where(and(inArray(oneToFives.userId, expected.map((u) => u.id)), eq(oneToFives.workDate, workDate)))
    : [];
  const byUser = new Map(existing.map((row) => [row.userId, row]));
  let marked = 0;

  for (const person of expected) {
    const row = byUser.get(person.id);
    if (row?.submittedAt) continue;
    if (row) {
      await db
        .update(oneToFives)
        .set({ status: "missed", updatedAt: now })
        .where(eq(oneToFives.id, row.id));
    } else {
      await db.insert(oneToFives).values({
        userId: person.id,
        workDate,
        status: "missed",
        submittedAt: null,
        updatedAt: now,
      });
    }
    marked++;
  }

  return { skipped: false as const, marked };
}

export async function closePulseChecksForThursday(weekThursday: string, now = new Date()) {
  if (weekdayForDate(weekThursday) !== 4) {
    return { skipped: true as const, reason: "not_thursday", marked: 0 };
  }
  if (!(await isWorkDay(weekThursday))) {
    return { skipped: true as const, reason: "not_a_workday", marked: 0 };
  }
  if (isBeforeDeadline(now, weekThursday, PULSE_DEADLINE_HOUR, PULSE_DEADLINE_MINUTE)) {
    return { skipped: true as const, reason: "before_deadline", marked: 0 };
  }

  const expectedDepts = await expectedPulseDepartments();
  const existing = expectedDepts.length
    ? await db
        .select()
        .from(pulseChecks)
        .where(
          and(inArray(pulseChecks.departmentId, expectedDepts.map((d) => d.id)), eq(pulseChecks.weekThursday, weekThursday)),
        )
    : [];
  const byDept = new Map(existing.map((row) => [row.departmentId, row]));
  let marked = 0;

  for (const dept of expectedDepts) {
    const row = byDept.get(dept.id);
    if (row?.submittedAt) continue;
    if (row) {
      await db
        .update(pulseChecks)
        .set({ status: "missed", updatedAt: now })
        .where(eq(pulseChecks.id, row.id));
    } else {
      await db.insert(pulseChecks).values({
        departmentId: dept.id,
        weekThursday,
        status: "missed",
        submittedAt: null,
        updatedAt: now,
      });
    }
    marked++;
  }

  return { skipped: false as const, marked };
}

export async function expectedPulseDepartments() {
  return db.select().from(departments).orderBy(asc(departments.name));
}

export async function digestRecipients() {
  const rows = await db
    .selectDistinct({ email: users.email })
    .from(users)
    .leftJoin(
      userModules,
      and(eq(userModules.userId, users.id), eq(userModules.module, "one_to_fives"), eq(userModules.level, "manage")),
    )
    .where(and(eq(users.isActive, true), or(eq(users.role, "admin"), sql`${userModules.id} is not null`)));
  return rows.map((r) => r.email);
}

export async function sendCloseDigest(workDate: string, includePulse: boolean) {
  const expected = await expectedSubmitters();
  const entries = expected.length
    ? await db
        .select()
        .from(oneToFives)
        .where(and(inArray(oneToFives.userId, expected.map((u) => u.id)), eq(oneToFives.workDate, workDate)))
    : [];
  const byUser = new Map(entries.map((row) => [row.userId, row]));
  const missed = expected.filter((p) => byUser.get(p.id)?.status === "missed");
  const late = expected.filter((p) => byUser.get(p.id)?.status === "late");
  const skippedNoReason = expected.filter((p) => {
    const row = byUser.get(p.id);
    return row?.status === "skipped" && !row.skipReason;
  });

  let pulseMissed: { name: string }[] | undefined;
  if (includePulse) {
    const depts = await expectedPulseDepartments();
    const pulses = depts.length
      ? await db
          .select()
          .from(pulseChecks)
          .where(
            and(inArray(pulseChecks.departmentId, depts.map((d) => d.id)), eq(pulseChecks.weekThursday, workDate)),
          )
      : [];
    const byDept = new Map(pulses.map((row) => [row.departmentId, row]));
    pulseMissed = depts.filter((d) => byDept.get(d.id)?.status === "missed").map((d) => ({ name: d.name }));
  }

  const recipients = await digestRecipients();
  if (recipients.length === 0) return { emailed: 0 };

  const { subject, html } = oneToFivesDigestEmail({
    workDate,
    missed,
    late,
    skippedNoReason,
    pulseMissed,
    boardUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard/one-to-fives`,
  });
  await sendEmail({ to: recipients, subject, html }).catch(() => {});
  return { emailed: recipients.length };
}

export async function runOneToFivesCron(now = new Date()) {
  const today = nairobiDateString(now);
  const oneToFivesResult = await closeOneToFivesForDate(today, now);
  const isThursday = weekdayForDate(today) === 4;
  const pulseResult = isThursday
    ? await closePulseChecksForThursday(today, now)
    : { skipped: true as const, reason: "not_thursday", marked: 0 };

  if (!oneToFivesResult.skipped || (!pulseResult.skipped && pulseResult.marked > 0)) {
    await sendCloseDigest(today, isThursday);
  }

  return { date: today, oneToFives: oneToFivesResult, pulse: pulseResult };
}

export async function loadBoard(workDate: string) {
  const [people, holidays, extraDays, depts] = await Promise.all([
    expectedSubmitters(),
    listHolidays(),
    listExtraDays(),
    expectedPulseDepartments(),
  ]);
  const from = addDays(workDate, -13);
  const entries = people.length
    ? await db.query.oneToFives.findMany({
        where: and(
          inArray(oneToFives.userId, people.map((p) => p.id)),
          gte(oneToFives.workDate, from),
          lte(oneToFives.workDate, workDate),
        ),
        orderBy: desc(oneToFives.workDate),
        with: {
          user: { columns: SAFE_USER_COLUMNS },
          feedback: {
            orderBy: (table, { asc: orderAsc }) => [orderAsc(table.createdAt)],
            with: { author: { columns: SAFE_USER_COLUMNS } },
          },
        },
      })
    : [];
  const weekThursday = latestThursday(workDate);
  const pulses = depts.length
    ? await db.query.pulseChecks.findMany({
        where: and(inArray(pulseChecks.departmentId, depts.map((d) => d.id)), eq(pulseChecks.weekThursday, weekThursday)),
        with: {
          department: true,
          submitter: { columns: SAFE_USER_COLUMNS },
        },
      })
    : [];

  return {
    workDate,
    workDay: await isWorkDay(workDate),
    weekThursday,
    people,
    entries,
    holidays,
    extraDays,
    departments: depts,
    pulses,
  };
}

export async function loadMine(userId: string, workDate: string) {
  const previous = await previousWorkDate(workDate);
  const [todayRow] = await db.query.oneToFives.findMany({
    where: and(eq(oneToFives.userId, userId), eq(oneToFives.workDate, workDate)),
    with: {
      feedback: {
        orderBy: (table, { asc: orderAsc }) => [orderAsc(table.createdAt)],
        with: { author: { columns: SAFE_USER_COLUMNS } },
      },
    },
    limit: 1,
  });
  const [previousRow] = await db
    .select()
    .from(oneToFives)
    .where(and(eq(oneToFives.userId, userId), eq(oneToFives.workDate, previous)))
    .limit(1);
  const history = await db.query.oneToFives.findMany({
    where: and(eq(oneToFives.userId, userId), lte(oneToFives.workDate, workDate)),
    orderBy: desc(oneToFives.workDate),
    with: {
      feedback: {
        orderBy: (table, { asc: orderAsc }) => [orderAsc(table.createdAt)],
        with: { author: { columns: SAFE_USER_COLUMNS } },
      },
    },
    limit: 14,
  });
  return { todayRow: todayRow ?? null, previousRow, previousDate: previous, history, workDay: await isWorkDay(workDate) };
}
