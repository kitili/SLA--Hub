import { createClient } from "@/lib/supabase/server";
import { getDriverById } from "@/lib/db/drivers";
import { getSchoolToday } from "@/lib/date/schoolDate";
import { notifyIncidentAlert } from "@/lib/messaging/notify-incident-alert";
import { buildQrToken, isUuid, parseQrToken } from "@/lib/qr/token";
import {
  buildGuardianQrToken,
  parseGuardianQrToken,
} from "@/lib/qr/guardian-token";
import type { SchoolScope } from "@/lib/schools";
import {
  sortByAlpha,
  sortStudentsByName,
  sortTripsHistoryByDateBus,
  sortTripsTodayByBus,
} from "@/lib/sort/alphabetical";
import type {
  BoardingEvent,
  BoardingEventType,
  BoardingResult,
  Bus,
  QrResolveResult,
  RouteStop,
  School,
  Stop,
  StopKind,
  StudentWithDetails,
  Trip,
  TripDirection,
  TripLocation,
  TripWithBus,
} from "@/types/database";
import {
  estimateEtaOffsetsMinutes,
  haversineKm,
  measurePathKm,
  optimizeStopOrder,
} from "@/lib/routing/optimize";

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type StudentRow = {
  id: string;
  school_id: string;
  first_name: string;
  last_name: string;
  class_name: string | null;
  active: boolean;
  qr_codes:
    | { code: string; active: boolean }
    | { code: string; active: boolean }[]
    | null;
  fee_balances:
    | { balance: number; currency: string; synced_at: string | null }
    | { balance: number; currency: string; synced_at: string | null }[]
    | null;
  student_parents:
    | {
        is_primary: boolean;
        parents:
          | { full_name: string; phone: string; email: string | null }
          | { full_name: string; phone: string; email: string | null }[]
          | null;
      }[]
    | null;
  schools:
    | { name: string; slug: string }
    | { name: string; slug: string }[]
    | null;
};

const studentSelect = `
  id,
  school_id,
  first_name,
  last_name,
  class_name,
  active,
  schools ( name, slug ),
  qr_codes ( code, active ),
  fee_balances ( balance, currency, synced_at ),
  student_parents (
    is_primary,
    parents ( full_name, phone, email )
  )
`;

function mapStudentRow(row: StudentRow): StudentWithDetails {
  const qrRow = first(row.qr_codes);
  const qrList = Array.isArray(row.qr_codes) ? row.qr_codes : qrRow ? [qrRow] : [];
  const qr = qrList.find((q) => q.active)?.code ?? qrList[0]?.code ?? null;

  const fee = first(row.fee_balances);

  const links = Array.isArray(row.student_parents) ? row.student_parents : [];
  const primaryLink = links.find((l) => l.is_primary) ?? links[0] ?? null;
  const parent = first(primaryLink?.parents ?? null);
  const school = first(row.schools);

  return {
    id: row.id,
    school_id: row.school_id,
    first_name: row.first_name,
    last_name: row.last_name,
    class_name: row.class_name,
    active: row.active,
    qr_code: qr,
    fee_balance: Number(fee?.balance ?? 0),
    fee_currency: fee?.currency ?? "TZS",
    fee_synced_at: fee?.synced_at ?? null,
    parent_name: parent?.full_name ?? null,
    parent_phone: parent?.phone ?? null,
    parent_email: parent?.email ?? null,
    school_name: school?.name ?? null,
    school_slug: school?.slug ?? null,
  };
}

async function getSchoolIds(schoolSlug?: SchoolScope): Promise<string[]> {
  const supabase = await createClient();

  if (schoolSlug) {
    const { data } = await supabase
      .from("schools")
      .select("id")
      .eq("slug", schoolSlug)
      .maybeSingle();
    return data ? [data.id] : [];
  }

  const { data } = await supabase.from("schools").select("id");
  return data?.map((row) => row.id) ?? [];
}

export async function getStudentById(
  studentId: string,
): Promise<StudentWithDetails | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("students")
    .select(studentSelect)
    .eq("id", studentId)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) return null;
  return mapStudentRow(data as StudentRow);
}

const CAMPUS_QR_PREFIX: Record<string, string> = {
  usariver: "USR",
  "arusha-modern": "AM",
  kijenge: "KIJ",
  ilboru: "ILB",
  boma: "BOM",
};

function normalizeStudentName(first: string, last: string): string {
  return `${first}${last}`.toLowerCase().replace(/[^a-z]/g, "");
}

async function generateNextQrCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
): Promise<string> {
  const { data: school } = await supabase
    .from("schools")
    .select("slug")
    .eq("id", schoolId)
    .maybeSingle();
  const prefix = CAMPUS_QR_PREFIX[school?.slug ?? ""] ?? "SLV";

  const { data: last } = await supabase
    .from("qr_codes")
    .select("code")
    .like("code", `SLV-${prefix}-%`)
    .order("code", { ascending: false })
    .limit(1);

  const lastCode = last?.[0]?.code as string | undefined;
  const lastNum = lastCode ? parseInt(lastCode.split("-").pop() ?? "0", 10) : 0;
  const nextNum = Number.isFinite(lastNum) ? lastNum + 1 : 1;
  return `SLV-${prefix}-${String(nextNum).padStart(4, "0")}`;
}

export async function createStudent(input: {
  schoolId: string;
  firstName: string;
  lastName: string;
  className?: string | null;
  parentName?: string;
  parentPhone?: string;
  feeBalance?: number;
  feeCurrency?: string;
}): Promise<{ student: StudentWithDetails } | { error: string }> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("students")
    .select("first_name, last_name")
    .eq("school_id", input.schoolId)
    .eq("active", true);

  const nameKey = normalizeStudentName(input.firstName, input.lastName);
  const isDuplicate = (existing ?? []).some(
    (s) => normalizeStudentName(s.first_name, s.last_name) === nameKey,
  );
  if (isDuplicate) {
    return {
      error: `A student named "${input.firstName} ${input.lastName}" already exists at this campus. Check Students search before adding a duplicate.`,
    };
  }

  const { data: student, error: studentErr } = await supabase
    .from("students")
    .insert({
      school_id: input.schoolId,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      class_name: input.className?.trim() || null,
    })
    .select("id, school_id")
    .single();

  if (studentErr || !student) {
    return { error: studentErr?.message ?? "Failed to create student" };
  }

  const code = await generateNextQrCode(supabase, student.school_id);
  const { error: qrErr } = await supabase
    .from("qr_codes")
    .insert({ student_id: student.id, code, active: true });
  if (qrErr) return { error: `Student created but QR failed: ${qrErr.message}` };

  if (input.feeBalance != null) {
    const { error: feeErr } = await supabase.from("fee_balances").insert({
      student_id: student.id,
      balance: input.feeBalance,
      currency: input.feeCurrency ?? "TZS",
    });
    if (feeErr) return { error: `Student created but fee balance failed: ${feeErr.message}` };
  }

  if (input.parentName?.trim() && input.parentPhone?.trim()) {
    const { data: parent, error: parentErr } = await supabase
      .from("parents")
      .insert({
        full_name: input.parentName.trim(),
        phone: input.parentPhone.trim(),
      })
      .select("id")
      .single();
    if (parentErr || !parent) {
      return { error: `Student created but parent failed: ${parentErr?.message}` };
    }
    const { error: linkErr } = await supabase.from("student_parents").insert({
      student_id: student.id,
      parent_id: parent.id,
      is_primary: true,
    });
    if (linkErr) {
      return { error: `Student created but parent link failed: ${linkErr.message}` };
    }
  }

  const full = await getStudentById(student.id);
  if (!full) return { error: "Student created but failed to load full record" };
  return { student: full };
}

// Edits a student's own details and primary parent contact. Campus, QR code
// and fee balance are deliberately not editable here: QR codes are numbered
// per campus and pickup stops belong to a campus's routes, so a campus move
// would break both; fees come from EdAdmin. "Delete" is active = false, so
// trip and boarding history keep pointing at a real student row.
export async function updateStudent(input: {
  studentId: string;
  firstName: string;
  lastName: string;
  className?: string | null;
  active: boolean;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
}): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();

  const { data: current, error: currentErr } = await supabase
    .from("students")
    .select("id, school_id")
    .eq("id", input.studentId)
    .maybeSingle();
  if (currentErr) return { error: currentErr.message };
  if (!current) return { error: "Student not found" };

  // Same duplicate rule as createStudent, but skipping the student being
  // edited — only matters if they'll be active after this save.
  if (input.active) {
    const { data: existing } = await supabase
      .from("students")
      .select("id, first_name, last_name")
      .eq("school_id", current.school_id)
      .eq("active", true)
      .neq("id", input.studentId);

    const nameKey = normalizeStudentName(input.firstName, input.lastName);
    const isDuplicate = (existing ?? []).some(
      (s) => normalizeStudentName(s.first_name, s.last_name) === nameKey,
    );
    if (isDuplicate) {
      return {
        error: `Another active student named "${input.firstName} ${input.lastName}" already exists at this campus.`,
      };
    }
  }

  const { error: updateErr } = await supabase
    .from("students")
    .update({
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      class_name: input.className?.trim() || null,
      active: input.active,
    })
    .eq("id", input.studentId);
  if (updateErr) return { error: updateErr.message };

  if (input.parentName?.trim() && input.parentPhone?.trim()) {
    const parentOutcome = await upsertParentContact({
      studentId: input.studentId,
      fullName: input.parentName.trim(),
      phone: input.parentPhone.trim(),
      email: input.parentEmail?.trim() || null,
    });
    if ("error" in parentOutcome) {
      return { error: `Student saved but parent contact failed: ${parentOutcome.error}` };
    }
  }

  return { ok: true };
}

/** Deactivated students, newest change first — so an admin can bring one back. */
export async function getDeactivatedStudents(
  schoolSlug?: SchoolScope,
): Promise<StudentWithDetails[]> {
  const supabase = await createClient();
  const schoolIds = await getSchoolIds(schoolSlug);
  if (schoolIds.length === 0) return [];

  const { data: students, error } = await supabase
    .from("students")
    .select(studentSelect)
    .in("school_id", schoolIds)
    .eq("active", false)
    .order("updated_at", { ascending: false });

  if (error || !students) return [];
  return students.map((row) => mapStudentRow(row as StudentRow));
}

export async function resolveStudentByQr(
  raw: string,
): Promise<QrResolveResult | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const supabase = await createClient();

  const token = parseQrToken(trimmed);
  if (token) {
    const student = await getStudentById(token.studentId);
    if (!student || student.school_id !== token.schoolId) return null;

    return {
      student,
      matched_by: "token",
      token: buildQrToken(student.school_id, student.id),
    };
  }

  const { data: qrRow } = await supabase
    .from("qr_codes")
    .select("student_id, code")
    .eq("code", trimmed)
    .eq("active", true)
    .maybeSingle();

  if (qrRow) {
    const student = await getStudentById(qrRow.student_id);
    if (!student) return null;

    return {
      student,
      matched_by: "code",
      token: buildQrToken(student.school_id, student.id),
    };
  }

  if (isUuid(trimmed)) {
    const student = await getStudentById(trimmed);
    if (!student) return null;

    return {
      student,
      matched_by: "student_id",
      token: buildQrToken(student.school_id, student.id),
    };
  }

  return null;
}

export async function generateQrToken(input: {
  studentId: string;
  regenerate?: boolean;
}) {
  const supabase = await createClient();
  const student = await getStudentById(input.studentId);

  if (!student) {
    return { error: "Student not found" };
  }

  const token = buildQrToken(student.school_id, student.id);

  if (!input.regenerate && student.qr_code) {
    return {
      token,
      code: student.qr_code,
      student,
      created: false,
    };
  }

  if (input.regenerate) {
    const { error: deactivateError } = await supabase
      .from("qr_codes")
      .update({ active: false })
      .eq("student_id", student.id)
      .eq("active", true);

    if (deactivateError) {
      return { error: deactivateError.message };
    }
  } else {
    const { data: existing } = await supabase
      .from("qr_codes")
      .select("code")
      .eq("student_id", student.id)
      .eq("active", true)
      .maybeSingle();

    if (existing) {
      return {
        token,
        code: existing.code,
        student: { ...student, qr_code: existing.code },
        created: false,
      };
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("qr_codes")
    .insert({
      student_id: student.id,
      code: token,
      active: true,
    })
    .select("code")
    .single();

  if (insertError || !inserted) {
    return { error: insertError?.message ?? "Failed to create QR token" };
  }

  return {
    token,
    code: inserted.code,
    student: { ...student, qr_code: inserted.code },
    created: true,
  };
}

export async function getSchools(): Promise<School[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schools")
    .select("id, name, slug")
    .order("name");

  if (error || !data) return [];
  return sortByAlpha(data, (s) => s.name);
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createSchool(input: {
  name: string;
  slug?: string;
}): Promise<{ school: School } | { error: string }> {
  const supabase = await createClient();
  const name = input.name.trim();
  const slug = slugify(input.slug?.trim() || name);

  if (!name || !slug) return { error: "Campus name is required" };

  const { data, error } = await supabase
    .from("schools")
    .insert({ name, slug })
    .select("id, name, slug")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return {
        error: `A campus with slug "${slug}" already exists — choose a different name or slug.`,
      };
    }
    return { error: error?.message ?? "Failed to create campus" };
  }
  return { school: data };
}

export async function updateSchool(
  schoolId: string,
  input: { name?: string; slug?: string },
): Promise<{ school: School } | { error: string }> {
  const supabase = await createClient();

  const update: Record<string, string> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { error: "Campus name is required" };
    update.name = name;
  }
  if (input.slug !== undefined) {
    const slug = slugify(input.slug);
    if (!slug) return { error: "Campus name is required" };
    update.slug = slug;
  }

  const { data, error } = await supabase
    .from("schools")
    .update(update)
    .eq("id", schoolId)
    .select("id, name, slug")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return {
        error: `A campus with slug "${update.slug}" already exists — choose a different name or slug.`,
      };
    }
    return { error: error?.message ?? "Failed to update campus" };
  }
  return { school: data };
}

