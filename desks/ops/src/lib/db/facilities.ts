import { createClient } from "@/lib/supabase/server";
import { auditUpdatePatch } from "@/lib/audit/attribution";
import { createExpense } from "@/lib/db/finance";

function logFacilitiesError(op: string, error: { message: string } | null | undefined) {
  if (error) console.error(`[facilities] ${op}:`, error.message);
}

/** Page past PostgREST’s default 1000-row cap so sheet imports fully render. */
async function fetchAllRows<T>(
  op: string,
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const pageSize = 1000;
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) {
      logFacilitiesError(op, error);
      return out;
    }
    const chunk = data ?? [];
    out.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

/** Returns RLS/query error message, or null when Facilities tables are readable. */
export async function probeFacilitiesAccess(): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.from("facilities_issues").select("id").limit(1);
  return error?.message ?? null;
}

export type IssueStatus = "open" | "in_progress" | "completed" | "cancelled";

export type FacilitiesIssue = {
  id: string;
  school_id: string | null;
  description: string;
  status: IssueStatus;
  reported_by: string | null;
  accountable: string | null;
  responsible: string | null;
  report_date: string;
  deadline: string | null;
  resolved_date: string | null;
  next_steps: string | null;
  notes: string | null;
  cost: number | null;
  expense_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
};

const ISSUE_SELECT =
  "id, school_id, description, status, reported_by, accountable, responsible, report_date, deadline, resolved_date, next_steps, notes, cost, expense_id, created_by, created_at, updated_by, updated_at";

export async function listIssues(input?: {
  status?: IssueStatus;
  schoolId?: string;
}): Promise<FacilitiesIssue[]> {
  const supabase = await createClient();
  let q = supabase
    .from("facilities_issues")
    .select(ISSUE_SELECT)
    .order("report_date", { ascending: false });
  if (input?.status) q = q.eq("status", input.status);
  if (input?.schoolId) q = q.eq("school_id", input.schoolId);
  const { data, error } = await q;
  if (error || !data) {
    if (error && /cost|expense_id|updated_by/i.test(error.message)) {
      let q2 = supabase
        .from("facilities_issues")
        .select(
          "id, school_id, description, status, reported_by, accountable, responsible, report_date, deadline, resolved_date, next_steps, notes, created_by, created_at, updated_at",
        )
        .order("report_date", { ascending: false });
      if (input?.status) q2 = q2.eq("status", input.status);
      if (input?.schoolId) q2 = q2.eq("school_id", input.schoolId);
      const retry = await q2;
      logFacilitiesError("listIssues", retry.error);
      if (retry.error || !retry.data) return [];
      return retry.data.map((row) => ({
        ...(row as FacilitiesIssue),
        cost: null,
        expense_id: null,
        updated_by: null,
      }));
    }
    logFacilitiesError("listIssues", error);
    return [];
  }
  return data as FacilitiesIssue[];
}

