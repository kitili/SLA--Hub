import { StatusBadge } from "@/components/status-badge";
import { getDefaultOrganization, getProjects } from "@/lib/data/dashboard";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const org = await getDefaultOrganization();
  const projects = await getProjects(org?.id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Projects</h2>
        <p className="mt-1 text-zinc-600">Grouped work with WhatsApp project update commands</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-zinc-500">
            No projects yet. Create one via API or seed script.
          </div>
        ) : (
          projects.map((project) => {
            const completed = project.tasks.filter((t) => t.status === "COMPLETED").length;
            const inProgress = project.tasks.filter((t) => t.status === "IN_PROGRESS").length;
            const backlog = project.tasks.filter((t) => t.status === "BACKLOG").length;

            return (
              <article key={project.id} className="rounded-xl border border-zinc-200 bg-white p-6">
                <h3 className="text-lg font-semibold">{project.name}</h3>
                {project.description ? (
                  <p className="mt-2 text-sm text-zinc-600">{project.description}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusBadge status="COMPLETED" />
                  <span className="text-sm text-zinc-600">{completed} completed</span>
                  <StatusBadge status="IN_PROGRESS" />
                  <span className="text-sm text-zinc-600">{inProgress} active</span>
                  <StatusBadge status="BACKLOG" />
                  <span className="text-sm text-zinc-600">{backlog} backlog</span>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