/** Hard-delete a campus. Refuses if students or buses still exist unless force. */
export async function deleteSchool(
  schoolId: string,
  opts?: { force?: boolean },
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();

  if (!opts?.force) {
    const [{ count: studentCount }, { count: busCount }] = await Promise.all([
      supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId),
      supabase
        .from("buses")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId),
    ]);
    if ((studentCount ?? 0) > 0 || (busCount ?? 0) > 0) {
      return {
        error: `Campus still has ${studentCount ?? 0} student(s) and ${busCount ?? 0} bus(es). Move/delete them first, or pass force=1.`,
      };
    }
  }

  const { error } = await supabase.from("schools").delete().eq("id", schoolId);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function getStudents(
  schoolSlug?: SchoolScope,
): Promise<StudentWithDetails[]> {
  const supabase = await createClient();
  const schoolIds = await getSchoolIds(schoolSlug);
  if (schoolIds.length === 0) return [];

  const { data: students, error } = await supabase
    .from("students")
    .select(studentSelect)
    .in("school_id", schoolIds)
    .eq("active", true)
    .order("last_name")
    .order("first_name");

  if (error || !students) return [];

  return sortStudentsByName(
    students.map((row) => mapStudentRow(row as StudentRow)),
  );
}

// A matron's "own bus" isn't a persistent assignment in the schema — it's
// whichever bus she picked and started/resumed a trip on. Prefer today's
// trip; fall back to her most recent trip ever so the roster isn't empty
// just because she hasn't started today's trip yet.
export async function getMatronBusId(matronId: string): Promise<string | null> {
  const supabase = await createClient();
  const today = getSchoolToday();

  const { data: todayTrip } = await supabase
    .from("trips")
    .select("bus_id")
    .eq("matron_id", matronId)
    .eq("trip_date", today)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (todayTrip?.bus_id) return todayTrip.bus_id;

  const { data: recentTrip } = await supabase
    .from("trips")
    .select("bus_id")
    .eq("matron_id", matronId)
    .order("trip_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return recentTrip?.bus_id ?? null;
}

// Students are linked to a bus via student_stop_assignments.route_id ->
// buses.route_id (the same join already used by getRouteCapacityCheck),
// not a direct bus_id column on students.
export async function getStudentsForBus(
  busId: string,
): Promise<StudentWithDetails[]> {
  const supabase = await createClient();

  const { data: bus } = await supabase
    .from("buses")
    .select("route_id")
    .eq("id", busId)
    .maybeSingle();
  if (!bus?.route_id) return [];

  const { data: assignments } = await supabase
    .from("student_stop_assignments")
    .select("student_id")
    .eq("route_id", bus.route_id);
  const studentIds = [
    ...new Set((assignments ?? []).map((a) => a.student_id as string)),
  ];
  if (studentIds.length === 0) return [];

  const { data: students, error } = await supabase
    .from("students")
    .select(studentSelect)
    .in("id", studentIds)
    .eq("active", true)
    .order("last_name")
    .order("first_name");

  if (error || !students) return [];
  return sortStudentsByName(
    students.map((row) => mapStudentRow(row as StudentRow)),
  );
}

/** True when the student is assigned to this bus via the live-sheet route. */
export async function isStudentOnBus(
  studentId: string,
  busId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data: bus } = await supabase
    .from("buses")
    .select("route_id")
    .eq("id", busId)
    .maybeSingle();
  if (!bus?.route_id) return false;

  const { data } = await supabase
    .from("student_stop_assignments")
    .select("student_id")
    .eq("route_id", bus.route_id)
    .eq("student_id", studentId)
    .limit(1)
    .maybeSingle();

  return Boolean(data?.student_id);
}

// Full roster for everyone — matrons filter by class / bus / school in the UI.
// busId is still returned so the roster can default-filter to the matron's bus.
export async function getStudentsForSession(session: {
  userId: string;
  role: string;
}): Promise<{ students: StudentWithDetails[]; busId: string | null }> {
  const students = sortStudentsByName(await getStudents());
  if (session.role === "admin" || session.role === "finance") {
    return { students, busId: null };
  }

  const busId = await getMatronBusId(session.userId);
  return { students, busId };
}

/** Map student_id → bus ids via route assignments (for roster bus filter). */
export async function getStudentBusIdsByRoute(): Promise<
  Record<string, string[]>
> {
  const supabase = await createClient();
  const [{ data: buses }, { data: assignments }] = await Promise.all([
    supabase.from("buses").select("id, route_id").eq("active", true),
    supabase.from("student_stop_assignments").select("student_id, route_id"),
  ]);

  const busesByRoute = new Map<string, string[]>();
  for (const bus of buses ?? []) {
    if (!bus.route_id) continue;
    const list = busesByRoute.get(bus.route_id) ?? [];
    list.push(bus.id);
    busesByRoute.set(bus.route_id, list);
  }

  const map: Record<string, string[]> = {};
  for (const row of assignments ?? []) {
    const busIds = busesByRoute.get(row.route_id as string);
    if (!busIds?.length) continue;
    const sid = row.student_id as string;
    const existing = map[sid] ?? [];
    for (const id of busIds) {
      if (!existing.includes(id)) existing.push(id);
    }
    map[sid] = existing;
  }
  return map;
}

// Creates the student's primary parent record if none exists yet, or
// updates the existing one in place. Deliberately update-in-place rather
// than always inserting a new parent + relinking, so a parent's id (and
// anything else referencing it) stays stable across edits.
export async function upsertParentContact(input: {
  studentId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
}): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();

  const { data: existingLink } = await supabase
    .from("student_parents")
    .select("parent_id, is_primary")
    .eq("student_id", input.studentId)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingLink?.parent_id) {
    const { error } = await supabase
      .from("parents")
      .update({
        full_name: input.fullName,
        phone: input.phone,
        email: input.email,
      })
      .eq("id", existingLink.parent_id);
    if (error) return { error: error.message };
    return { ok: true };
  }

  const { data: newParent, error: insertError } = await supabase
    .from("parents")
    .insert({
      full_name: input.fullName,
      phone: input.phone,
      email: input.email,
    })
    .select("id")
    .single();
  if (insertError || !newParent) {
    return { error: insertError?.message ?? "Failed to create parent record" };
  }

  const { error: linkError } = await supabase.from("student_parents").insert({
    student_id: input.studentId,
    parent_id: newParent.id,
    is_primary: true,
  });
  if (linkError) return { error: linkError.message };

  return { ok: true };
}

// registered_capacity is pending schema_v1.sql's "add column if not exists
// registered_capacity" migration (confirmed not yet applied live, 2026-08-19:
// a direct query for buses.registered_capacity returns "column
// buses.registered_capacity does not exist"). Every read and write below
// tries the full column list first and falls back to the no-registered-
// capacity list on that specific error, so the field self-activates the
// moment the migration runs -- no follow-up code change needed.
const BUS_COLUMNS =
  "id, school_id, label, plate_number, capacity, registered_capacity, driver_name, attendant_name, owner_name, active, route_id, driver_id, insurance_expiry";
const BUS_COLUMNS_NO_REGISTERED_CAPACITY =
  "id, school_id, label, plate_number, capacity, driver_name, attendant_name, owner_name, active, route_id, driver_id, insurance_expiry";

function isMissingRegisteredCapacityError(
  error: { message: string } | null | undefined,
): boolean {
  return !!error && /registered_capacity/i.test(error.message);
}

export async function getBuses(schoolSlug?: SchoolScope): Promise<Bus[]> {
  const supabase = await createClient();
  const schoolIds = await getSchoolIds(schoolSlug);
  if (schoolIds.length === 0) return [];

  const { data, error } = await supabase
    .from("buses")
    .select(BUS_COLUMNS)
    .in("school_id", schoolIds)
    .eq("active", true)
    .order("label");

  if (!error && data) {
    return sortByAlpha(data as Bus[], (b) => b.label);
  }
  if (!isMissingRegisteredCapacityError(error)) return [];

  // registered_capacity column doesn't exist live yet -- drop it from the
  // select and retry.
  const retry = await supabase
    .from("buses")
    .select(BUS_COLUMNS_NO_REGISTERED_CAPACITY)
    .in("school_id", schoolIds)
    .eq("active", true)
    .order("label");

  if (retry.error || !retry.data) return [];
  return sortByAlpha(
    retry.data.map((r) => ({ ...r, registered_capacity: null })) as Bus[],
    (b) => b.label,
  );
}

export async function createBus(input: {
  schoolId: string;
  label: string;
  plateNumber: string;
  capacity?: number;
  registeredCapacity?: number | null;
  driverId?: string | null;
  driverName?: string | null;
  attendantName?: string | null;
  ownerName?: string | null;
  insuranceExpiry?: string | null;
  routeId?: string | null;
}): Promise<{ bus: Bus } | { error: string }> {
  const supabase = await createClient();

  // driver_name is a denormalized display copy of the linked driver's name
  // (read by the bus detail page and the matron app) -- keep it synced with
  // driver_id at creation time too, same as updateBus does on reassignment.
  let driverName = input.driverName ?? null;
  if (input.driverId) {
    const driver = await getDriverById(input.driverId);
    driverName = driver?.name ?? null;
  }

  const row = {
    school_id: input.schoolId,
    label: input.label.trim(),
    plate_number: input.plateNumber.trim(),
    capacity: input.capacity ?? 40,
    registered_capacity: input.registeredCapacity ?? null,
    driver_id: input.driverId ?? null,
    driver_name: driverName,
    attendant_name: input.attendantName ?? null,
    owner_name: input.ownerName ?? null,
    insurance_expiry: input.insuranceExpiry ?? null,
    route_id: input.routeId ?? null,
    active: true,
  };

  const { data, error } = await supabase
    .from("buses")
    .insert(row)
    .select(BUS_COLUMNS)
    .single();

  if (!error && data) {
    return { bus: data as Bus };
  }
  if (error?.code === "23514") {
    return { error: "Capacity must be greater than 0" };
  }
  if (!isMissingRegisteredCapacityError(error)) {
    return { error: error?.message ?? "Failed to create bus" };
  }

  // registered_capacity column doesn't exist live yet -- the bus still gets
  // created, just without that field, until the migration runs.
  const { registered_capacity: _droppedRegisteredCapacity, ...rowWithoutRegisteredCapacity } = row;
  const retry = await supabase
    .from("buses")
    .insert(rowWithoutRegisteredCapacity)
    .select(BUS_COLUMNS_NO_REGISTERED_CAPACITY)
    .single();

  if (retry.error || !retry.data) {
    if (retry.error?.code === "23514") {
      return { error: "Capacity must be greater than 0" };
    }
    return { error: retry.error?.message ?? "Failed to create bus" };
  }
  return { bus: { ...retry.data, registered_capacity: null } as Bus };
}

export async function updateBus(
  busId: string,
  input: {
    schoolId?: string;
    label?: string;
    plateNumber?: string;
    capacity?: number;
    registeredCapacity?: number | null;
    driverId?: string | null;
    driverName?: string | null;
    attendantName?: string | null;
    ownerName?: string | null;
    insuranceExpiry?: string | null;
    routeId?: string | null;
  },
): Promise<{ bus: Bus } | { error: string }> {
  const supabase = await createClient();

  const update: Record<string, unknown> = {};
  if (input.schoolId !== undefined) update.school_id = input.schoolId;
  if (input.label !== undefined) update.label = input.label.trim();
  if (input.plateNumber !== undefined) update.plate_number = input.plateNumber.trim();
  if (input.capacity !== undefined) update.capacity = input.capacity;
  if (input.registeredCapacity !== undefined) update.registered_capacity = input.registeredCapacity;
  if (input.attendantName !== undefined) update.attendant_name = input.attendantName;
  if (input.ownerName !== undefined) update.owner_name = input.ownerName;
  if (input.insuranceExpiry !== undefined) update.insurance_expiry = input.insuranceExpiry;
  if (input.routeId !== undefined) update.route_id = input.routeId;

  // driver_name is a denormalized display copy of the linked driver's name
  // (read by the bus detail page and the matron app) -- keep it synced
  // whenever the driver assignment changes, rather than requiring those
  // read sites to join through drivers.
  if (input.driverId !== undefined) {
    update.driver_id = input.driverId;
    if (input.driverId === null) {
      update.driver_name = null;
    } else {
      const driver = await getDriverById(input.driverId);
      update.driver_name = driver?.name ?? null;
    }
  } else if (input.driverName !== undefined) {
    update.driver_name = input.driverName;
  }

  const { data, error } = await supabase
    .from("buses")
    .update(update)
    .eq("id", busId)
    .select(BUS_COLUMNS)
    .single();

  if (!error && data) {
    return { bus: data as Bus };
  }
  if (error?.code === "23514") {
    return { error: "Capacity must be greater than 0" };
  }
  if (!isMissingRegisteredCapacityError(error) || !("registered_capacity" in update)) {
    return { error: error?.message ?? "Failed to update bus" };
  }

  // registered_capacity column doesn't exist live yet -- retry without
  // touching it.
  const { registered_capacity: _droppedRegisteredCapacity, ...updateWithoutRegisteredCapacity } =
    update;
  const retry = await supabase
    .from("buses")
    .update(updateWithoutRegisteredCapacity)
    .eq("id", busId)
    .select(BUS_COLUMNS_NO_REGISTERED_CAPACITY)
    .single();

  if (retry.error || !retry.data) {
    if (retry.error?.code === "23514") {
      return { error: "Capacity must be greater than 0" };
    }
    return { error: retry.error?.message ?? "Failed to update bus" };
  }
  return { bus: { ...retry.data, registered_capacity: null } as Bus };
}