export async function createIssue(input: {
  schoolId?: string | null;
  description: string;
  status?: IssueStatus;
  reportedBy?: string | null;
  accountable?: string | null;
  responsible?: string | null;
  reportDate?: string;
  deadline?: string | null;
  resolvedDate?: string | null;
  nextSteps?: string | null;
  notes?: string | null;
  cost?: number | null;
  createdBy?: string | null;
}): Promise<{ issue: FacilitiesIssue } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facilities_issues")
    .insert({
      school_id: input.schoolId ?? null,
      description: input.description.trim(),
      status: input.status ?? "open",
      reported_by: input.reportedBy ?? null,
      accountable: input.accountable ?? null,
      responsible: input.responsible ?? null,
      report_date: input.reportDate ?? new Date().toISOString().slice(0, 10),
      deadline: input.deadline ?? null,
      resolved_date: input.resolvedDate ?? null,
      next_steps: input.nextSteps ?? null,
      notes: input.notes ?? null,
      cost: input.cost ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(ISSUE_SELECT)
    .single();
  if (error || !data) {
    if (error && /cost|expense_id|updated_by/i.test(error.message)) {
      const retry = await supabase
        .from("facilities_issues")
        .insert({
          school_id: input.schoolId ?? null,
          description: input.description.trim(),
          status: input.status ?? "open",
          reported_by: input.reportedBy ?? null,
          accountable: input.accountable ?? null,
          responsible: input.responsible ?? null,
          report_date: input.reportDate ?? new Date().toISOString().slice(0, 10),
          deadline: input.deadline ?? null,
          resolved_date: input.resolvedDate ?? null,
          next_steps: input.nextSteps ?? null,
          notes: input.notes ?? null,
          created_by: input.createdBy ?? null,
        })
        .select(
          "id, school_id, description, status, reported_by, accountable, responsible, report_date, deadline, resolved_date, next_steps, notes, created_by, created_at, updated_at",
        )
        .single();
      if (retry.error || !retry.data) {
        return { error: retry.error?.message ?? "Failed to create issue" };
      }
      return {
        issue: {
          ...(retry.data as FacilitiesIssue),
          cost: null,
          expense_id: null,
          updated_by: null,
        },
      };
    }
    return { error: error?.message ?? "Failed to create issue" };
  }
  return { issue: data as FacilitiesIssue };
}

export async function updateIssue(
  id: string,
  patch: Partial<{
    schoolId: string | null;
    description: string;
    status: IssueStatus;
    reportedBy: string | null;
    accountable: string | null;
    responsible: string | null;
    reportDate: string;
    deadline: string | null;
    resolvedDate: string | null;
    nextSteps: string | null;
    notes: string | null;
    cost: number | null;
    expenseId: string | null;
    updatedBy: string | null;
  }>,
): Promise<{ issue: FacilitiesIssue } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {
    ...auditUpdatePatch(patch.updatedBy),
  };
  if (patch.schoolId !== undefined) update.school_id = patch.schoolId;
  if (patch.description !== undefined) update.description = patch.description.trim();
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.reportedBy !== undefined) update.reported_by = patch.reportedBy;
  if (patch.accountable !== undefined) update.accountable = patch.accountable;
  if (patch.responsible !== undefined) update.responsible = patch.responsible;
  if (patch.reportDate !== undefined) update.report_date = patch.reportDate;
  if (patch.deadline !== undefined) update.deadline = patch.deadline;
  if (patch.resolvedDate !== undefined) update.resolved_date = patch.resolvedDate;
  if (patch.nextSteps !== undefined) update.next_steps = patch.nextSteps;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.cost !== undefined) update.cost = patch.cost;
  if (patch.expenseId !== undefined) update.expense_id = patch.expenseId;

  const { data, error } = await supabase
    .from("facilities_issues")
    .update(update)
    .eq("id", id)
    .select(ISSUE_SELECT)
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to update issue" };
  return { issue: data as FacilitiesIssue };
}

/**
 * Creates a Transport expense (category "maintenance") from an issue's cost
 * and links it back via expense_id, so Facilities R&M spend counts toward
 * the maintenance budget burn tracked in Transport's Ledger. The issue must
 * already have a school and a cost — an unscoped or free R&M ticket has
 * nothing meaningful to log.
 */
export async function logIssueAsExpense(
  issue: FacilitiesIssue,
  createdBy?: string | null,
): Promise<{ issue: FacilitiesIssue } | { error: string }> {
  if (!issue.school_id) return { error: "Issue has no campus — set one before logging an expense" };
  if (!issue.cost || issue.cost <= 0) return { error: "Enter a cost before logging an expense" };
  if (issue.expense_id) return { error: "This issue is already linked to an expense" };

  const outcome = await createExpense({
    schoolId: issue.school_id,
    category: "maintenance",
    title: `R&M: ${issue.description.slice(0, 80)}`,
    amount: issue.cost,
    spentOn: issue.resolved_date ?? issue.report_date,
    notes: `Auto-logged from Facilities issue ${issue.id}`,
    createdBy: createdBy ?? undefined,
  });
  if ("error" in outcome) return { error: outcome.error };

  return updateIssue(issue.id, { expenseId: outcome.expense.id });
}

