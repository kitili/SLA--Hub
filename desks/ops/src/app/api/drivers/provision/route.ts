import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { createServiceClient } from "@/lib/supabase/admin";
import { getDrivers } from "@/lib/db/drivers";
import {
  DRIVER_EMAIL_DOMAIN,
  generateTempPassword,
  listDriverLoginLinks,
  provisionDriverLogin,
  suggestDriverEmail,
  type ProvisionDriverResult,
} from "@/lib/driver/provision";

/**
 * GET /api/drivers/provision
 * Login-link status for every fleet driver + suggested emails for unlinked ones.
 */
export async function GET() {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  let service;
  try {
    service = createServiceClient();
  } catch {
    return NextResponse.json(
      { error: "Server missing service role — cannot look up Auth users" },
      { status: 503 },
    );
  }

  try {
    const [drivers, links] = await Promise.all([
      getDrivers(),
      listDriverLoginLinks(service),
    ]);
    const byDriver = new Map(links.map((l) => [l.driver_id, l]));

    const rows = drivers.map((d) => {
      const link = byDriver.get(d.id) ?? null;
      return {
        driver_id: d.id,
        name: d.name,
        active: d.active,
        phone: d.phone,
        linked: Boolean(link),
        email: link?.email ?? null,
        user_id: link?.user_id ?? null,
        suggested_email: suggestDriverEmail(d.name, DRIVER_EMAIL_DOMAIN),
      };
    });

    return NextResponse.json({
      domain: DRIVER_EMAIL_DOMAIN,
      linked_count: rows.filter((r) => r.linked).length,
      unlinked_count: rows.filter((r) => !r.linked && r.active).length,
      drivers: rows,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lookup failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

type BulkBody = {
  items?: Array<{ driverId: string; email?: string }>;
  allUnlinked?: boolean;
  emailDomain?: string;
  /** generate (default) | shared | none (link existing Auth only) */
  passwordMode?: "generate" | "shared" | "none";
  sharedPassword?: string;
  /** When re-linking an existing Auth user, also reset their password. */
  resetExistingPasswords?: boolean;
};

/**
 * POST /api/drivers/provision
 * Create Auth logins + link profiles.driver_id for many fleet drivers.
 * Returns temporary passwords once — download/save immediately.
 */
export async function POST(request: Request) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as BulkBody;
  const domain = (body.emailDomain ?? DRIVER_EMAIL_DOMAIN).trim().toLowerCase();
  const passwordMode = body.passwordMode ?? "generate";
  const shared = body.sharedPassword?.trim() || null;
  const resetExisting = Boolean(body.resetExistingPasswords);

  if (passwordMode === "shared" && !shared) {
    return NextResponse.json(
      { error: "sharedPassword is required when passwordMode is shared" },
      { status: 400 },
    );
  }

  let service;
  try {
    service = createServiceClient();
  } catch {
    return NextResponse.json(
      { error: "Server missing service role — cannot provision Auth users" },
      { status: 503 },
    );
  }

  const fleet = await getDrivers();
  const fleetById = new Map(fleet.map((d) => [d.id, d]));

  let targets: Array<{ driverId: string; email?: string }> = [];

  if (body.allUnlinked) {
    const links = await listDriverLoginLinks(service);
    const linkedIds = new Set(links.map((l) => l.driver_id));
    targets = fleet
      .filter((d) => d.active && !linkedIds.has(d.id))
      .map((d) => ({ driverId: d.id }));
  } else if (Array.isArray(body.items) && body.items.length > 0) {
    targets = body.items
      .map((i) => ({
        driverId: (i.driverId ?? "").trim(),
        email: i.email?.trim(),
      }))
      .filter((i) => Boolean(i.driverId));
  } else {
    return NextResponse.json(
      { error: "Pass items[] or set allUnlinked: true" },
      { status: 400 },
    );
  }

  if (targets.length === 0) {
    return NextResponse.json({
      ok: true,
      summary: { created: 0, linked: 0, failed: 0, total: 0 },
      results: [] as ProvisionDriverResult[],
      message: "Nothing to provision — every active driver already has a login.",
    });
  }

  if (targets.length > 200) {
    return NextResponse.json(
      { error: "Max 200 drivers per request" },
      { status: 400 },
    );
  }

  const results: ProvisionDriverResult[] = [];

  for (const item of targets) {
    const driver = fleetById.get(item.driverId);
    if (!driver) {
      results.push({
        driver_id: item.driverId,
        driver_name: "",
        email: item.email ?? "",
        user_id: "",
        action: "linked_existing",
        temporary_password: null,
        error: "Driver not found",
      });
      continue;
    }

    try {
      let password: string | null | undefined;
      let createIfMissing = true;

      if (passwordMode === "none") {
        password = null;
        createIfMissing = false;
      } else if (passwordMode === "shared") {
        password = shared;
      } else if (resetExisting) {
        password = generateTempPassword();
      } else {
        // generate for new users only; existing → link without password reset
        password = undefined;
      }

      results.push(
        await provisionDriverLogin(service, {
          driverId: driver.id,
          driverName: driver.name,
          email: item.email,
          emailDomain: domain,
          password,
          createIfMissing,
        }),
      );
    } catch (err) {
      results.push({
        driver_id: driver.id,
        driver_name: driver.name,
        email: item.email ?? suggestDriverEmail(driver.name, domain),
        user_id: "",
        action: "linked_existing",
        temporary_password: null,
        error: err instanceof Error ? err.message : "Provision failed",
      });
    }
  }

  const created = results.filter((r) => !r.error && r.action === "created").length;
  const linked = results.filter(
    (r) => !r.error && (r.action === "updated_link" || r.action === "linked_existing"),
  ).length;
  const failed = results.filter((r) => r.error).length;

  return NextResponse.json({
    ok: failed === 0,
    summary: { created, linked, failed, total: results.length },
    results,
    note: "Save temporary_password values now — they are not stored again.",
  });
}