/** Hard-delete a bus (cascades trips / boarding / maintenance). */
export async function deleteBus(
  busId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("buses").delete().eq("id", busId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Bus not found or not permitted" };
  return { ok: true };
}

export async function getBusById(busId: string): Promise<Bus | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("buses")
    .select(
      "id, school_id, label, plate_number, capacity, driver_name, attendant_name, owner_name, active, route_id, driver_id, insurance_expiry",
    )
    .eq("id", busId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Bus;
}

export async function getTrips(
  tripDate?: string,
  schoolSlug?: SchoolScope,
): Promise<TripWithBus[]> {
  const supabase = await createClient();
  const date = tripDate ?? getSchoolToday();
  const schoolIds = await getSchoolIds(schoolSlug);
  if (schoolIds.length === 0) return [];

  const { data: buses } = await supabase
    .from("buses")
    .select("id")
    .in("school_id", schoolIds);

  const busIds = buses?.map((b) => b.id) ?? [];
  if (busIds.length === 0) return [];

  const { data, error } = await supabase
    .from("trips")
    .select(
      `
      id,
      bus_id,
      trip_date,
      direction,
      status,
      matron_id,
      started_at,
      ended_at,
      departed_school_at,
      buses ( label, plate_number )
    `,
    )
    .eq("trip_date", date)
    .in("bus_id", busIds)
    .order("direction");

  if (error || !data) return [];

  const tripMeta = data.map((row) => ({
    id: row.id as string,
    direction: row.direction as TripDirection,
    busId: row.bus_id as string,
  }));
  const [aboardCounts, scanSummaries] = await Promise.all([
    getAboardCounts(tripMeta),
    getScanSummariesForTrips(tripMeta),
  ]);

  const mapped = data.map((row) => {
    const bus = first(
      row.buses as
        | { label: string; plate_number: string }
        | { label: string; plate_number: string }[]
        | null,
    );
    const scan = scanSummaries[row.id as string];
    return {
      id: row.id,
      bus_id: row.bus_id,
      trip_date: row.trip_date,
      direction: row.direction as TripWithBus["direction"],
      status: row.status as TripWithBus["status"],
      matron_id: row.matron_id,
      started_at: row.started_at,
      ended_at: row.ended_at,
      departed_school_at: row.departed_school_at ?? null,
      bus_label: bus?.label ?? "",
      bus_plate: bus?.plate_number ?? "",
      aboard_count: aboardCounts[row.id] ?? 0,
      students_scanned: scan?.students_scanned ?? 0,
      roster_on_bus: scan?.roster_on_bus ?? 0,
    };
  });
  return sortTripsTodayByBus(mapped);
}

/**
 * Admin trip-history report -- unlike getTrips() above (always exactly one
 * day, the app's own "today" semantics for matron/driver/live views), this
 * takes a real date range and optional status/bus filters. There was no
 * way to see a past trip anywhere in the admin UI before this -- every
 * trip-related view defaulted to today and had no nav entry for history.
 */
export async function listTripsForReport(input?: {
  from?: string;
  to?: string;
  busId?: string;
  status?: TripWithBus["status"];
}): Promise<TripWithBus[]> {
  const supabase = await createClient();

  let q = supabase
    .from("trips")
    .select(TRIP_WITH_BUS_SELECT)
    .order("trip_date", { ascending: false })
    .order("started_at", { ascending: false });

  if (input?.from) q = q.gte("trip_date", input.from);
  if (input?.to) q = q.lte("trip_date", input.to);
  if (input?.busId) q = q.eq("bus_id", input.busId);
  if (input?.status) q = q.eq("status", input.status);

  const { data, error } = await q;
  if (error || !data) return [];

  const tripMeta = data.map((row) => ({
    id: row.id as string,
    direction: row.direction as TripDirection,
    busId: row.bus_id as string,
  }));
  const [aboardCounts, scanSummaries] = await Promise.all([
    getAboardCounts(tripMeta),
    getScanSummariesForTrips(tripMeta),
  ]);

  const mapped = data.map((row) => {
    const base = mapTripWithBusRow(row as Record<string, unknown>);
    const scan = scanSummaries[base.id];
    return {
      ...base,
      aboard_count: aboardCounts[base.id] ?? 0,
      students_scanned: scan?.students_scanned ?? 0,
      roster_on_bus: scan?.roster_on_bus ?? 0,
    };
  });
  return sortTripsHistoryByDateBus(mapped);
}

const TRIP_WITH_BUS_SELECT = `
  id,
  bus_id,
  trip_date,
  direction,
  status,
  matron_id,
  started_at,
  ended_at,
  departed_school_at,
  buses ( label, plate_number )
`;

function mapTripWithBusRow(data: Record<string, unknown>): TripWithBus {
  const bus = first(
    data.buses as
      | { label: string; plate_number: string }
      | { label: string; plate_number: string }[]
      | null,
  );
  return {
    id: data.id as string,
    bus_id: data.bus_id as string,
    trip_date: data.trip_date as string,
    direction: data.direction as TripWithBus["direction"],
    status: data.status as TripWithBus["status"],
    matron_id: data.matron_id as string | null,
    started_at: data.started_at as string | null,
    ended_at: data.ended_at as string | null,
    departed_school_at: (data.departed_school_at as string | null) ?? null,
    bus_label: bus?.label ?? "",
    bus_plate: bus?.plate_number ?? "",
    aboard_count: 0,
    students_scanned: 0,
    roster_on_bus: 0,
  };
}

export async function createTrip(input: {
  busId: string;
  direction: TripDirection;
  tripDate?: string;
  matronId?: string;
}): Promise<
  | { trip: TripWithBus; resumedExisting?: boolean }
  | { error: string; code?: "open_trip_stale"; staleTripId?: string }
> {
  const supabase = await createClient();
  const tripDate = input.tripDate ?? getSchoolToday();

  // A bus can only run one trip at a time. Previously nothing checked this
  // at all -- only a (bus_id, trip_date, direction) uniqueness constraint,
  // which a *different* direction or a stale trip from an earlier day
  // sails straight past (the actual cause of "matron leaves the app, a
  // second trip gets created"). Look for any trip on this bus that was
  // never finished, regardless of direction/date, before creating a new one.
  const { data: openTrips } = await supabase
    .from("trips")
    .select(TRIP_WITH_BUS_SELECT)
    .eq("bus_id", input.busId)
    .in("status", ["scheduled", "active"])
    .order("trip_date", { ascending: false });

  const todaysTrips =
    openTrips?.filter((t) => t.trip_date === tripDate) ?? [];
  const activeToday = todaysTrips.find((t) => t.status === "active");

  // Same-day continuity (app reload, wrong button tapped, dropped
  // connection) -- resume whatever's already open today rather than
  // blocking. The client shows a hint when the resumed direction differs
  // from what was tapped (see MatronHome.tsx).
  if (activeToday) {
    return {
      trip: mapTripWithBusRow(activeToday as Record<string, unknown>),
      resumedExisting: true,
    };
  }

  const matchingToday = todaysTrips.find((t) => t.direction === input.direction);
  if (matchingToday) {
    const now = new Date().toISOString();
    const { data: activated, error: actErr } = await supabase
      .from("trips")
      .update({
        status: "active",
        started_at: matchingToday.started_at ?? now,
        matron_id: input.matronId ?? matchingToday.matron_id ?? null,
      })
      .eq("id", matchingToday.id)
      .select(TRIP_WITH_BUS_SELECT)
      .single();
    if (actErr || !activated) {
      return { error: actErr?.message ?? "Could not start trip" };
    }
    return {
      trip: mapTripWithBusRow(activated as Record<string, unknown>),
      resumedExisting: true,
    };
  }

  const stale = openTrips?.find((t) => t.trip_date !== tripDate);
  if (stale) {
    const staleWhen = stale.started_at
      ? new Date(stale.started_at as string).toLocaleString()
      : "not started";
    return {
      error: `This bus has an unfinished ${(stale.direction as string).toUpperCase()} trip from ${stale.trip_date} (${staleWhen}) that was never closed.`,
      code: "open_trip_stale",
      staleTripId: stale.id as string,
    };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("trips")
    .insert({
      bus_id: input.busId,
      direction: input.direction,
      trip_date: tripDate,
      matron_id: input.matronId ?? null,
      status: "active",
      started_at: now,
    })
    .select(TRIP_WITH_BUS_SELECT)
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return {
        error: `A ${input.direction.toUpperCase()} trip already exists for this bus today.`,
      };
    }
    return { error: error?.message ?? "Failed to create trip" };
  }

  // Best-effort, isolated from everything above -- snapshot which driver is
  // currently assigned to this bus onto the new trip, so it survives a
  // later reassignment. Deliberately a separate update after the insert
  // (not part of it) and swallows its own errors so a pending/missing
  // driver_id column on trips can never affect trip creation itself.
  try {
    const { data: bus } = await supabase
      .from("buses")
      .select("driver_id")
      .eq("id", input.busId)
      .maybeSingle();
    if (bus?.driver_id) {
      await supabase
        .from("trips")
        .update({ driver_id: bus.driver_id })
        .eq("id", data.id);
    }
  } catch {
    // trips.driver_id column not live yet, or some other non-critical
    // failure -- the trip itself already created successfully above.
  }

  return { trip: mapTripWithBusRow(data as Record<string, unknown>) };
}

/** Name of whoever was actually driving this trip, if captured (see
 * trips.driver_id -- pending, not yet live). Fully isolated select so a
 * missing column here can't affect anything else that reads a trip. Falls
 * back to null gracefully either way: column missing, column exists but
 * this trip predates it, or no driver was assigned. */
export async function getTripDriverName(tripId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trips")
    .select("driver_id")
    .eq("id", tripId)
    .maybeSingle();
  if (error || !data?.driver_id) return null;

  const driver = await getDriverById(data.driver_id as string);
  return driver?.name ?? null;
}

/**
 * Lets a matron self-unblock from a stale (prior-day) open trip instead of
 * needing an admin: closes it as completed and logs a low-severity incident
 * on it so it's flagged for review, not silently erased. No-ops if it's
 * already closed by the time this runs (e.g. a second tap).
 */