export async function deleteIssue(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("facilities_issues").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

// Weekly checklist scores

export type ChecklistScore = {
  id: string;
  school_id: string | null;
  area: string;
  walkthrough_date: string;
  score: number;
  comments: string | null;
  inspector: string | null;
  created_by: string | null;
  created_at: string;
};

const CHECKLIST_SELECT =
  "id, school_id, area, walkthrough_date, score, comments, inspector, created_by, created_at";

export async function listChecklistScores(input?: {
  schoolId?: string;
}): Promise<ChecklistScore[]> {
  const supabase = await createClient();
  return fetchAllRows<ChecklistScore>("listChecklistScores", async (from, to) => {
    let q = supabase
      .from("facilities_checklist_scores")
      .select(CHECKLIST_SELECT)
      .order("walkthrough_date", { ascending: false })
      .range(from, to);
    if (input?.schoolId) q = q.eq("school_id", input.schoolId);
    return q;
  });
}

export type RepeatedLowChecklistAlert = {
  school_id: string | null;
  school_slug: string;
  school_name: string;
  area: string;
  streak: number;
  latest_score: number;
  latest_date: string;
};

export function findRepeatedLowChecklistAlerts(
  scores: ChecklistScore[],
  schools: Array<{ id: string; slug: string; name: string }>,
  options?: { minScore?: number; streakLength?: number },
): RepeatedLowChecklistAlert[] {
  const minScore = options?.minScore ?? 3;
  const streakLength = options?.streakLength ?? 3;
  const schoolById = new Map(schools.map((school) => [school.id, school]));
  const groups = new Map<string, ChecklistScore[]>();

  for (const score of scores) {
    const key = `${score.school_id ?? "none"}::${score.area}`;
    const list = groups.get(key);
    if (list) {
      list.push(score);
    } else {
      groups.set(key, [score]);
    }
  }

  const alerts: RepeatedLowChecklistAlert[] = [];
  for (const group of groups.values()) {
    const ordered = [...group].sort(
      (a, b) =>
        a.walkthrough_date.localeCompare(b.walkthrough_date) ||
        a.created_at.localeCompare(b.created_at),
    );

    let streak: ChecklistScore[] = [];
    for (const entry of ordered) {
      if (entry.score <= minScore) {
        streak.push(entry);
      } else {
        streak = [];
      }
    }

    if (streak.length < streakLength) continue;
    const last = streak[streak.length - 1];
    const school = schoolById.get(last.school_id ?? "");
    alerts.push({
      school_id: last.school_id,
      school_slug: school?.slug ?? "",
      school_name: school?.name ?? "All campuses",
      area: last.area,
      streak: streak.length,
      latest_score: last.score,
      latest_date: last.walkthrough_date,
    });
  }

  return alerts.sort((a, b) => {
    if (b.streak !== a.streak) return b.streak - a.streak;
    return b.latest_date.localeCompare(a.latest_date);
  });
}

export async function listRepeatedLowChecklistAlerts(input?: {
  schoolId?: string;
  minScore?: number;
  streakLength?: number;
}): Promise<RepeatedLowChecklistAlert[]> {
  const [scores, schools] = await Promise.all([
    listChecklistScores(input?.schoolId ? { schoolId: input.schoolId } : undefined),
    createClient().then(async (supabase) => {
      const { data } = await supabase.from("schools").select("id, slug, name");
      return data ?? [];
    }),
  ]);

  return findRepeatedLowChecklistAlerts(scores, schools, {
    minScore: input?.minScore,
    streakLength: input?.streakLength,
  });
}

export async function createChecklistScore(input: {
  schoolId?: string | null;
  area: string;
  walkthroughDate?: string;
  score: number;
  comments?: string | null;
  inspector?: string | null;
  createdBy?: string | null;
}): Promise<{ score: ChecklistScore } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facilities_checklist_scores")
    .insert({
      school_id: input.schoolId ?? null,
      area: input.area.trim(),
      walkthrough_date: input.walkthroughDate ?? new Date().toISOString().slice(0, 10),
      score: input.score,
      comments: input.comments ?? null,
      inspector: input.inspector ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(CHECKLIST_SELECT)
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create checklist score" };
  return { score: data as ChecklistScore };
}

export async function updateChecklistScore(
  id: string,
  patch: Partial<{
    schoolId: string | null;
    area: string;
    walkthroughDate: string;
    score: number;
    comments: string | null;
    inspector: string | null;
  }>,
): Promise<{ score: ChecklistScore } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.schoolId !== undefined) update.school_id = patch.schoolId;
  if (patch.area !== undefined) update.area = patch.area.trim();
  if (patch.walkthroughDate !== undefined) update.walkthrough_date = patch.walkthroughDate;
  if (patch.score !== undefined) update.score = patch.score;
  if (patch.comments !== undefined) update.comments = patch.comments;
  if (patch.inspector !== undefined) update.inspector = patch.inspector;

  const { data, error } = await supabase
    .from("facilities_checklist_scores")
    .update(update)
    .eq("id", id)
    .select(CHECKLIST_SELECT)
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to update checklist score" };
  return { score: data as ChecklistScore };
}

