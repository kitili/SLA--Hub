import Link from "next/link";
import { notFound } from "next/navigation";
import { GuardianQrSection } from "@/components/matron/GuardianQrSection";
import { StudentQrDisplay } from "@/components/matron/StudentQrDisplay";
import { StudentInitials } from "@/components/students/StudentInitials";
import { getStudentsForSession } from "@/lib/db/queries";
import { getSessionProfile } from "@/lib/auth";
import { saveParentContact } from "./actions";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function MatronStudentDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getSessionProfile();
  const { students } = session
    ? await getStudentsForSession(session)
    : { students: [] };
  const student = students.find((row) => row.id === id);

  if (!student) {
    notFound();
  }

  const fullName = `${student.first_name} ${student.last_name}`;

  return (
    <main className="flex w-full flex-col px-4 py-5">
      <Link
        href="/matron/students"
        className="text-sm font-semibold text-electric-blue no-underline hover:underline"
      >
        ← Back to student list
      </Link>

      <div className="ui-rise mt-4 flex items-start gap-3">
        <StudentInitials
          firstName={student.first_name}
          lastName={student.last_name}
          className="h-12 w-12 text-base"
        />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
            Student QR
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-electric-blue">
            {fullName}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {[student.class_name, student.school_name]
              .filter(Boolean)
              .join(" · ") || "No class assigned"}
          </p>
        </div>
      </div>

      <section className="ui-panel ui-rise ui-rise-delay-1 mt-6 p-6">
        {student.qr_code ? (
          <StudentQrDisplay
            code={student.qr_code}
            studentName={fullName}
            size="lg"
          />
        ) : (
          <p className="text-center text-sm text-ink-muted">
            No QR code assigned for this student yet.
          </p>
        )}
      </section>

      <section className="ui-panel ui-rise ui-rise-delay-2 mt-4 p-4">
        {student.parent_name ? (
          <p className="mt-3 text-sm text-ink-muted">
            Parent: {student.parent_name}
            {student.parent_phone ? ` · ${student.parent_phone}` : ""}
          </p>
        ) : (
          <p className="mt-3 text-sm text-danger">No parent contact on file.</p>
        )}
      </section>

      <section className="ui-panel ui-rise ui-rise-delay-3 mt-4 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
          {student.parent_name ? "Edit parent contact" : "Add parent contact"}
        </p>
        <form action={saveParentContact} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="student_id" value={student.id} />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Parent/guardian name</span>
            <input
              name="parent_name"
              required
              defaultValue={student.parent_name ?? ""}
              className="rounded-[var(--radius-sm)] border border-card-border bg-white/90 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-electric-blue focus:ring-2 focus:ring-gold/40"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Phone</span>
            <input
              name="parent_phone"
              type="tel"
              defaultValue={student.parent_phone ?? ""}
              className="rounded-[var(--radius-sm)] border border-card-border bg-white/90 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-electric-blue focus:ring-2 focus:ring-gold/40"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Email (optional)</span>
            <input
              name="parent_email"
              type="email"
              defaultValue={student.parent_email ?? ""}
              className="rounded-[var(--radius-sm)] border border-card-border bg-white/90 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-electric-blue focus:ring-2 focus:ring-gold/40"
            />
          </label>
          <button
            type="submit"
            className="self-start rounded-[var(--radius-sm)] bg-gradient-to-br from-navy-light to-electric-blue px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(0,35,104,0.2)] transition hover:brightness-105"
          >
            Save parent details
          </button>
        </form>
      </section>

      <section className="ui-panel ui-rise ui-rise-delay-3 mt-4 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Guardian pickup QR
        </p>
        <GuardianQrSection
          studentId={student.id}
          hasParent={Boolean(student.parent_name)}
        />
      </section>
    </main>
  );
}