export async function forceCloseStaleTrip(input: {
  tripId: string;
  closedBy?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data: trip, error } = await supabase
    .from("trips")
    .select("id, status")
    .eq("id", input.tripId)
    .maybeSingle();

  if (error || !trip) {
    return { ok: false, error: "Trip not found" };
  }
  if (trip.status !== "scheduled" && trip.status !== "active") {
    return { ok: true };
  }

  const { error: updateError } = await supabase
    .from("trips")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .eq("id", input.tripId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  await createIncident({
    tripId: input.tripId,
    type: "other",
    severity: "low",
    notes:
      "Auto-closed: matron started a new trip on this bus before this one was ended. Please review -- may have been left open by mistake.",
    reportedBy: input.closedBy ?? null,
  });

  return { ok: true };
}

export type RecordBoardingError = {
  error: string;
  code: "not_found" | "duplicate" | "invalid" | "conflict" | "forbidden";
};

/** Nearest-stop match radius for boarding GPS (meters). */
const STOP_PROXIMITY_RADIUS_M = 300;

export async function recordBoarding(input: {
  tripId: string;
  studentId: string;
  eventType?: BoardingEventType;
  lat?: number | null;
  lng?: number | null;
  scannedBy?: string | null;
  /** Client-captured scan time (offline queue). Invalid values ignored. */
  scannedAt?: string | null;
}): Promise<{ result: BoardingResult } | RecordBoardingError> {
  const supabase = await createClient();

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, status, bus_id, direction")
    .eq("id", input.tripId)
    .maybeSingle();

  if (tripError || !trip) {
    return { error: "Trip not found", code: "not_found" };
  }

  if (trip.status === "cancelled" || trip.status === "completed") {
    return {
      error: `Trip is ${trip.status}; cannot record boarding`,
      code: "invalid",
    };
  }

  const student = await getStudentById(input.studentId);
  if (!student) {
    return { error: "Student not found", code: "not_found" };
  }

  // Real field ops don't always match the live-sheet: cross-campus pickups,
  // a student temporarily reassigned to whatever bus is actually available,
  // a master sheet that hasn't caught up yet. Blocking the scan outright
  // here just means the child goes unrecorded -- worse than a scan on the
  // "wrong" bus. So this no longer blocks; it just flags it (below, after
  // the scan succeeds) so admins can see it happened, not hide it.
  const onBus = await isStudentOnBus(input.studentId, trip.bus_id);

  let { data: priorEvents, error: priorError } = await supabase
    .from("boarding_events")
    .select("id, event_type, scanned_at")
    .eq("trip_id", input.tripId)
    .eq("student_id", input.studentId)
    .is("voided_at", null)
    .order("scanned_at", { ascending: false });

  // Older DBs without voided_at column -- retry without the filter.
  if (priorError && /voided_at/i.test(priorError.message)) {
    const retry = await supabase
      .from("boarding_events")
      .select("id, event_type, scanned_at")
      .eq("trip_id", input.tripId)
      .eq("student_id", input.studentId)
      .order("scanned_at", { ascending: false });
    priorEvents = retry.data;
    priorError = retry.error;
  }

  if (priorError) {
    return { error: priorError.message, code: "conflict" };
  }

  const events = priorEvents ?? [];

  // One scan per child per trip. A second decode (camera still live, or a
  // queued retry) must not write another boarding_events row.
  if (events.length > 0) {
    return {
      error: "Duplicate scan: student already scanned this trip",
      code: "duplicate",
    };
  }

  // PM trips start with drop-off as the natural first scan -- matrons scan
  // once per child on the return leg. AM trips start with pickup.
  const firstEventType: BoardingEventType =
    trip.direction === "pm" ? "out" : "in";
  const eventType: BoardingEventType = input.eventType ?? firstEventType;

  // Nearest route stop from scan GPS (for accurate per-stop boarding lists).
  let nearestStop: { id: string; name: string; distance_m: number } | null =
    null;
  if (
    typeof input.lat === "number" &&
    typeof input.lng === "number" &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng)
  ) {
    const { stops } = await getStopsForTrip(input.tripId);
    let best: { id: string; name: string; distance_m: number } | null = null;
    for (const rs of stops) {
      const s = rs.stop;
      if (s.lat == null || s.lng == null) continue;
      const distance_m =
        haversineKm(
          { lat: input.lat, lng: input.lng },
          { lat: s.lat, lng: s.lng },
        ) * 1000;
      if (distance_m > STOP_PROXIMITY_RADIUS_M) continue;
      if (!best || distance_m < best.distance_m) {
        best = { id: s.id, name: s.name, distance_m };
      }
    }
    nearestStop = best;
  }

  const insertRow: Record<string, unknown> = {
    trip_id: input.tripId,
    student_id: input.studentId,
    event_type: eventType,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    scanned_by: input.scannedBy ?? null,
  };
  if (input.scannedAt) {
    const parsed = new Date(input.scannedAt);
    if (!Number.isNaN(parsed.getTime())) {
      insertRow.scanned_at = parsed.toISOString();
    }
  }
  if (nearestStop) insertRow.stop_id = nearestStop.id;

  let { data: inserted, error: insertError } = await supabase
    .from("boarding_events")
    .insert(insertRow)
    .select(
      "id, trip_id, student_id, event_type, scanned_at, lat, lng, scanned_by, stop_id",
    )
    .single();

  // Older DBs without stop_id column — retry without it.
  if (
    insertError &&
    /stop_id|schema cache|column/i.test(insertError.message)
  ) {
    delete insertRow.stop_id;
    const retry = await supabase
      .from("boarding_events")
      .insert(insertRow)
      .select(
        "id, trip_id, student_id, event_type, scanned_at, lat, lng, scanned_by",
      )
      .single();
    inserted = retry.data
      ? { ...retry.data, stop_id: nearestStop?.id ?? null }
      : null;
    insertError = retry.error;
  }

  if (insertError || !inserted) {
    const msg = insertError?.message ?? "Failed to record boarding";
    if (
      insertError?.code === "23505" ||
      /duplicate|unique/i.test(msg)
    ) {
      return { error: "Duplicate scan for this trip", code: "duplicate" };
    }
    return { error: msg, code: "conflict" };
  }

  // Mark trip active on first boarding if still scheduled
  if (trip.status === "scheduled") {
    const tripUpdate: {
      status: "active";
      started_at: string;
      matron_id?: string;
    } = {
      status: "active",
      started_at: new Date().toISOString(),
    };
    if (input.scannedBy) tripUpdate.matron_id = input.scannedBy;

    await supabase
      .from("trips")
      .update(tripUpdate)
      .eq("id", input.tripId)
      .eq("status", "scheduled");
  }

  // Flag (not block) an off-route scan -- logged once per student per trip,
  // low severity, purely informational for admins reviewing the day. See
  // the comment above the onBus check for why this no longer blocks.
  if (!onBus) {
    const bus = await getBusById(trip.bus_id);
    const incidentOutcome = await createIncident({
      tripId: input.tripId,
      type: "other",
      severity: "low",
      notes: `${student.first_name} ${student.last_name} scanned on ${bus?.label ?? "this bus"}, but isn't assigned to its route.`,
      reportedBy: input.scannedBy ?? null,
    });
    if (!("incident" in incidentOutcome)) {
      console.error("[off-route scan] failed to log incident:", incidentOutcome.error);
    }
  }

  const aboard_count = await countAboard(input.tripId);

  // Overload: system-flagged the moment a boarding-in scan pushes the bus
  // past its seat capacity. Only once per trip -- every scan after the bus
  // is already flagged would otherwise re-alert (and re-SMS admins) again.
  // Scoped to "in" events by design, not just direction: under the current
  // one-scan-per-trip model only AM trips ever produce an "in" event (PM's
  // countAboard counts *down* from the full roster, so checking it here
  // would misfire on trip start rather than on an actual boarding event).
  if (eventType === "in") {
    const bus = await getBusById(trip.bus_id);
    if (bus?.capacity && aboard_count > bus.capacity) {
      const { data: existingOverload } = await supabase
        .from("incidents")
        .select("id")
        .eq("trip_id", input.tripId)
        .eq("type", "overload")
        .limit(1)
        .maybeSingle();
      if (!existingOverload) {
        const incidentOutcome = await createIncident({
          tripId: input.tripId,
          type: "overload",
          severity: "high",
          notes: `Bus over capacity: ${aboard_count} aboard, capacity ${bus.capacity}.`,
          reportedBy: input.scannedBy ?? null,
        });
        if ("incident" in incidentOutcome) {
          await notifyIncidentAlert({
            incidentId: incidentOutcome.incident.id,
            tripId: input.tripId,
            type: "overload",
            severity: "high",
            notes: incidentOutcome.incident.notes,
          });
        } else {
          // Most likely incidents_type_check not yet widened for "overload"
          // (schema pending) -- don't fail the scan over it, but this must
          // not disappear silently.
          console.error("[overload] failed to log incident:", incidentOutcome.error);
        }
      }
    }
  }

  const event: BoardingEvent = {
    id: inserted.id,
    trip_id: inserted.trip_id,
    student_id: inserted.student_id,
    event_type: inserted.event_type as BoardingEventType,
    scanned_at: inserted.scanned_at,
    lat: inserted.lat,
    lng: inserted.lng,
    scanned_by: inserted.scanned_by,
    stop_id: (inserted as { stop_id?: string | null }).stop_id ?? nearestStop?.id ?? null,
  };

  return {
    result: {
      event,
      student,
      direction: trip.direction as TripDirection,
      stop: nearestStop,
      fee: {
        balance: student.fee_balance,
        currency: student.fee_currency,
        synced_at: student.fee_synced_at,
      },
      aboard_count,
    },
  };
}

export async function countAboard(tripId: string): Promise<number> {
  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("bus_id, direction")
    .eq("id", tripId)
    .maybeSingle();

  let { data, error } = await supabase
    .from("boarding_events")
    .select("student_id, event_type")
    .eq("trip_id", tripId)
    .is("voided_at", null);

  // Older DBs without voided_at column -- retry without the filter.
  if (error && /voided_at/i.test(error.message)) {
    const retry = await supabase
      .from("boarding_events")
      .select("student_id, event_type")
      .eq("trip_id", tripId);
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) return 0;

  if (trip?.direction === "pm") {
    // PM has no "in" scan on the return leg (matrons scan once, at
    // drop-off) -- aboard starts at everyone assigned to this bus and
    // counts down as each student is scanned "out", rather than counting
    // up from zero the way the AM in/out toggle does below.
    const droppedOff = new Set(
      data
        .filter((r) => r.event_type === "out")
        .map((r) => r.student_id as string),
    );
    const assigned = await getStudentsForBus(trip.bus_id);
    return Math.max(0, assigned.length - droppedOff.size);
  }

  let aboard = 0;
  for (const row of data) {
    if (row.event_type === "in") aboard += 1;
    else if (row.event_type === "out") aboard -= 1;
  }
  return Math.max(0, aboard);
}

export type VoidBoardingError = {
  error: string;
  code: "not_found" | "invalid";
};

/**
 * Soft-voids a mis-scan (wrong student, scanned by accident) -- stops it
 * counting as a real boarding event but keeps the row on record for audit.
 * Restricted to trips that are still open: once a trip is completed its
 * scan history is closed history, not something to edit from the field.
 */
export async function voidBoardingEvent(input: {
  eventId: string;
  voidedBy?: string | null;
}): Promise<{ ok: true } | VoidBoardingError> {
  const supabase = await createClient();

  // Selecting voided_at here would itself fail on a pending-migration DB,
  // so this select stays column-agnostic -- the update below is where a
  // missing column actually surfaces, with a clear message instead of this
  // function mistaking that failure for "no such scan".
  const { data: event, error: eventError } = await supabase
    .from("boarding_events")
    .select("id, trip_id")
    .eq("id", input.eventId)
    .maybeSingle();

  if (eventError || !event) {
    return { error: "Scan not found", code: "not_found" };
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("status")
    .eq("id", event.trip_id)
    .maybeSingle();
  if (trip?.status === "completed" || trip?.status === "cancelled") {
    return {
      error: "This trip is already closed -- ask an admin to correct the record.",
      code: "invalid",
    };
  }

  const { error: updateError } = await supabase
    .from("boarding_events")
    .update({
      voided_at: new Date().toISOString(),
      voided_by: input.voidedBy ?? null,
    })
    .eq("id", input.eventId);

  if (updateError) {
    if (/voided_at|schema cache|column/i.test(updateError.message)) {
      return {
        error:
          "Undo isn't set up on this server yet -- ask an admin to run the pending database update.",
        code: "invalid",
      };
    }
    return { error: updateError.message, code: "invalid" };
  }
  return { ok: true };
}

export type TripScanStats = {
  uniqueStudentsScanned: number;
  totalScanEvents: number;
  rosterOnBus: number;
  aboardNow: number;
};

export async function getTripScanStats(
  tripId: string,
): Promise<TripScanStats | null> {
  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("bus_id")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip?.bus_id) return null;

  const { data: events, error } = await supabase
    .from("boarding_events")
    .select("student_id")
    .eq("trip_id", tripId);
  if (error) return null;

  const rows = events ?? [];
  const uniqueStudentsScanned = new Set(
    rows.map((r) => r.student_id as string),
  ).size;
  const roster = await getStudentsForBus(trip.bus_id);
  const aboardNow = await countAboard(tripId);

  return {
    uniqueStudentsScanned,
    totalScanEvents: rows.length,
    rosterOnBus: roster.length,
    aboardNow,
  };
}

export type TripBoardingEventRow = {
  id: string;
  student_id: string;
  student_name: string;
  class_name: string | null;
  event_type: BoardingEventType;
  scanned_at: string;
  lat: number | null;
  lng: number | null;
  /** Nearest live-sheet stop to where this scan happened, if one's within
   * STOP_PROXIMITY_RADIUS_M -- null if no location resolved, or nothing's
   * close enough to name. */
  stop_name: string | null;
  /** Whether lat/lng came from the scan's own one-shot GPS capture, or was
   * inferred from the nearest-in-time bus GPS ping -- the matron's own
   * capture succeeds rarely in practice, so most rows end up "trail". */
  location_source: "scan" | "trail" | null;
};

/** Nearest trip_locations ping in time to a given instant -- used to infer
 * where a scan happened when the scan itself carries no GPS (the common
 * case: the matron's one-shot capture at scan time succeeds rarely, but
 * the bus's own GPS trail pings every 15-30s throughout the trip). */
function nearestTrailPoint(
  trail: TripLocation[],
  atIso: string,
): { lat: number; lng: number } | null {
  if (trail.length === 0) return null;
  const at = new Date(atIso).getTime();
  let best: TripLocation | null = null;
  let bestDiff = Infinity;
  for (const point of trail) {
    const diff = Math.abs(new Date(point.recorded_at).getTime() - at);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = point;
    }
  }
  return best ? { lat: best.lat, lng: best.lng } : null;
}