export async function deleteChecklistScore(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("facilities_checklist_scores").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

// Generator checklist log

export type GeneratorLog = {
  id: string;
  school_id: string | null;
  task: string;
  log_date: string;
  score: number;
  comments: string | null;
  inspector: string | null;
  created_by: string | null;
  created_at: string;
};

const GENERATOR_SELECT =
  "id, school_id, task, log_date, score, comments, inspector, created_by, created_at";

export async function listGeneratorLogs(input?: {
  schoolId?: string;
}): Promise<GeneratorLog[]> {
  const supabase = await createClient();
  return fetchAllRows<GeneratorLog>("listGeneratorLogs", async (from, to) => {
    let q = supabase
      .from("facilities_generator_log")
      .select(GENERATOR_SELECT)
      .order("log_date", { ascending: false })
      .range(from, to);
    if (input?.schoolId) q = q.eq("school_id", input.schoolId);
    return q;
  });
}

export async function createGeneratorLog(input: {
  schoolId?: string | null;
  task: string;
  logDate?: string;
  score: number;
  comments?: string | null;
  inspector?: string | null;
  createdBy?: string | null;
}): Promise<{ log: GeneratorLog } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facilities_generator_log")
    .insert({
      school_id: input.schoolId ?? null,
      task: input.task.trim(),
      log_date: input.logDate ?? new Date().toISOString().slice(0, 10),
      score: input.score,
      comments: input.comments ?? null,
      inspector: input.inspector ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(GENERATOR_SELECT)
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create generator log" };
  return { log: data as GeneratorLog };
}

export async function updateGeneratorLog(
  id: string,
  patch: Partial<{
    schoolId: string | null;
    task: string;
    logDate: string;
    score: number;
    comments: string | null;
    inspector: string | null;
  }>,
): Promise<{ log: GeneratorLog } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.schoolId !== undefined) update.school_id = patch.schoolId;
  if (patch.task !== undefined) update.task = patch.task.trim();
  if (patch.logDate !== undefined) update.log_date = patch.logDate;
  if (patch.score !== undefined) update.score = patch.score;
  if (patch.comments !== undefined) update.comments = patch.comments;
  if (patch.inspector !== undefined) update.inspector = patch.inspector;

  const { data, error } = await supabase
    .from("facilities_generator_log")
    .update(update)
    .eq("id", id)
    .select(GENERATOR_SELECT)
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to update generator log" };
  return { log: data as GeneratorLog };
}

