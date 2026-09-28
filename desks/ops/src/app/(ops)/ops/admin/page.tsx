import { redirect } from "next/navigation";
import { SuperAdminOverviewPanel } from "@/components/ops/SuperAdminOverview";
import {
  canAccessOpsCommandCenter,
  commandCenterHeading,
} from "@/lib/dashboard/overview-scopes";
import { getOpsCommandOverview } from "@/lib/dashboard/super-admin-overview";
import { getTransportCeoKpis } from "@/lib/dashboard/transport-ceo-kpis";
import { createClient } from "@/lib/supabase/server";
import { isRole } from "@/lib/roles";

export default async function OpsCommandCenterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?next=/ops/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role && isRole(profile.role) ? profile.role : null;
  if (!role || !canAccessOpsCommandCenter(role)) {
    redirect("/ops");
  }

  const overview = await getOpsCommandOverview(role);
  const heading = commandCenterHeading(role);
  const showCeoSheet = role === "admin" || role === "finance";
  const ceo = showCeoSheet ? await getTransportCeoKpis() : null;

  return (
    <div>
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
          {heading.eyebrow}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">
          {heading.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">{heading.blurb}</p>
      </header>
      <SuperAdminOverviewPanel
        data={overview}
        ceoKpis={ceo?.kpis}
        ceoError={ceo && "error" in ceo ? ceo.error : undefined}
      />
    </div>
  );
}
