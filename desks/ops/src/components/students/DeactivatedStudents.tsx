import { getDeactivatedStudents } from "@/lib/db/queries";
import { StudentEditDialog } from "@/components/students/StudentEditDialog";
import type { SchoolScope } from "@/lib/schools";

/**
 * Collapsed list of deactivated students at the bottom of the admin Students
 * tab. The main roster only loads active students, so without this a
 * deactivated student could never be brought back.
 */
export async function DeactivatedStudents({ campus }: { campus?: SchoolScope }) {
  const students = await getDeactivatedStudents(campus);
  if (students.length === 0) return null;

  return (
    <details className="ui-panel mt-10 p-4">
      <summary className="cursor-pointer text-sm font-bold uppercase tracking-[0.12em] text-ink-muted">
        Deactivated students ({students.length})
      </summary>
      <ul className="mt-3 flex flex-col divide-y divide-card-border">
        {students.map((student) => (
          <li
            key={student.id}
            className="flex items-center justify-between gap-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                {student.first_name} {student.last_name}
              </p>
              <p className="text-xs text-ink-faint">
                {student.school_name ?? "Unknown campus"} ·{" "}
                {student.class_name || "No class"}
              </p>
            </div>
            <StudentEditDialog student={student} />
          </li>
        ))}
      </ul>
    </details>
  );
}
