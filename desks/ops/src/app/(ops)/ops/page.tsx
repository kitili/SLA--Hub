import { brand } from "@/lib/brand";
import { DomainCardGrid } from "@/components/ops/DomainCardGrid";
import { LiveSheetBanner } from "@/components/ops/LiveSheetBanner";
import { createClient } from "@/lib/supabase/server";
import { isRole, type Role } from "@/lib/roles";

export default async function OpsHubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let role: Role | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = profile?.role && isRole(profile.role) ? profile.role : null;
  }

  const isOpsLead = role === "ops_manager";

  return (
    <div>
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
          {brand.shortName}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">
          {isOpsLead ? "Kitchen · Facilities · Farm" : "Dashboards"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          {isOpsLead
            ? "Your live sheets for Kitchen, Facilities, and Farm. Use the Ticket desk to reach any department — choose who should handle it on the form."
            : role === "admin" || role === "finance"
              ? "Open Admin or KPIs in the navbar for department rollups, or jump into any live sheet below. All tickets go through the single Ops Ticket desk."
              : role === "finance_manager" || role === "cfo"
                ? "Kitchen and Facilities live sheets. Use My KPIs in the navbar for procurement and facilities rollups."
                : "Each role sees only the departments they own. Farm, Kitchen, Facilities, Transport, and Ticketing run as separate live sheets."}
        </p>
      </header>
      <LiveSheetBanner
        domain="Ticketing"
        detail={
          isOpsLead
            ? "One desk for all departments — open a ticket and pick Transport, Facilities, Kitchen, Security, or Farms on the form."
            : "All cross-department requests go through the Ops Ticket desk. Open it once, choose the department on the form, and Operations routes it from there."
        }
      />
      <DomainCardGrid role={role} />
    </div>
  );
}