export async function listBoardingEventsForTrip(
  tripId: string,
): Promise<TripBoardingEventRow[]> {
  const supabase = await createClient();
  const [{ data, error }, trail, { stops }] = await Promise.all([
    supabase
      .from("boarding_events")
      .select(
        "id, student_id, event_type, scanned_at, lat, lng, students ( first_name, last_name, class_name )",
      )
      .eq("trip_id", tripId)
      .order("scanned_at", { ascending: true }),
    getTripLocationTrail(tripId),
    getStopsForTrip(tripId),
  ]);

  if (error || !data) return [];

  return data
    .map((row) => {
      const student = first(
        row.students as
          | { first_name: string; last_name: string; class_name: string | null }
          | { first_name: string; last_name: string; class_name: string | null }[]
          | null,
      );
      if (!student) return null;

      const scanned_at = row.scanned_at as string;
      let lat = row.lat as number | null;
      let lng = row.lng as number | null;
      let location_source: "scan" | "trail" | null =
        lat != null && lng != null ? "scan" : null;

      if (lat == null || lng == null) {
        const inferred = nearestTrailPoint(trail, scanned_at);
        if (inferred) {
          lat = inferred.lat;
          lng = inferred.lng;
          location_source = "trail";
        }
      }

      let stop_name: string | null = null;
      if (lat != null && lng != null) {
        let best: { name: string; distance_m: number } | null = null;
        for (const rs of stops) {
          const s = rs.stop;
          if (s.lat == null || s.lng == null) continue;
          const distance_m = haversineKm({ lat, lng }, { lat: s.lat, lng: s.lng }) * 1000;
          if (distance_m > STOP_PROXIMITY_RADIUS_M) continue;
          if (!best || distance_m < best.distance_m) {
            best = { name: s.name, distance_m };
          }
        }
        stop_name = best?.name ?? null;
      }

      return {
        id: row.id as string,
        student_id: row.student_id as string,
        student_name: `${student.first_name} ${student.last_name}`,
        class_name: student.class_name,
        event_type: row.event_type as BoardingEventType,
        scanned_at,
        lat,
        lng,
        stop_name,
        location_source,
      };
    })
    .filter((r): r is TripBoardingEventRow => r !== null);
}

async function getScanSummariesForTrips(
  trips: { id: string; busId: string }[],
): Promise<
  Record<string, { students_scanned: number; roster_on_bus: number }>
> {
  if (trips.length === 0) return {};

  const supabase = await createClient();
  const tripIds = trips.map((t) => t.id);
  const { data, error } = await supabase
    .from("boarding_events")
    .select("trip_id, student_id")
    .in("trip_id", tripIds);

  const uniqueByTrip = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const tid = row.trip_id as string;
    if (!uniqueByTrip.has(tid)) uniqueByTrip.set(tid, new Set());
    uniqueByTrip.get(tid)!.add(row.student_id as string);
  }

  const rosterByBus = new Map<string, number>();
  for (const busId of [...new Set(trips.map((t) => t.busId))]) {
    rosterByBus.set(busId, (await getStudentsForBus(busId)).length);
  }

  const out: Record<string, { students_scanned: number; roster_on_bus: number }> =
    {};
  for (const trip of trips) {
    out[trip.id] = {
      students_scanned: uniqueByTrip.get(trip.id)?.size ?? 0,
      roster_on_bus: rosterByBus.get(trip.busId) ?? 0,
    };
  }
  return out;
}

export async function getAboardCounts(
  trips: { id: string; direction: TripDirection; busId: string }[],
): Promise<Record<string, number>> {
  if (trips.length === 0) return {};

  const supabase = await createClient();
  const tripIds = trips.map((t) => t.id);
  const { data, error } = await supabase
    .from("boarding_events")
    .select("trip_id, student_id, event_type")
    .in("trip_id", tripIds);

  if (error || !data) return {};

  const counts: Record<string, number> = {};

  for (const trip of trips) {
    if (trip.direction === "pm") continue;
    let aboard = 0;
    for (const row of data) {
      if (row.trip_id !== trip.id) continue;
      if (row.event_type === "in") aboard += 1;
      else if (row.event_type === "out") aboard -= 1;
    }
    counts[trip.id] = Math.max(0, aboard);
  }

  // PM: same "assigned minus already dropped off" logic as countAboard's PM
  // branch above -- kept separate since it needs one getStudentsForBus
  // lookup per bus rather than a scan-history tally.
  for (const trip of trips) {
    if (trip.direction !== "pm") continue;
    const droppedOff = new Set(
      data
        .filter((r) => r.trip_id === trip.id && r.event_type === "out")
        .map((r) => r.student_id as string),
    );
    const assigned = await getStudentsForBus(trip.busId);
    counts[trip.id] = Math.max(0, assigned.length - droppedOff.size);
  }

  return counts;
}

/** QR codes already scanned on this trip (for matron resync after reload).
 * Excludes voided scans so a corrected mis-scan can be re-scanned. */
export async function getScannedQrCodesForTrip(tripId: string): Promise<string[]> {
  const supabase = await createClient();
  let { data: events, error } = await supabase
    .from("boarding_events")
    .select("student_id")
    .eq("trip_id", tripId)
    .is("voided_at", null);

  // Older DBs without voided_at column -- retry without the filter.
  if (error && /voided_at/i.test(error.message)) {
    const retry = await supabase
      .from("boarding_events")
      .select("student_id")
      .eq("trip_id", tripId);
    events = retry.data;
    error = retry.error;
  }
  if (error || !events?.length) return [];

  const studentIds = [...new Set(events.map((e) => e.student_id as string))];
  const { data: codes } = await supabase
    .from("qr_codes")
    .select("code")
    .in("student_id", studentIds);
  return (codes ?? [])
    .map((c) => (c.code as string)?.trim())
    .filter(Boolean);
}

export async function getTripRoster(
  tripId: string,
): Promise<{ id: string; name: string; class_name: string | null }[]> {
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("bus_id, direction")
    .eq("id", tripId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("boarding_events")
    .select(
      `
      student_id,
      event_type,
      scanned_at,
      students ( first_name, last_name, class_name )
    `,
    )
    .eq("trip_id", tripId)
    .order("scanned_at", { ascending: true });

  if (error || !data) return [];

  if (trip?.direction === "pm") {
    // "Aboard" on the return leg = assigned to this bus, minus whoever's
    // already been scanned "out" -- mirrors countAboard's PM branch, since
    // there's no "in" scan here to key off of the way the AM logic below does.
    const droppedOff = new Set(
      data
        .filter((r) => r.event_type === "out")
        .map((r) => r.student_id as string),
    );
    const assigned = await getStudentsForBus(trip.bus_id);
    return sortStudentsByName(assigned.filter((s) => !droppedOff.has(s.id))).map(
      (s) => ({
        id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        class_name: s.class_name,
      }),
    );
  }

  const lastEventByStudent = new Map<
    string,
    {
      event_type: BoardingEventType;
      student: { first_name: string; last_name: string; class_name: string | null };
    }
  >();

  for (const row of data) {
    const student = first(
      row.students as
        | { first_name: string; last_name: string; class_name: string | null }
        | { first_name: string; last_name: string; class_name: string | null }[]
        | null,
    );
    if (!student) continue;
    lastEventByStudent.set(row.student_id, {
      event_type: row.event_type as BoardingEventType,
      student,
    });
  }

  const aboard: {
    id: string;
    first_name: string;
    last_name: string;
    class_name: string | null;
  }[] = [];
  for (const [studentId, entry] of lastEventByStudent) {
    if (entry.event_type !== "in") continue;
    aboard.push({
      id: studentId,
      first_name: entry.student.first_name,
      last_name: entry.student.last_name,
      class_name: entry.student.class_name,
    });
  }

  return sortStudentsByName(aboard).map((s) => ({
    id: s.id,
    name: `${s.first_name} ${s.last_name}`,
    class_name: s.class_name,
  }));
}

export type BoardingReportRow = {
  id: string;
  trip_id: string;
  student_id: string;
  student_name: string;
  class_name: string | null;
  school_id: string | null;
  bus_id: string;
  bus_label: string;
  bus_plate: string;
  direction: TripDirection;
  trip_date: string;
  event_type: BoardingEventType;
  scanned_at: string;
  school_gate_at: string | null;
};

/**
 * Historical "which kids boarded which bus on which day" report for admin --
 * everywhere else boarding_events only ever shows up live, for the current
 * trip (getTripRoster, countAboard, etc. above). Filters on trips.trip_date,
 * not boarding_events.scanned_at, since trip_date is the canonical "day" the
 * rest of the app slices by (scanned_at is almost always the same day, but
 * trip_date is the field that actually means "day" here).
 */
export async function listBoardingEventsForReport(input?: {
  from?: string;
  to?: string;
  schoolId?: string;
  busId?: string;
}): Promise<BoardingReportRow[]> {
  const supabase = await createClient();

  let busIds: string[] | null = null;
  if (input?.busId) {
    busIds = [input.busId];
  } else if (input?.schoolId) {
    const { data: schoolBuses } = await supabase
      .from("buses")
      .select("id")
      .eq("school_id", input.schoolId);
    busIds = (schoolBuses ?? []).map((b) => b.id);
    if (busIds.length === 0) return [];
  }

  let tripsQuery = supabase
    .from("trips")
    .select(
      "id, bus_id, trip_date, direction, actual_arrival_at, departed_school_at, buses ( label, plate_number, school_id )",
    );
  if (input?.from) tripsQuery = tripsQuery.gte("trip_date", input.from);
  if (input?.to) tripsQuery = tripsQuery.lte("trip_date", input.to);
  if (busIds) tripsQuery = tripsQuery.in("bus_id", busIds);

  let { data: trips, error: tripsError } = await tripsQuery;
  if (tripsError && /actual_arrival_at/i.test(tripsError.message)) {
    const retry = await supabase
      .from("trips")
      .select(
        "id, bus_id, trip_date, direction, departed_school_at, buses ( label, plate_number, school_id )",
      )
      .gte("trip_date", input?.from ?? "1970-01-01")
      .lte("trip_date", input?.to ?? "2999-12-31");
    trips = (retry.data ?? []).map((t) => ({
      ...t,
      actual_arrival_at: null,
    }));
    tripsError = retry.error;
    if (busIds && trips) {
      trips = trips.filter((t) => busIds!.includes(t.bus_id));
    }
  }
  if (tripsError || !trips || trips.length === 0) return [];

  const tripById = new Map(trips.map((t) => [t.id, t]));

  const { data: events, error: eventsError } = await supabase
    .from("boarding_events")
    .select(
      "id, trip_id, student_id, event_type, scanned_at, students ( first_name, last_name, class_name )",
    )
    .in("trip_id", [...tripById.keys()])
    .order("scanned_at", { ascending: false })
    .limit(5000);
  if (eventsError || !events) return [];

  const rows: BoardingReportRow[] = [];
  for (const row of events) {
    const trip = tripById.get(row.trip_id);
    if (!trip) continue;
    const bus = first(
      trip.buses as
        | { label: string; plate_number: string; school_id: string }
        | { label: string; plate_number: string; school_id: string }[]
        | null,
    );
    const student = first(
      row.students as
        | { first_name: string; last_name: string; class_name: string | null }
        | { first_name: string; last_name: string; class_name: string | null }[]
        | null,
    );
    rows.push({
      id: row.id,
      trip_id: row.trip_id,
      student_id: row.student_id,
      student_name: student ? `${student.first_name} ${student.last_name}` : "Unknown student",
      class_name: student?.class_name ?? null,
      school_id: bus?.school_id ?? null,
      bus_id: trip.bus_id,
      bus_label: bus?.label ?? "",
      bus_plate: bus?.plate_number ?? "",
      direction: trip.direction as TripDirection,
      trip_date: trip.trip_date,
      event_type: row.event_type as BoardingEventType,
      scanned_at: row.scanned_at,
      school_gate_at:
        (trip as { actual_arrival_at?: string | null }).actual_arrival_at ??
        (trip.direction === "pm"
          ? ((trip as { departed_school_at?: string | null })
              .departed_school_at ?? null)
          : null),
    });
  }
  return rows;
}

export async function getTripById(tripId: string): Promise<TripWithBus | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trips")
    .select(
      `
      id,
      bus_id,
      trip_date,
      direction,
      status,
      matron_id,
      started_at,
      ended_at,
      departed_school_at,
      buses ( label, plate_number, route_id, capacity )
    `,
    )
    .eq("id", tripId)
    .maybeSingle();

  if (error || !data) return null;

  const bus = first(
    data.buses as
      | {
          label: string;
          plate_number: string;
          route_id?: string | null;
          capacity?: number | null;
        }
      | {
          label: string;
          plate_number: string;
          route_id?: string | null;
          capacity?: number | null;
        }[]
      | null,
  );

  const scan = await getTripScanStats(data.id);

  return {
    id: data.id,
    bus_id: data.bus_id,
    trip_date: data.trip_date,
    direction: data.direction as TripWithBus["direction"],
    status: data.status as TripWithBus["status"],
    matron_id: data.matron_id,
    started_at: data.started_at,
    ended_at: data.ended_at,
    departed_school_at: data.departed_school_at ?? null,
    // actual_arrival_at pending schema_week2.sql migration -- not selected yet.
    actual_arrival_at: null,
    bus_label: bus?.label ?? "",
    bus_plate: bus?.plate_number ?? "",
    bus_capacity: bus?.capacity ?? null,
    aboard_count: scan?.aboardNow ?? 0,
    students_scanned: scan?.uniqueStudentsScanned ?? 0,
    roster_on_bus: scan?.rosterOnBus ?? 0,
  };
}

