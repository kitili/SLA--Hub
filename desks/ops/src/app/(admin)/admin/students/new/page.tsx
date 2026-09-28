import { getSchools } from "@/lib/db/queries";
import { listRoutes } from "@/lib/db/routes";
import { AddStudentForm } from "@/components/students/AddStudentForm";

export default async function AddStudentPage() {
  const [schools, routes] = await Promise.all([getSchools(), listRoutes()]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-electric-blue">
        Admin · Students
      </p>
      <h1 className="mt-1 text-2xl font-bold text-electric-blue">
        Add student
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Creates the student with a QR code, parent contact, starting
        transport fee balance, and pickup point in one go — all required,
        since a student can&apos;t be carried without transport fee or a
        pickup point on file.
      </p>

      {schools.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius)] border border-dashed border-card-border bg-light-blue-30 p-8 text-center text-sm text-ink-muted">
          No campuses loaded yet.
        </div>
      ) : (
        <AddStudentForm schools={schools} routes={routes} />
      )}
    </main>
  );
}
