import Link from "next/link";
import { LiveMapClient } from "@/components/maps/LiveMapClient";
import { RoutePerformancePanel } from "@/components/routes/RoutePerformancePanel";
import { listRoutes } from "@/lib/db/routes";
import {
  MAJUNDO_DEMO_ROUTE_ID,
  MAJUNDO_DEMO_ROUTE_NAME,
} from "@/lib/demo/majundoDemoRoute";

export default async function LiveMapPage() {
  const routes = await listRoutes();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-electric-blue">
        Admin · Live ops
      </p>
      <h1 className="mt-1 text-2xl font-bold text-electric-blue">Live map</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Active buses with latest GPS from <code>GET /api/trips/live</code>. Green =
        ping within 90s. Route performance (below) compares distance/time around{" "}
        <Link
          href={`/admin/routes/${MAJUNDO_DEMO_ROUTE_ID}`}
          className="font-semibold text-electric-blue hover:underline"
        >
          {MAJUNDO_DEMO_ROUTE_NAME}
        </Link>
        .
      </p>

      <div className="mt-6">
        <LiveMapClient />
      </div>

      <RoutePerformancePanel
        routes={routes.map((r) => ({
          id: r.id,
          name: r.name,
          direction: r.direction,
        }))}
        defaultRouteId={MAJUNDO_DEMO_ROUTE_ID}
      />
    </main>
  );
}