export async function markTripDepartedSchool(input: {
  tripId: string;
  matronId?: string | null;
  lat?: number | null;
  lng?: number | null;
}): Promise<{ trip: Trip } | { error: string; code: "not_found" | "invalid" }> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: existing, error: findError } = await supabase
    .from("trips")
    .select(
      "id, status, started_at, departed_school_at, matron_id, bus_id, trip_date, direction, ended_at",
    )
    .eq("id", input.tripId)
    .maybeSingle();

  if (findError || !existing) {
    return { error: "Trip not found", code: "not_found" };
  }

  if (existing.status === "cancelled" || existing.status === "completed") {
    return { error: `Trip is ${existing.status}`, code: "invalid" };
  }

  const update: Record<string, unknown> = {
    status: "active",
    departed_school_at: existing.departed_school_at ?? now,
    started_at: existing.started_at ?? now,
  };
  if (input.matronId) update.matron_id = input.matronId;

  const { data, error } = await supabase
    .from("trips")
    .update(update)
    .eq("id", input.tripId)
    .select(
      "id, bus_id, trip_date, direction, status, matron_id, started_at, ended_at, departed_school_at",
    )
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Failed to mark departure", code: "invalid" };
  }

  if (
    typeof input.lat === "number" &&
    typeof input.lng === "number" &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng)
  ) {
    await insertTripLocation({
      tripId: input.tripId,
      lat: input.lat,
      lng: input.lng,
      recordedBy: input.matronId ?? null,
    });
  }

  return {
    trip: {
      id: data.id,
      bus_id: data.bus_id,
      trip_date: data.trip_date,
      direction: data.direction as TripDirection,
      status: data.status as Trip["status"],
      matron_id: data.matron_id,
      started_at: data.started_at,
      ended_at: data.ended_at,
      departed_school_at: data.departed_school_at,
    },
  };
}

/**
 * Manually-entered "arrived at school" time -- see schema_week2.sql's
 * actual_arrival_at comment for why this isn't GPS-derived. Idempotent: a
 * second call doesn't overwrite an already-recorded time, same as
 * markTripDepartedSchool's `?? now()` pattern for started_at.
 */
export async function markTripArrived(input: {
  tripId: string;
  arrivedAt?: string | null;
}): Promise<{ trip: Trip } | { error: string; code: "not_found" | "invalid" }> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  // actual_arrival_at (schema_week2.sql) is written but not yet applied live
  // (confirmed 2026-08-19: "column trips.actual_arrival_at does not exist").
  // Try the real select first so this self-activates the moment the
  // migration lands; fall back to the same columns minus this one so the
  // rest of the function's validation still works today.
  let existing: Record<string, unknown> | null = null;
  let findError: { message: string } | null = null;
  const attempt = await supabase
    .from("trips")
    .select(
      "id, status, started_at, ended_at, departed_school_at, actual_arrival_at, bus_id, trip_date, direction, matron_id",
    )
    .eq("id", input.tripId)
    .maybeSingle();
  if (attempt.error && /actual_arrival_at/i.test(attempt.error.message)) {
    const retry = await supabase
      .from("trips")
      .select("id, status, started_at, ended_at, departed_school_at, bus_id, trip_date, direction, matron_id")
      .eq("id", input.tripId)
      .maybeSingle();
    existing = retry.data ? { ...retry.data, actual_arrival_at: null } : null;
    findError = retry.error;
  } else {
    existing = attempt.data;
    findError = attempt.error;
  }

  if (findError || !existing) {
    return { error: "Trip not found", code: "not_found" };
  }

  if (existing.status === "cancelled") {
    return { error: "Trip is cancelled", code: "invalid" };
  }

  const arrivedAt = input.arrivedAt ?? now;
  const startedAt = existing.started_at as string | null;
  if (startedAt) {
    const startedAtFloorMs = Math.floor(new Date(startedAt).getTime() / 60_000) * 60_000;
    if (new Date(arrivedAt).getTime() < startedAtFloorMs) {
      return {
        error: "Arrival time can't be before the trip started",
        code: "invalid",
      };
    }
  }

  const update = await supabase
    .from("trips")
    .update({ actual_arrival_at: (existing.actual_arrival_at as string | null) ?? arrivedAt })
    .eq("id", input.tripId)
    .select(
      "id, bus_id, trip_date, direction, status, matron_id, started_at, ended_at, departed_school_at, actual_arrival_at",
    )
    .single();

  if (update.error && /actual_arrival_at/i.test(update.error.message)) {
    return {
      error: "Marking arrival isn't enabled yet -- ask Kai to run the pending schema_week2.sql migration.",
      code: "invalid",
    };
  }
  const { data, error } = update;
  if (error || !data) {
    return { error: error?.message ?? "Failed to mark arrival", code: "invalid" };
  }

  return {
    trip: {
      id: data.id,
      bus_id: data.bus_id,
      trip_date: data.trip_date,
      direction: data.direction as TripDirection,
      status: data.status as Trip["status"],
      matron_id: data.matron_id,
      started_at: data.started_at,
      ended_at: data.ended_at,
      departed_school_at: data.departed_school_at,
      actual_arrival_at: data.actual_arrival_at,
    },
  };
}

export type MissingRosterStudent = { id: string; name: string };

/** Assigned students on this bus's route with no boarding_events row at all
 * on this trip (voided scans don't count -- see boarding_events.voided_at).
 * Used to gate trip completion (completeTrip()) on an explained roster gap. */
async function findUnscannedStudents(
  tripId: string,
  busId: string,
): Promise<MissingRosterStudent[]> {
  const supabase = await createClient();
  const [roster, eventsRes] = await Promise.all([
    getStudentsForBus(busId),
    supabase
      .from("boarding_events")
      .select("student_id")
      .eq("trip_id", tripId)
      .is("voided_at", null),
  ]);
  // Older DBs without voided_at column -- retry without the filter.
  let events = eventsRes.data;
  if (eventsRes.error && /voided_at/i.test(eventsRes.error.message)) {
    const retry = await supabase
      .from("boarding_events")
      .select("student_id")
      .eq("trip_id", tripId);
    events = retry.data;
  }
  const scannedIds = new Set((events ?? []).map((e) => e.student_id as string));
  return roster
    .filter((s) => !scannedIds.has(s.id))
    .map((s) => ({ id: s.id, name: `${s.first_name} ${s.last_name}`.trim() }));
}

export async function completeTrip(input: {
  tripId: string;
  matronId?: string | null;
  lat?: number | null;
  lng?: number | null;
  endedAt?: string | null;
  incompleteRosterReason?: string | null;
}): Promise<
  | { trip: Trip }
  | {
      error: string;
      code: "not_found" | "invalid" | "incomplete_roster";
      missingStudents?: MissingRosterStudent[];
    }
> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: existing, error: findError } = await supabase
    .from("trips")
    .select("id, status, started_at, bus_id")
    .eq("id", input.tripId)
    .maybeSingle();

  if (findError || !existing) {
    return { error: "Trip not found", code: "not_found" };
  }

  if (existing.status === "cancelled" || existing.status === "completed") {
    return { error: `Trip is already ${existing.status}`, code: "invalid" };
  }

  // Every assigned student should have at least one scan by end-of-trip.
  // If some don't and the matron hasn't explained why yet, block and ask --
  // this is meant to be something she reports on, not a silent gap admins
  // discover later in a CSV.
  const missingStudents = await findUnscannedStudents(
    input.tripId,
    existing.bus_id as string,
  );
  if (missingStudents.length > 0 && !input.incompleteRosterReason?.trim()) {
    return {
      error: `${missingStudents.length} student${missingStudents.length === 1 ? "" : "s"} on this bus ${missingStudents.length === 1 ? "wasn't" : "weren't"} scanned. Explain why before ending the trip.`,
      code: "incomplete_roster",
      missingStudents,
    };
  }

  // A picked end time is trusted as-is (the matron may be logging a trip
  // that already ended a few minutes ago), but it can't predate the trip's
  // own start — that would corrupt duration reporting downstream. Compare
  // against started_at floored to the minute: the <input type="datetime-
  // local"> picker only has minute precision, so a trip started and ended
  // within the same clock minute must not fail on a few seconds' skew.
  const endedAt = input.endedAt ?? now;
  if (existing.started_at) {
    const startedAtFloorMs =
      Math.floor(new Date(existing.started_at).getTime() / 60_000) * 60_000;
    if (new Date(endedAt).getTime() < startedAtFloorMs) {
      return {
        error: "End time can't be before the trip started",
        code: "invalid",
      };
    }
  }

  const { data, error } = await supabase
    .from("trips")
    .update({ status: "completed", ended_at: endedAt })
    .eq("id", input.tripId)
    .select(
      "id, bus_id, trip_date, direction, status, matron_id, started_at, ended_at, departed_school_at",
    )
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Failed to end trip", code: "invalid" };
  }

  if (
    typeof input.lat === "number" &&
    typeof input.lng === "number" &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng)
  ) {
    await insertTripLocation({
      tripId: input.tripId,
      lat: input.lat,
      lng: input.lng,
      recordedBy: input.matronId ?? null,
    });
  }

  if (missingStudents.length > 0) {
    const names = missingStudents.map((s) => s.name).join(", ");
    const incidentOutcome = await createIncident({
      tripId: input.tripId,
      type: "incomplete_roster",
      severity: "medium",
      notes: `Not scanned: ${names}\nReason: ${input.incompleteRosterReason?.trim()}`,
      reportedBy: input.matronId ?? null,
    });
    if ("incident" in incidentOutcome) {
      await notifyIncidentAlert({
        incidentId: incidentOutcome.incident.id,
        tripId: input.tripId,
        type: "incomplete_roster",
        severity: "medium",
        notes: incidentOutcome.incident.notes,
      });
    } else {
      // Most likely incidents_type_check not yet widened for
      // "incomplete_roster" (schema pending) -- the trip still ends
      // (that's the matron's job done), but this must not disappear
      // silently.
      console.error(
        "[incomplete_roster] failed to log incident:",
        incidentOutcome.error,
      );
    }
  }

  return {
    trip: {
      id: data.id,
      bus_id: data.bus_id,
      trip_date: data.trip_date,
      direction: data.direction as TripDirection,
      status: data.status as Trip["status"],
      matron_id: data.matron_id,
      started_at: data.started_at,
      ended_at: data.ended_at,
      departed_school_at: data.departed_school_at,
    },
  };
}

export async function insertTripLocation(input: {
  tripId: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  recordedBy?: string | null;
}): Promise<{ location: TripLocation } | { error: string }> {
  const supabase = await createClient();

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, status")
    .eq("id", input.tripId)
    .maybeSingle();

  if (tripError || !trip) {
    return { error: "Trip not found" };
  }

  if (trip.status === "cancelled" || trip.status === "completed") {
    return { error: `Trip is ${trip.status}; cannot record location` };
  }

  // Keep trip active while pings flow
  if (trip.status === "scheduled") {
    await supabase
      .from("trips")
      .update({
        status: "active",
        started_at: new Date().toISOString(),
        matron_id: input.recordedBy ?? undefined,
      })
      .eq("id", input.tripId)
      .eq("status", "scheduled");
  }

  const { data, error } = await supabase
    .from("trip_locations")
    .insert({
      trip_id: input.tripId,
      lat: input.lat,
      lng: input.lng,
      accuracy: input.accuracy ?? null,
      speed: input.speed ?? null,
      heading: input.heading ?? null,
      recorded_by: input.recordedBy ?? null,
    })
    .select(
      "id, trip_id, lat, lng, accuracy, speed, heading, recorded_at, recorded_by",
    )
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Failed to save location" };
  }

  return {
    location: {
      id: data.id,
      trip_id: data.trip_id,
      lat: data.lat,
      lng: data.lng,
      accuracy: data.accuracy,
      speed: data.speed,
      heading: data.heading,
      recorded_at: data.recorded_at,
      recorded_by: data.recorded_by,
    },
  };
}

export async function getLatestTripLocation(
  tripId: string,
): Promise<TripLocation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_locations")
    .select(
      "id, trip_id, lat, lng, accuracy, speed, heading, recorded_at, recorded_by",
    )
    .eq("trip_id", tripId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as TripLocation;
}

export async function getTripLocationTrail(
  tripId: string,
): Promise<TripLocation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_locations")
    .select(
      "id, trip_id, lat, lng, accuracy, speed, heading, recorded_at, recorded_by",
    )
    .eq("trip_id", tripId)
    .order("recorded_at", { ascending: true });

  if (error || !data) return [];
  return data as TripLocation[];
}

