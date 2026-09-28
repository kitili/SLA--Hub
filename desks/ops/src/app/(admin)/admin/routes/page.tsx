import Link from "next/link";
import { getSchools } from "@/lib/db/queries";
import { listRoutes } from "@/lib/db/routes";
import { CreateRouteForm } from "@/components/routes/CreateRouteForm";
import { RoutePerformancePanel } from "@/components/routes/RoutePerformancePanel";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import {
  MAJUNDO_DEMO_ROUTE_ID,
  MAJUNDO_DEMO_ROUTE_NAME,
  MAJUNDO_DEMO_SEED_PATH,
} from "@/lib/demo/majundoDemoRoute";

export default async function RoutesPage() {
  const [routes, schools] = await Promise.all([listRoutes(), getSchools()]);
  const schoolById = new Map(schools.map((s) => [s.id, s]));
  const demoPresent = routes.some((r) => r.id === MAJUNDO_DEMO_ROUTE_ID);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-electric-blue">
            Admin · Routes
          </p>
          <h1 className="mt-1 text-2xl font-bold text-electric-blue">Route builder</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Create routes, drag-reorder stops on the map, optimize, and export a matron
            stop sheet. Use the performance panel to compare distance/time before and after
            optimize.
          </p>
        </div>
        <ExportCsvButton entity="routes" label="Export all routes" />
      </div>

      <section className="mt-6 rounded-[var(--radius)] border border-electric-blue/25 bg-light-blue-30 px-4 py-3 text-sm">
        <p className="font-semibold text-electric-blue">
          Soft-launch demo route
        </p>
        {demoPresent ? (
          <p className="mt-1 text-ink-muted">
            <Link
              href={`/admin/routes/${MAJUNDO_DEMO_ROUTE_ID}`}
              className="font-semibold text-electric-blue hover:underline"
            >
              {MAJUNDO_DEMO_ROUTE_NAME}
            </Link>{" "}
            is seeded — open the builder or use Map + route performance below
            (defaults to this route).
          </p>
        ) : (
          <p className="mt-1 text-ink-muted">
            Run <code className="text-xs">{MAJUNDO_DEMO_SEED_PATH}</code> after
            Week 2 schemas + <code className="text-xs">seed_silverleaf.sql</code>{" "}
            + <code className="text-xs">seed_routes.sql</code> to load{" "}
            <strong>{MAJUNDO_DEMO_ROUTE_NAME}</strong> (suboptimal stop order
            for a clear optimize win).
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          New route
        </h2>
        <CreateRouteForm schools={schools.map((s) => ({ id: s.id, name: s.name }))} />
      </section>

      <RoutePerformancePanel
        routes={routes.map((r) => ({
          id: r.id,
          name: r.name,
          direction: r.direction,
        }))}
        defaultRouteId={MAJUNDO_DEMO_ROUTE_ID}
      />

      <section className="mt-10">
        <h2 className="text-lg font-bold text-electric-blue">All routes</h2>
        {routes.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            No routes yet. Create one above or run <code>seed_routes.sql</code>.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-card-border rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
            {routes.map((route) => (
              <li key={route.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <Link
                    href={`/admin/routes/${route.id}`}
                    className="font-semibold text-ink hover:text-electric-blue hover:underline"
                  >
                    {route.name}
                    {route.id === MAJUNDO_DEMO_ROUTE_ID ? (
                      <span className="ml-2 text-xs font-semibold text-electric-blue">
                        demo
                      </span>
                    ) : null}
                  </Link>
                  <p className="text-xs text-ink-muted">
                    {route.direction.toUpperCase()}
                    {schoolById.get(route.school_id)
                      ? ` · ${schoolById.get(route.school_id)!.name}`
                      : ""}
                    {route.active ? "" : " · inactive"}
                  </p>
                </div>
                <Link
                  href={`/admin/routes/${route.id}`}
                  className="rounded-[var(--radius-sm)] border border-electric-blue/30 px-3 py-1.5 text-xs font-semibold text-electric-blue hover:bg-light-blue-30"
                >
                  Open builder
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