export async function deleteGeneratorLog(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("facilities_generator_log").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

// Staff housing

export type FurnitureStatus = "furnished" | "unfurnished";

export type House = {
  id: string;
  school_id: string | null;
  house_letter: string | null;
  house_name: string;
  rooms_description: string | null;
  furniture_status: FurnitureStatus | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const HOUSE_SELECT =
  "id, school_id, house_letter, house_name, rooms_description, furniture_status, notes, created_by, created_at, updated_at";

export async function listHouses(input?: { schoolId?: string }): Promise<House[]> {
  const supabase = await createClient();
  let q = supabase.from("facilities_houses").select(HOUSE_SELECT).order("house_letter");
  if (input?.schoolId) q = q.eq("school_id", input.schoolId);
  const { data, error } = await q;
  logFacilitiesError("listHouses", error);
  if (error || !data) return [];
  return data as House[];
}

export async function createHouse(input: {
  schoolId?: string | null;
  houseLetter?: string | null;
  houseName: string;
  roomsDescription?: string | null;
  furnitureStatus?: FurnitureStatus;
  notes?: string | null;
  createdBy?: string | null;
}): Promise<{ house: House } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facilities_houses")
    .insert({
      school_id: input.schoolId ?? null,
      house_letter: input.houseLetter ?? null,
      house_name: input.houseName.trim(),
      rooms_description: input.roomsDescription ?? null,
      furniture_status: input.furnitureStatus ?? "unfurnished",
      notes: input.notes ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(HOUSE_SELECT)
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create house" };
  return { house: data as House };
}

export async function updateHouse(
  id: string,
  patch: Partial<{
    schoolId: string | null;
    houseLetter: string | null;
    houseName: string;
    roomsDescription: string | null;
    furnitureStatus: FurnitureStatus;
    notes: string | null;
  }>,
): Promise<{ house: House } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.schoolId !== undefined) update.school_id = patch.schoolId;
  if (patch.houseLetter !== undefined) update.house_letter = patch.houseLetter;
  if (patch.houseName !== undefined) update.house_name = patch.houseName.trim();
  if (patch.roomsDescription !== undefined) update.rooms_description = patch.roomsDescription;
  if (patch.furnitureStatus !== undefined) update.furniture_status = patch.furnitureStatus;
  if (patch.notes !== undefined) update.notes = patch.notes;

  const { data, error } = await supabase
    .from("facilities_houses")
    .update(update)
    .eq("id", id)
    .select(HOUSE_SELECT)
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to update house" };
  return { house: data as House };
}

export async function deleteHouse(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("facilities_houses").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

// House occupancy log

export type HouseOccupancy = {
  id: string;
  house_id: string;
  period_start: string;
  period_end: string;
  occupant: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

const OCCUPANCY_SELECT =
  "id, house_id, period_start, period_end, occupant, notes, created_by, created_at";

export async function listHouseOccupancy(input?: {
  houseId?: string;
}): Promise<HouseOccupancy[]> {
  const supabase = await createClient();
  let q = supabase
    .from("facilities_house_occupancy")
    .select(OCCUPANCY_SELECT)
    .order("period_start", { ascending: false });
  if (input?.houseId) q = q.eq("house_id", input.houseId);
  const { data, error } = await q;
  logFacilitiesError("listHouseOccupancy", error);
  if (error || !data) return [];
  return data as HouseOccupancy[];
}

export async function createHouseOccupancy(input: {
  houseId: string;
  periodStart: string;
  periodEnd: string;
  occupant: string;
  notes?: string | null;
  createdBy?: string | null;
}): Promise<{ occupancy: HouseOccupancy } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facilities_house_occupancy")
    .insert({
      house_id: input.houseId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      occupant: input.occupant.trim(),
      notes: input.notes ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(OCCUPANCY_SELECT)
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create occupancy entry" };
  return { occupancy: data as HouseOccupancy };
}

export async function updateHouseOccupancy(
  id: string,
  patch: Partial<{
    periodStart: string;
    periodEnd: string;
    occupant: string;
    notes: string | null;
  }>,
): Promise<{ occupancy: HouseOccupancy } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.periodStart !== undefined) update.period_start = patch.periodStart;
  if (patch.periodEnd !== undefined) update.period_end = patch.periodEnd;
  if (patch.occupant !== undefined) update.occupant = patch.occupant.trim();
  if (patch.notes !== undefined) update.notes = patch.notes;

  const { data, error } = await supabase
    .from("facilities_house_occupancy")
    .update(update)
    .eq("id", id)
    .select(OCCUPANCY_SELECT)
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to update occupancy entry" };
  return { occupancy: data as HouseOccupancy };
}

export async function deleteHouseOccupancy(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("facilities_house_occupancy").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

// Power meter log

export type PowerUsage = {
  id: string;
  school_id: string | null;
  reading_date: string;
  units_received: number | null;
  units_spent: number | null;
  balance_units: number | null;
  created_by: string | null;
  created_at: string;
};

const POWER_SELECT =
  "id, school_id, reading_date, units_received, units_spent, balance_units, created_by, created_at";

export async function listPowerUsage(input?: { schoolId?: string }): Promise<PowerUsage[]> {
  const supabase = await createClient();
  let q = supabase
    .from("facilities_power_usage")
    .select(POWER_SELECT)
    .order("reading_date", { ascending: false });
  if (input?.schoolId) q = q.eq("school_id", input.schoolId);
  const { data, error } = await q;
  logFacilitiesError("listPowerUsage", error);
  if (error || !data) return [];
  return data as PowerUsage[];
}

export async function createPowerUsage(input: {
  schoolId?: string | null;
  readingDate?: string;
  unitsReceived?: number | null;
  unitsSpent?: number | null;
  balanceUnits?: number | null;
  createdBy?: string | null;
}): Promise<{ entry: PowerUsage } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facilities_power_usage")
    .insert({
      school_id: input.schoolId ?? null,
      reading_date: input.readingDate ?? new Date().toISOString().slice(0, 10),
      units_received: input.unitsReceived ?? null,
      units_spent: input.unitsSpent ?? null,
      balance_units: input.balanceUnits ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(POWER_SELECT)
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create power usage entry" };
  return { entry: data as PowerUsage };
}

export async function updatePowerUsage(
  id: string,
  patch: Partial<{
    schoolId: string | null;
    readingDate: string;
    unitsReceived: number | null;
    unitsSpent: number | null;
    balanceUnits: number | null;
  }>,
): Promise<{ entry: PowerUsage } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.schoolId !== undefined) update.school_id = patch.schoolId;
  if (patch.readingDate !== undefined) update.reading_date = patch.readingDate;
  if (patch.unitsReceived !== undefined) update.units_received = patch.unitsReceived;
  if (patch.unitsSpent !== undefined) update.units_spent = patch.unitsSpent;
  if (patch.balanceUnits !== undefined) update.balance_units = patch.balanceUnits;

  const { data, error } = await supabase
    .from("facilities_power_usage")
    .update(update)
    .eq("id", id)
    .select(POWER_SELECT)
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to update power usage entry" };
  return { entry: data as PowerUsage };
}

export async function deletePowerUsage(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("facilities_power_usage").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

// CCTV inventory

export type Cctv = {
  id: string;
  school_id: string | null;
  camera_type: string | null;
  location: string;
  quantity: number;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const CCTV_SELECT =
  "id, school_id, camera_type, location, quantity, description, created_by, created_at, updated_at";

export async function listCctv(input?: { schoolId?: string }): Promise<Cctv[]> {
  const supabase = await createClient();
  let q = supabase.from("facilities_cctv").select(CCTV_SELECT).order("location");
  if (input?.schoolId) q = q.eq("school_id", input.schoolId);
  const { data, error } = await q;
  logFacilitiesError("listCctv", error);
  if (error || !data) return [];
  return data as Cctv[];
}

export async function createCctv(input: {
  schoolId?: string | null;
  cameraType?: string | null;
  location: string;
  quantity?: number;
  description?: string | null;
  createdBy?: string | null;
}): Promise<{ camera: Cctv } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facilities_cctv")
    .insert({
      school_id: input.schoolId ?? null,
      camera_type: input.cameraType ?? null,
      location: input.location.trim(),
      quantity: input.quantity ?? 1,
      description: input.description ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(CCTV_SELECT)
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create camera entry" };
  return { camera: data as Cctv };
}

export async function updateCctv(
  id: string,
  patch: Partial<{
    schoolId: string | null;
    cameraType: string | null;
    location: string;
    quantity: number;
    description: string | null;
  }>,
): Promise<{ camera: Cctv } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.schoolId !== undefined) update.school_id = patch.schoolId;
  if (patch.cameraType !== undefined) update.camera_type = patch.cameraType;
  if (patch.location !== undefined) update.location = patch.location.trim();
  if (patch.quantity !== undefined) update.quantity = patch.quantity;
  if (patch.description !== undefined) update.description = patch.description;

  const { data, error } = await supabase
    .from("facilities_cctv")
    .update(update)
    .eq("id", id)
    .select(CCTV_SELECT)
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to update camera entry" };
  return { camera: data as Cctv };
}

export async function deleteCctv(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("facilities_cctv").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

// Classroom inventory

export type ClassroomItem = {
  id: string;
  school_id: string | null;
  grade: string | null;
  item_name: string;
  quantity: number | null;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const CLASSROOM_ITEM_SELECT =
  "id, school_id, grade, item_name, quantity, remarks, created_by, created_at, updated_at";

export async function listClassroomItems(input?: {
  schoolId?: string;
}): Promise<ClassroomItem[]> {
  const supabase = await createClient();
  let q = supabase
    .from("facilities_classroom_items")
    .select(CLASSROOM_ITEM_SELECT)
    .order("grade")
    .order("item_name");
  if (input?.schoolId) q = q.eq("school_id", input.schoolId);
  const { data, error } = await q;
  logFacilitiesError("listClassroomItems", error);
  if (error || !data) return [];
  return data as ClassroomItem[];
}

export async function createClassroomItem(input: {
  schoolId?: string | null;
  grade?: string | null;
  itemName: string;
  quantity?: number | null;
  remarks?: string | null;
  createdBy?: string | null;
}): Promise<{ item: ClassroomItem } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facilities_classroom_items")
    .insert({
      school_id: input.schoolId ?? null,
      grade: input.grade ?? null,
      item_name: input.itemName.trim(),
      quantity: input.quantity ?? null,
      remarks: input.remarks ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(CLASSROOM_ITEM_SELECT)
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create item" };
  return { item: data as ClassroomItem };
}

export async function updateClassroomItem(
  id: string,
  patch: Partial<{
    schoolId: string | null;
    grade: string | null;
    itemName: string;
    quantity: number | null;
    remarks: string | null;
  }>,
): Promise<{ item: ClassroomItem } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.schoolId !== undefined) update.school_id = patch.schoolId;
  if (patch.grade !== undefined) update.grade = patch.grade;
  if (patch.itemName !== undefined) update.item_name = patch.itemName.trim();
  if (patch.quantity !== undefined) update.quantity = patch.quantity;
  if (patch.remarks !== undefined) update.remarks = patch.remarks;

  const { data, error } = await supabase
    .from("facilities_classroom_items")
    .update(update)
    .eq("id", id)
    .select(CLASSROOM_ITEM_SELECT)
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to update item" };
  return { item: data as ClassroomItem };
}

export async function deleteClassroomItem(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("facilities_classroom_items").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

// SOPs

export type Sop = {
  id: string;
  school_id: string | null;
  title: string;
  category: string | null;
  content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const SOP_SELECT =
  "id, school_id, title, category, content, created_by, created_at, updated_at";

export async function listSops(input?: { schoolId?: string }): Promise<Sop[]> {
  const supabase = await createClient();
  let q = supabase.from("facilities_sops").select(SOP_SELECT).order("title");
  if (input?.schoolId) q = q.eq("school_id", input.schoolId);
  const { data, error } = await q;
  logFacilitiesError("listSops", error);
  if (error || !data) return [];
  return data as Sop[];
}

export async function createSop(input: {
  schoolId?: string | null;
  title: string;
  category?: string | null;
  content: string;
  createdBy?: string | null;
}): Promise<{ sop: Sop } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facilities_sops")
    .insert({
      school_id: input.schoolId ?? null,
      title: input.title.trim(),
      category: input.category ?? null,
      content: input.content.trim(),
      created_by: input.createdBy ?? null,
    })
    .select(SOP_SELECT)
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create SOP" };
  return { sop: data as Sop };
}

export async function updateSop(
  id: string,
  patch: Partial<{
    schoolId: string | null;
    title: string;
    category: string | null;
    content: string;
  }>,
): Promise<{ sop: Sop } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.schoolId !== undefined) update.school_id = patch.schoolId;
  if (patch.title !== undefined) update.title = patch.title.trim();
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.content !== undefined) update.content = patch.content.trim();

  const { data, error } = await supabase
    .from("facilities_sops")
    .update(update)
    .eq("id", id)
    .select(SOP_SELECT)
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to update SOP" };
  return { sop: data as Sop };
}

export async function deleteSop(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("facilities_sops").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

// Top Sheet metrics — mirrors Monthly / Weekly FacilitiesTop 2026 in the master sheet.

export type FacilitiesKpi = {
  label: string;
  actual: number | null;
  target: number;
  unit: string;
  good: boolean | null;
};

export type FacilitiesTopSheet = {
  monthKey: string;
  monthLabel: string;
  from: string;
  to: string;
  ytdFrom: string;
  ytdTo: string;
  error: string | null;
  lead: string;
  campus: string;
  checklistWalkthroughsDone: number;
  checklistWalkthroughsTarget: number;
  checklistAvgScore: number | null;
  checklistAvgRatio: number | null;
  generatorDaysChecked: number;
  generatorAvgScore: number | null;
  outstandingTickets: number;
  avgOutstandingAgeDays: number | null;
  avgCloseDays: number | null;
  closedTickets: number;
  totalIssues: number;
  ytdChecklistAvg: number | null;
  ytdGeneratorAvg: number | null;
  counts: {
    issues: number;
    checklist: number;
    generator: number;
    houses: number;
    power: number;
    cctv: number;
    classrooms: number;
    sops: number;
  };
};

function monthBounds(monthKey: string): { from: string; to: string; label: string } {
  const [y, m] = monthKey.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  const label = new Date(y, m - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  return { from, to, label };
}

function dayDiff(a: string, b: string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
}

function avg(nums: number[]) {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 100) / 100;
}

export async function getFacilitiesTopSheet(input?: {
  monthKey?: string;
}): Promise<FacilitiesTopSheet> {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const monthKey = input?.monthKey && /^\d{4}-\d{2}$/.test(input.monthKey)
    ? input.monthKey
    : defaultMonth;
  const { from, to, label } = monthBounds(monthKey);
  const ytdFrom = `${monthKey.slice(0, 4)}-01-01`;
  const ytdTo = to;

  const supabase = await createClient();
  const [
    checklist,
    generator,
    issues,
    ytdChecklist,
    ytdGenerator,
    countIssues,
    countChecklist,
    countGenerator,
    countHouses,
    countPower,
    countCctv,
    countClassrooms,
    countSops,
    probe,
  ] = await Promise.all([
    fetchAllRows<{ score: number; walkthrough_date: string }>(
      "topsheet.checklist",
      async (a, b) =>
        supabase
          .from("facilities_checklist_scores")
          .select("score, walkthrough_date")
          .gte("walkthrough_date", from)
          .lte("walkthrough_date", to)
          .range(a, b),
    ),
    fetchAllRows<{ score: number; log_date: string }>("topsheet.generator", async (a, b) =>
      supabase
        .from("facilities_generator_log")
        .select("score, log_date")
        .gte("log_date", from)
        .lte("log_date", to)
        .range(a, b),
    ),
    fetchAllRows<{
      status: string;
      report_date: string;
      resolved_date: string | null;
    }>("topsheet.issues", async (a, b) =>
      supabase
        .from("facilities_issues")
        .select("status, report_date, resolved_date")
        .range(a, b),
    ),
    fetchAllRows<{ score: number }>("topsheet.ytdChecklist", async (a, b) =>
      supabase
        .from("facilities_checklist_scores")
        .select("score")
        .gte("walkthrough_date", ytdFrom)
        .lte("walkthrough_date", ytdTo)
        .range(a, b),
    ),
    fetchAllRows<{ score: number }>("topsheet.ytdGenerator", async (a, b) =>
      supabase
        .from("facilities_generator_log")
        .select("score")
        .gte("log_date", ytdFrom)
        .lte("log_date", ytdTo)
        .range(a, b),
    ),
    supabase.from("facilities_issues").select("id", { count: "exact", head: true }),
    supabase.from("facilities_checklist_scores").select("id", { count: "exact", head: true }),
    supabase.from("facilities_generator_log").select("id", { count: "exact", head: true }),
    supabase.from("facilities_houses").select("id", { count: "exact", head: true }),
    supabase.from("facilities_power_usage").select("id", { count: "exact", head: true }),
    supabase.from("facilities_cctv").select("id", { count: "exact", head: true }),
    supabase.from("facilities_classroom_items").select("id", { count: "exact", head: true }),
    supabase.from("facilities_sops").select("id", { count: "exact", head: true }),
    supabase.from("facilities_issues").select("id").limit(1),
  ]);

  const firstError = probe.error?.message ?? null;
  if (firstError) logFacilitiesError("getFacilitiesTopSheet", { message: firstError });

  const walkthroughDates = new Set(checklist.map((r) => r.walkthrough_date));
  const generatorDays = new Set(generator.map((r) => r.log_date));
  const checklistAvgScore = avg(checklist.map((r) => r.score));
  const generatorAvgScore = avg(generator.map((r) => r.score));

  const outstanding = issues.filter(
    (i) => i.status === "open" || i.status === "in_progress",
  );
  const closed = issues.filter(
    (i) =>
      i.status === "completed" &&
      i.resolved_date &&
      i.resolved_date >= from &&
      i.resolved_date <= to,
  );

  const todayIso = today.toISOString().slice(0, 10);
  const outstandingAges = outstanding
    .filter((i) => i.report_date)
    .map((i) => dayDiff(i.report_date as string, todayIso));
  const closeDays = issues
    .filter((i) => i.report_date && i.resolved_date)
    .map((i) => dayDiff(i.report_date as string, i.resolved_date as string));

  return {
    monthKey,
    monthLabel: label,
    from,
    to,
    ytdFrom,
    ytdTo,
    error: firstError,
    lead: "Baraka",
    campus: "Usa River",
    checklistWalkthroughsDone: walkthroughDates.size,
    checklistWalkthroughsTarget: 4,
    checklistAvgScore,
    checklistAvgRatio:
      checklistAvgScore === null
        ? null
        : Math.round((checklistAvgScore / 5) * 1000) / 1000,
    generatorDaysChecked: generatorDays.size,
    generatorAvgScore,
    outstandingTickets: outstanding.length,
    avgOutstandingAgeDays: avg(outstandingAges),
    avgCloseDays: avg(closeDays),
    closedTickets: closed.length,
    totalIssues: issues.length,
    ytdChecklistAvg: avg(ytdChecklist.map((r) => r.score)),
    ytdGeneratorAvg: avg(ytdGenerator.map((r) => r.score)),
    counts: {
      issues: countIssues.count ?? 0,
      checklist: countChecklist.count ?? 0,
      generator: countGenerator.count ?? 0,
      houses: countHouses.count ?? 0,
      power: countPower.count ?? 0,
      cctv: countCctv.count ?? 0,
      classrooms: countClassrooms.count ?? 0,
      sops: countSops.count ?? 0,
    },
  };
}

/** @deprecated Prefer getFacilitiesTopSheet — kept for any older callers. */
export async function getFacilitiesKpis(input: {
  from: string;
  to: string;
}): Promise<FacilitiesKpi[]> {
  const monthKey = input.to.slice(0, 7);
  const sheet = await getFacilitiesTopSheet({ monthKey });
  return [
    {
      label: "Weekly Checklist (avg score)",
      actual: sheet.checklistAvgScore,
      target: 4.5,
      unit: "/5",
      good:
        sheet.checklistAvgScore === null ? null : sheet.checklistAvgScore >= 4.5,
    },
    {
      label: "Generator Log (avg score)",
      actual: sheet.generatorAvgScore,
      target: 4.5,
      unit: "/5",
      good:
        sheet.generatorAvgScore === null ? null : sheet.generatorAvgScore >= 4.5,
    },
    {
      label: "Issues (avg days to resolve)",
      actual: sheet.avgCloseDays,
      target: 14,
      unit: " days",
      good: sheet.avgCloseDays === null ? null : sheet.avgCloseDays <= 14,
    },
  ];
}