export async function getRouteStops(
  routeId: string,
): Promise<{ routeName: string | null; stops: RouteStop[] }> {
  const supabase = await createClient();

  const { data: route } = await supabase
    .from("routes")
    .select("id, name")
    .eq("id", routeId)
    .maybeSingle();

  if (!route) return { routeName: null, stops: [] };

  const { data: rows, error } = await supabase
    .from("route_stops")
    .select(
      `
      stop_id,
      stop_order,
      eta_offset_minutes,
      stops ( id, school_id, name, lat, lng, kind )
    `,
    )
    .eq("route_id", routeId)
    .order("stop_order", { ascending: true });

  if (error || !rows) {
    return { routeName: route.name, stops: [] };
  }

  const stops: RouteStop[] = [];
  for (const row of rows) {
    const stop = first(
      row.stops as
        | {
            id: string;
            school_id: string;
            name: string;
            lat: number | null;
            lng: number | null;
            kind: StopKind;
          }
        | {
            id: string;
            school_id: string;
            name: string;
            lat: number | null;
            lng: number | null;
            kind: StopKind;
          }[]
        | null,
    );
    if (!stop) continue;
    stops.push({
      stop_id: row.stop_id,
      stop_order: row.stop_order,
      eta_offset_minutes: row.eta_offset_minutes,
      stop: stop as Stop,
    });
  }

  return { routeName: route.name, stops };
}

export async function getStopsForTrip(
  tripId: string,
): Promise<{
  routeId: string | null;
  routeName: string | null;
  routeDirection: TripDirection | null;
  stops: RouteStop[];
}> {
  const supabase = await createClient();

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, bus_id, direction, buses ( route_id, school_id )")
    .eq("id", tripId)
    .maybeSingle();

  if (tripError || !trip) {
    return { routeId: null, routeName: null, routeDirection: null, stops: [] };
  }

  const bus = first(
    trip.buses as
      | { route_id: string | null; school_id: string }
      | { route_id: string | null; school_id: string }[]
      | null,
  );

  let routeId = bus?.route_id ?? null;

  // Do not guess "first school route for this direction" — that sent drivers
  // down the wrong path when buses.route_id was unset. Require an explicit link.
  if (!routeId) {
    return { routeId: null, routeName: null, routeDirection: null, stops: [] };
  }

  const { data: route } = await supabase
    .from("routes")
    .select("id, name, direction")
    .eq("id", routeId)
    .maybeSingle();

  const { data: rows, error } = await supabase
    .from("route_stops")
    .select(
      `
      stop_id,
      stop_order,
      eta_offset_minutes,
      stops ( id, school_id, name, lat, lng, kind )
    `,
    )
    .eq("route_id", routeId)
    .order("stop_order", { ascending: true });

  if (error || !rows) {
    return {
      routeId,
      routeName: route?.name ?? null,
      routeDirection: (route?.direction as TripDirection) ?? null,
      stops: [],
    };
  }

  const stops: RouteStop[] = [];
  for (const row of rows) {
    const stop = first(
      row.stops as
        | {
            id: string;
            school_id: string;
            name: string;
            lat: number | null;
            lng: number | null;
            kind: StopKind;
          }
        | {
            id: string;
            school_id: string;
            name: string;
            lat: number | null;
            lng: number | null;
            kind: StopKind;
          }[]
        | null,
    );
    if (!stop) continue;
    stops.push({
      stop_id: row.stop_id,
      stop_order: row.stop_order,
      eta_offset_minutes: row.eta_offset_minutes,
      stop: stop as Stop,
    });
  }

  return {
    routeId,
    routeName: route?.name ?? null,
    routeDirection: (route?.direction as TripDirection) ?? null,
    stops,
  };
}

/**
 * PM drop-off retraces the AM pickup path backward (team-confirmed
 * 2026-09-07: if the morning pickup order is A-B-C, the afternoon drop-off
 * order is C-B-A) -- there is no separately-stored PM route, this is a
 * pure read-time transform of the one saved (AM) order. Recomputes both
 * the ordinal position and eta_offset_minutes for the reversed direction --
 * reusing the AM offsets as-is would put the right stops in the right
 * order but with backwards ETAs (e.g. the first PM stop, school, would
 * show "40 min away" instead of "0 min away").
 */
function reverseStopsForReturnLeg(stops: RouteStop[]): RouteStop[] {
  const reversed = [...stops].reverse();
  const points = reversed.map((rs) => ({
    id: rs.stop_id,
    lat: rs.stop.lat ?? NaN,
    lng: rs.stop.lng ?? NaN,
  }));
  const withCoords = points.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
  );
  const offsets = estimateEtaOffsetsMinutes(withCoords);
  const offsetById = new Map(withCoords.map((p, i) => [p.id, offsets[i]]));
  return reversed.map((rs, i) => ({
    ...rs,
    stop_order: i,
    eta_offset_minutes: offsetById.get(rs.stop_id) ?? rs.eta_offset_minutes,
  }));
}

/**
 * Driver navigation stops: only live-sheet stops that have at least one
 * student assignment on this trip's route (same coordinates Matron sees),
 * in the saved route order — never a live NN/2-opt reshuffle.
 * Applies active temporary parent location overrides for `onDate` when present.
 * `direction` reverses the order for a PM (return leg) trip -- see
 * reverseStopsForReturnLeg above. Omit it (or pass "am") to get the stored
 * order as-is, e.g. for admin tooling that manages the canonical route.
 */
export async function getNavigationStopsForTrip(
  tripId: string,
  onDate?: string,
  direction?: TripDirection,
): Promise<{
  routeId: string | null;
  routeName: string | null;
  stops: RouteStop[];
}> {
  const base = await getStopsForTrip(tripId);
  if (!base.routeId || base.stops.length === 0) return base;

  const supabase = await createClient();
  const { data: assignments } = await supabase
    .from("student_stop_assignments")
    .select("stop_id")
    .eq("route_id", base.routeId);

  const assignedIds = new Set(
    (assignments ?? [])
      .map((a) => a.stop_id as string | null)
      .filter((id): id is string => Boolean(id)),
  );

  // Prefer assigned stops (parent-accurate). Fall back to full route if none linked yet.
  let stops =
    assignedIds.size > 0
      ? base.stops.filter((s) => assignedIds.has(s.stop.id))
      : base.stops;

  const day = onDate ?? new Date().toISOString().slice(0, 10);
  try {
    const { data: overrides } = await supabase
      .from("student_stop_temporary_overrides")
      .select(
        "student_id, original_stop_id, override_lat, override_lng, override_name, starts_on, ends_on",
      )
      .eq("route_id", base.routeId)
      .lte("starts_on", day)
      .gte("ends_on", day);

    if (overrides?.length) {
      // Map original stop → first active override coords (one pin per stop).
      const byStop = new Map<
        string,
        { lat: number; lng: number; name: string | null }
      >();
      for (const o of overrides) {
        if (
          typeof o.original_stop_id !== "string" ||
          o.override_lat == null ||
          o.override_lng == null
        ) {
          continue;
        }
        if (!byStop.has(o.original_stop_id)) {
          byStop.set(o.original_stop_id, {
            lat: Number(o.override_lat),
            lng: Number(o.override_lng),
            name:
              typeof o.override_name === "string" ? o.override_name : null,
          });
        }
      }
      stops = stops.map((rs) => {
        const ov = byStop.get(rs.stop.id);
        if (!ov) return rs;
        return {
          ...rs,
          stop: {
            ...rs.stop,
            lat: ov.lat,
            lng: ov.lng,
            name: ov.name?.trim()
              ? `${ov.name.trim()} (temp)`
              : `${rs.stop.name} (temp)`,
          },
        };
      });
    }
  } catch {
    // Table may not exist until SQL migration is applied — keep base stops.
  }

  // Only reverse when the underlying route is the shared AM-tagged one --
  // if an admin ever explicitly builds a "pm"-tagged route (the field
  // exists in the route-creation form, just unused today) and links it to
  // a bus, its stored order is presumably already the intended PM order,
  // and reversing it again would put it backward.
  if (direction === "pm" && base.routeDirection !== "pm") {
    stops = reverseStopsForReturnLeg(stops);
  }

  return { ...base, stops };
}

export function buildOptimizedStopsView(stops: RouteStop[]): {
  stops: RouteStop[];
  distanceKm: number;
  beforeKm: number;
} {
  const points = stops.map((s) => ({
    id: s.stop_id,
    lat: s.stop.lat ?? NaN,
    lng: s.stop.lng ?? NaN,
    kind: s.stop.kind,
  }));

  const beforeKm = measurePathKm(points);
  const { order, distanceKm } = optimizeStopOrder(points);
  const withCoords = order.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
  );
  const offsets = estimateEtaOffsetsMinutes(withCoords);
  const byId = new Map(stops.map((s) => [s.stop_id, s]));
  const optimized: RouteStop[] = order.map((p, i) => {
    const base = byId.get(p.id)!;
    return {
      ...base,
      stop_order: i,
      eta_offset_minutes: offsets[i] ?? base.eta_offset_minutes,
    };
  });

  return { stops: optimized, distanceKm, beforeKm };
}

export async function saveOptimizedRouteOrder(input: {
  routeId: string;
  stopIdsInOrder: string[];
  etaOffsets?: number[];
}): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();

  // route_stops has a unique (route_id, stop_order) constraint, so writing new
  // positions one row at a time can collide with a not-yet-updated row still
  // holding that position. Move every row to a temporary, non-colliding
  // position first (offset well past any realistic real stop count), then
  // apply the final order in a second pass.
  const TEMP_OFFSET = 100000;

  for (let i = 0; i < input.stopIdsInOrder.length; i++) {
    const { error } = await supabase
      .from("route_stops")
      .update({ stop_order: TEMP_OFFSET + i })
      .eq("route_id", input.routeId)
      .eq("stop_id", input.stopIdsInOrder[i]);

    if (error) return { error: error.message };
  }

  for (let i = 0; i < input.stopIdsInOrder.length; i++) {
    const { error } = await supabase
      .from("route_stops")
      .update({
        stop_order: i,
        eta_offset_minutes: input.etaOffsets?.[i] ?? null,
      })
      .eq("route_id", input.routeId)
      .eq("stop_id", input.stopIdsInOrder[i]);

    if (error) return { error: error.message };
  }

  // Best-effort discovery / change log (ignore if table missing).
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("route_change_logs").insert({
      route_id: input.routeId,
      event_type: "optimized",
      summary: `Saved optimized stop order (${input.stopIdsInOrder.length} stops)`,
      after_stop_ids: input.stopIdsInOrder,
      actor_id: user?.id ?? null,
    });
  } catch {
    // ignore
  }

  return { ok: true };
}

export async function createIncident(input: {
  tripId: string;
  type: import("@/types/database").IncidentType;
  severity?: import("@/types/database").IncidentSeverity;
  notes?: string | null;
  lat?: number | null;
  lng?: number | null;
  reportedBy?: string | null;
  occurredAt?: string | null;
  late?: boolean;
}): Promise<
  | { incident: import("@/types/database").Incident }
  | { error: string; code: "not_found" | "invalid" }
> {
  const supabase = await createClient();

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, status")
    .eq("id", input.tripId)
    .maybeSingle();

  if (tripError || !trip) {
    return { error: "Trip not found", code: "not_found" };
  }

  let notes = input.notes?.trim() || null;
  if (input.late && input.occurredAt) {
    const when = new Date(input.occurredAt);
    const stamp = Number.isNaN(when.getTime())
      ? input.occurredAt
      : when.toLocaleString();
    const prefix = `[Late log · occurred ${stamp}]`;
    notes = notes ? `${prefix}\n${notes}` : prefix;
  }

  const row: Record<string, unknown> = {
    trip_id: input.tripId,
    type: input.type,
    severity: input.severity ?? "medium",
    notes,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    reported_by: input.reportedBy ?? null,
  };
  // Optional: stamp created_at to the occurred time for late logs so history
  // sorts by when it happened. Schema allows custom created_at on insert.
  if (input.late && input.occurredAt) {
    const when = new Date(input.occurredAt);
    if (!Number.isNaN(when.getTime())) {
      row.created_at = when.toISOString();
    }
  }

  const { data, error } = await supabase
    .from("incidents")
    .insert(row)
    .select(
      "id, trip_id, reported_by, type, severity, notes, lat, lng, created_at",
    )
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Failed to log incident", code: "invalid" };
  }

  return {
    incident: data as import("@/types/database").Incident,
  };
}

export type IncidentWithReporter = import("@/types/database").Incident & {
  reported_by_name: string | null;
};

/** All incidents logged against one trip, newest first -- powers the admin
 * trip detail page's Incidents section. */
export async function listIncidentsForTrip(
  tripId: string,
): Promise<IncidentWithReporter[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incidents")
    .select(
      "id, trip_id, reported_by, type, severity, notes, lat, lng, created_at, profiles ( full_name )",
    )
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => {
    const profile = first(
      row.profiles as { full_name: string } | { full_name: string }[] | null,
    );
    const { profiles: _profiles, ...rest } = row as typeof row & {
      profiles?: unknown;
    };
    return {
      ...(rest as import("@/types/database").Incident),
      reported_by_name: profile?.full_name ?? null,
    };
  });
}

/**
 * Freehand record of a child who boarded but has no student_id -- new
 * student not yet entered, or a master-sheet gap. There's no real student
 * row to attach a boarding_events row to, so this rides the incidents
 * pipeline (same as overload/incomplete_roster) instead of the roster.
 */
export async function logUnlistedChildScan(input: {
  tripId: string;
  childName: string;
  notes?: string | null;
  reportedBy?: string | null;
}): Promise<
  | { incident: import("@/types/database").Incident }
  | { error: string; code: "not_found" | "invalid" }
