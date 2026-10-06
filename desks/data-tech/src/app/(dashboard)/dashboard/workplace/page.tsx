import { listWorkplacePeople } from "@/lib/workplace-people";

export const dynamic = "force-dynamic";

const APP_LABEL: Record<string, string> = {
  onboarding: "Onboarding",
  ops: "Ops",
  data_tech: "Data & Tech",
  workboard: "1–5’s",
  uniforms: "Uniforms",
  marketing: "Marketing",
  talent: "Talent Academy",
  visitors: "Visitors",
  lesson_plans: "Lesson Plans",
  mel: "MEL",
};

export default async function WorkplacePeoplePage() {
  const people = await listWorkplacePeople();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-medium text-navy">Workplace people</h1>
        <p className="mt-1 text-sm text-black/55">
          Everyone who has used Onboarding, Ops, Data & Tech, 1–5’s, or Marketing. {people.length}{" "}
          people. This reads the shared Ops database; live department sites are unchanged.
        </p>
      </div>
      {people.length === 0 ? (
        <p className="rounded-xl border border-black/10 bg-white p-4 text-sm text-black/60">
          No shared people yet. Set WORKPLACE_DATABASE_URL to the Ops database.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/10 bg-black/[0.02] font-medium text-navy">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Campus</th>
                <th className="px-4 py-3">Apps</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.email} className="border-b border-black/5">
                  <td className="px-4 py-3">{person.fullName}</td>
                  <td className="px-4 py-3 text-black/65">{person.email}</td>
                  <td className="px-4 py-3">{person.jobTitle || "—"}</td>
                  <td className="px-4 py-3">{person.campus || "—"}</td>
                  <td className="px-4 py-3">{person.apps.map((app) => APP_LABEL[app] ?? app).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