> {
  const name = input.childName.trim();
  if (!name) {
    return { error: "Child's name is required", code: "invalid" };
  }
  const extra = input.notes?.trim();
  return createIncident({
    tripId: input.tripId,
    type: "unlisted_child",
    severity: "low",
    notes: extra ? `${name} -- ${extra}` : name,
    reportedBy: input.reportedBy ?? null,
  });
}

export type StopBoardingEntry = {
  id: string;
  student_name: string;
  event_type: BoardingEventType;
  scanned_at: string;
  lat: number | null;
  lng: number | null;
  distance_m: number | null;
};

export async function getBoardingNearStop(
  tripId: string,
  stopId: string,
): Promise<{
  stop: { id: string; name: string; lat: number; lng: number } | null;
  events: StopBoardingEntry[];
}> {
  const supabase = await createClient();

  const { data: stop, error: stopError } = await supabase
    .from("stops")
    .select("id, name, lat, lng")
    .eq("id", stopId)
    .maybeSingle();

  if (stopError || !stop || stop.lat == null || stop.lng == null) {
    return { stop: null, events: [] };
  }

  let { data, error } = await supabase
    .from("boarding_events")
    .select(
      `
      id,
      event_type,
      scanned_at,
      lat,
      lng,
      stop_id,
      students ( first_name, last_name )
    `,
    )
    .eq("trip_id", tripId)
    .order("scanned_at", { ascending: true });

  // Older DBs without stop_id — fall back to lat/lng only.
  if (error && /stop_id|schema cache|column/i.test(error.message)) {
    const fallback = await supabase
      .from("boarding_events")
      .select(
        `
        id,
        event_type,
        scanned_at,
        lat,
        lng,
        students ( first_name, last_name )
      `,
      )
      .eq("trip_id", tripId)
      .order("scanned_at", { ascending: true });
    data = (fallback.data ?? []).map((row) => ({ ...row, stop_id: null }));
    error = fallback.error;
  }

  if (error || !data) {
    return { stop, events: [] };
  }

  const events = data
    .map((row) => {
      const student = first(
        row.students as
          | { first_name: string; last_name: string }
          | { first_name: string; last_name: string }[]
          | null,
      );
      const tagged =
        (row as { stop_id?: string | null }).stop_id != null &&
        (row as { stop_id?: string | null }).stop_id === stopId;
      const distance_m =
        row.lat != null && row.lng != null
          ? haversineKm(
              { lat: stop.lat, lng: stop.lng },
              { lat: row.lat, lng: row.lng },
            ) * 1000
          : null;

      return {
        id: row.id,
        student_name: student
          ? `${student.first_name} ${student.last_name}`
          : "Unknown student",
        event_type: row.event_type as BoardingEventType,
        scanned_at: row.scanned_at,
        lat: row.lat,
        lng: row.lng,
        distance_m: tagged ? distance_m ?? 0 : distance_m,
        tagged,
      };
    })
    .filter(
      (event) =>
        event.tagged ||
        (event.distance_m != null &&
          event.distance_m <= STOP_PROXIMITY_RADIUS_M),
    )
    .sort(
      (a, b) =>
        new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime(),
    )
    .map(({ tagged: _tagged, ...event }) => event);

  return { stop, events };
}

export type TripStopBoardingGroup = {
  stop: {
    id: string;
    name: string;
    kind: StopKind;
    order: number;
    lat: number | null;
    lng: number | null;
  };
  events: StopBoardingEntry[];
};

/**
 * All route stops for a trip with boarding scans grouped under each stop
 * (by stop_id tag when present, else nearest-stop GPS within proximity).
 */
export async function getTripBoardingGroupedByStop(
  tripId: string,
): Promise<{
  routeName: string | null;
  stops: TripStopBoardingGroup[];
}> {
  const { routeName, routeDirection, stops: baseStops } =
    await getStopsForTrip(tripId);
  if (baseStops.length === 0) {
    return { routeName, stops: [] };
  }

  const supabase = await createClient();

  const { data: tripRow } = await supabase
    .from("trips")
    .select("direction")
    .eq("id", tripId)
    .maybeSingle();
  // Same guard as getNavigationStopsForTrip: don't reverse a route that's
  // already explicitly "pm"-tagged -- its stored order is presumably
  // already the intended PM order.
  const stops =
    tripRow?.direction === "pm" && routeDirection !== "pm"
      ? reverseStopsForReturnLeg(baseStops)
      : baseStops;

  let { data, error } = await supabase
    .from("boarding_events")
    .select(
      `
      id,
      event_type,
      scanned_at,
      lat,
      lng,
      stop_id,
      students ( first_name, last_name )
    `,
    )
    .eq("trip_id", tripId)
    .is("voided_at", null)
    .order("scanned_at", { ascending: true });

  // Older DBs without voided_at column -- retry without the filter.
  if (error && /voided_at/i.test(error.message)) {
    const retry = await supabase
      .from("boarding_events")
      .select(
        `
        id,
        event_type,
        scanned_at,
        lat,
        lng,
        stop_id,
        students ( first_name, last_name )
      `,
      )
      .eq("trip_id", tripId)
      .order("scanned_at", { ascending: true });
    data = retry.data;
    error = retry.error;
  }

  if (error && /stop_id|schema cache|column/i.test(error.message)) {
    const fallback = await supabase
      .from("boarding_events")
      .select(
        `
        id,
        event_type,
        scanned_at,
        lat,
        lng,
        students ( first_name, last_name )
      `,
      )
      .eq("trip_id", tripId)
      .order("scanned_at", { ascending: true });
    data = (fallback.data ?? []).map((row) => ({ ...row, stop_id: null }));
    error = fallback.error;
  }

  const eventsByStop = new Map<string, StopBoardingEntry[]>();
  for (const rs of stops) {
    eventsByStop.set(rs.stop.id, []);
  }

  for (const row of data ?? []) {
    const student = first(
      row.students as
        | { first_name: string; last_name: string }
        | { first_name: string; last_name: string }[]
        | null,
    );
    const student_name = student
      ? `${student.first_name} ${student.last_name}`
      : "Unknown student";

    let matchedStopId =
      typeof (row as { stop_id?: string | null }).stop_id === "string"
        ? (row as { stop_id: string }).stop_id
        : null;
    let distance_m: number | null = null;

    if (!matchedStopId && row.lat != null && row.lng != null) {
      let best: { id: string; distance_m: number } | null = null;
      for (const rs of stops) {
        if (rs.stop.lat == null || rs.stop.lng == null) continue;
        const d =
          haversineKm(
            { lat: row.lat, lng: row.lng },
            { lat: rs.stop.lat, lng: rs.stop.lng },
          ) * 1000;
        if (d > STOP_PROXIMITY_RADIUS_M) continue;
        if (!best || d < best.distance_m) {
          best = { id: rs.stop.id, distance_m: d };
        }
      }
      if (best) {
        matchedStopId = best.id;
        distance_m = best.distance_m;
      }
    } else if (matchedStopId && row.lat != null && row.lng != null) {
      const rs = stops.find((s) => s.stop.id === matchedStopId);
      if (rs?.stop.lat != null && rs.stop.lng != null) {
        distance_m =
          haversineKm(
            { lat: row.lat, lng: row.lng },
            { lat: rs.stop.lat, lng: rs.stop.lng },
          ) * 1000;
      }
    }

    if (!matchedStopId || !eventsByStop.has(matchedStopId)) continue;

    eventsByStop.get(matchedStopId)!.push({
      id: row.id,
      student_name,
      event_type: row.event_type as BoardingEventType,
      scanned_at: row.scanned_at,
      lat: row.lat,
      lng: row.lng,
      distance_m,
    });
  }

  return {
    routeName,
    stops: stops.map((rs) => ({
      stop: {
        id: rs.stop.id,
        name: rs.stop.name,
        kind: rs.stop.kind,
        order: rs.stop_order,
        lat: rs.stop.lat,
        lng: rs.stop.lng,
      },
      events: eventsByStop.get(rs.stop.id) ?? [],
    })),
  };
}

// Same "primary if set, else first" resolution already used by
// upsertParentContact — kept as its own helper since guardian QR
// generation and verification both need just the parent id/name/phone,
// not the full student_parents join shape.
async function getPrimaryParentForStudent(
  studentId: string,
): Promise<{ id: string; full_name: string; phone: string | null } | null> {
  const supabase = await createClient();
  const { data: link } = await supabase
    .from("student_parents")
    .select("parent_id, is_primary")
    .eq("student_id", studentId)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!link?.parent_id) return null;

  const { data: parent } = await supabase
    .from("parents")
    .select("id, full_name, phone")
    .eq("id", link.parent_id)
    .maybeSingle();

  return parent ?? null;
}

export async function generateGuardianQrToken(input: {
  studentId: string;
  regenerate?: boolean;
}): Promise<
  | { token: string; code: string; parent: { id: string; full_name: string }; created: boolean }
  | { error: string }
> {
  const supabase = await createClient();
  const parent = await getPrimaryParentForStudent(input.studentId);

  if (!parent) {
    return { error: "No parent/guardian on file for this student yet" };
  }

  const token = buildGuardianQrToken(parent.id);

  if (input.regenerate) {
    const { error: deactivateError } = await supabase
      .from("guardian_qr_codes")
      .update({ active: false })
      .eq("parent_id", parent.id)
      .eq("active", true);
    if (deactivateError) return { error: deactivateError.message };
  } else {
    const { data: existing } = await supabase
      .from("guardian_qr_codes")
      .select("code")
      .eq("parent_id", parent.id)
      .eq("active", true)
      .maybeSingle();
    if (existing) {
      return {
        token,
        code: existing.code,
        parent: { id: parent.id, full_name: parent.full_name },
        created: false,
      };
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("guardian_qr_codes")
    .insert({ parent_id: parent.id, code: token, active: true })
    .select("code")
    .single();

  if (insertError || !inserted) {
    return { error: insertError?.message ?? "Failed to create guardian QR" };
  }

  return {
    token,
    code: inserted.code,
    parent: { id: parent.id, full_name: parent.full_name },
    created: true,
  };
}

export type GuardianResolveResult = {
  parent: { id: string; full_name: string; phone: string | null };
  guardian_qr_id: string | null;
  authorized_student_ids: string[];
};

export async function resolveGuardianByQr(
  raw: string,
): Promise<GuardianResolveResult | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const supabase = await createClient();
  const parsed = parseGuardianQrToken(trimmed);
  let parentId: string | null = null;
  let guardianQrId: string | null = null;

  if (parsed) {
    parentId = parsed.parentId;
    const { data: qrRow } = await supabase
      .from("guardian_qr_codes")
      .select("id")
      .eq("code", trimmed)
      .eq("active", true)
      .maybeSingle();
    guardianQrId = qrRow?.id ?? null;
  } else {
    const { data: qrRow } = await supabase
      .from("guardian_qr_codes")
      .select("id, parent_id")
      .eq("code", trimmed)
      .eq("active", true)
      .maybeSingle();
    parentId = qrRow?.parent_id ?? null;
    guardianQrId = qrRow?.id ?? null;
  }

  if (!parentId) return null;

  const { data: parent } = await supabase
    .from("parents")
    .select("id, full_name, phone")
    .eq("id", parentId)
    .maybeSingle();
  if (!parent) return null;

  const { data: links } = await supabase
    .from("student_parents")
    .select("student_id")
    .eq("parent_id", parentId);

  return {
    parent,
    guardian_qr_id: guardianQrId,
    authorized_student_ids: (links ?? []).map((l) => l.student_id as string),
  };
}

export type GuardianVerifyResult =
  | { ok: true; matched: true; parent_name: string }
  | { ok: true; matched: false; parent_name: string; reason: string }
  | { ok: false; error: string };

/**
 * Confirms the guardian scanned at hand-off is actually authorized for the
 * student on this boarding event, and records it either way — a mismatch
 * is exactly the case this feature exists to catch, so it's logged too
 * (in guardian_scan_events, matched=false), not just silently rejected.
 */
export async function verifyGuardianForBoardingEvent(input: {
  boardingEventId: string;
  code: string;
  scannedBy?: string | null;
}): Promise<GuardianVerifyResult> {
  const supabase = await createClient();

  const { data: event, error: eventError } = await supabase
    .from("boarding_events")
    .select("id, trip_id, student_id, lat, lng")
    .eq("id", input.boardingEventId)
    .maybeSingle();

  if (eventError || !event) {
    return { ok: false, error: "Boarding event not found" };
  }

  const guardian = await resolveGuardianByQr(input.code);
  if (!guardian) {
    return { ok: false, error: "Guardian QR not recognized" };
  }

  const matched = guardian.authorized_student_ids.includes(event.student_id);

  const { error: insertError } = await supabase
    .from("guardian_scan_events")
    .insert({
      trip_id: event.trip_id,
      student_id: event.student_id,
      parent_id: guardian.parent.id,
      guardian_qr_id: guardian.guardian_qr_id,
      event_type: "pickup_verify",
      matched,
      lat: event.lat,
      lng: event.lng,
      scanned_by: input.scannedBy ?? null,
      notes: matched ? null : "Guardian not linked to this student",
    });

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  if (!matched) {
    return {
      ok: true,
      matched: false,
      parent_name: guardian.parent.full_name,
      reason: "This guardian is not linked to this student",
    };
  }

  return { ok: true, matched: true, parent_name: guardian.parent.full_name };
}
