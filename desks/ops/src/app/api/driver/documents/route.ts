import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import {
  attachSignedUrls,
  getDriverById,
  updateDriver,
  type DriverWriteInput,
} from "@/lib/db/drivers";
import { createClient } from "@/lib/supabase/server";
import {
  DRIVER_DOC_SLOTS,
  slotColumn,
  slotStoragePaths,
  type DriverDocSlot,
} from "@/lib/storage/driver-doc-slots";
import { buildDriverCompliance } from "@/lib/compliance/driver-compliance";
import { notifyAdminSms } from "@/lib/messaging/admin-alert";

async function resolveOwnDriverId(userId: string) {
  // Documents are strictly scoped to profiles.driver_id — never fall back to
  // bus name matching (that let drivers open each other's uploads).
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("driver_id")
    .eq("id", userId)
    .maybeSingle();
  return typeof profile?.driver_id === "string" ? profile.driver_id : null;
}

/** GET /api/driver/documents — linked driver's record + signed file URLs */
export async function GET() {
  const auth = await requireUser(["driver", "admin", "transport"]);
  if ("response" in auth) return auth.response;

  const driverId = await resolveOwnDriverId(auth.userId);
  if (!driverId) {
    return NextResponse.json(
      {
        error:
          "No fleet driver linked to your login. Ask transport to set profiles.driver_id for your account — do not share logins.",
        driver: null,
        code: "DRIVER_NOT_LINKED",
      },
      { status: 404 },
    );
  }

  const driver = await getDriverById(driverId);
  if (!driver) {
    return NextResponse.json(
      { error: "Driver not found", driver: null },
      { status: 404 },
    );
  }

  const [withUrls] = await attachSignedUrls([driver]);
  return NextResponse.json({ driver: withUrls });
}

/** PATCH /api/driver/documents — update own dates / doc paths */
export async function PATCH(request: Request) {
  const auth = await requireUser(["driver", "admin", "transport"]);
  if ("response" in auth) return auth.response;

  const driverId = await resolveOwnDriverId(auth.userId);
  if (!driverId) {
    return NextResponse.json(
      { error: "No fleet driver linked to your login" },
      { status: 404 },
    );
  }

  const body = (await request.json()) as DriverWriteInput;
  const { name: _name, ...safe } = body;
  const outcome = await updateDriver(driverId, safe);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  const [withUrls] = await attachSignedUrls([outcome.driver]);

  if (auth.role === "driver") {
    const { worst, checks } = buildDriverCompliance(withUrls);
    if (worst !== "ok") {
      const top = Object.values(checks)
        .filter((c) => c.status !== "ok")
        .slice(0, 2)
        .map((c) => c.note)
        .join("; ");
      void notifyAdminSms({
        message: `Silverleaf Driver file updated — ${withUrls.name}: ${top || "review compliance on Drivers page"}.`,
      });
    }
  }

  return NextResponse.json({ driver: withUrls });
}

/** DELETE /api/driver/documents?slot=photo — remove file + clear column */
export async function DELETE(request: Request) {
  const auth = await requireUser(["driver", "admin", "transport"]);
  if ("response" in auth) return auth.response;

  const driverId = await resolveOwnDriverId(auth.userId);
  if (!driverId) {
    return NextResponse.json(
      { error: "No fleet driver linked to your login" },
      { status: 404 },
    );
  }

  const slot = new URL(request.url).searchParams.get(
    "slot",
  ) as DriverDocSlot | null;
  if (!slot || !DRIVER_DOC_SLOTS.includes(slot)) {
    return NextResponse.json(
      { error: `slot must be one of: ${DRIVER_DOC_SLOTS.join(", ")}` },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { error: storageErr } = await supabase.storage
    .from("driver-documents")
    .remove(slotStoragePaths(driverId, slot));
  if (storageErr) {
    return NextResponse.json({ error: storageErr.message }, { status: 400 });
  }

  const patch: DriverWriteInput = { [slotColumn(slot)]: null };
  const outcome = await updateDriver(driverId, patch);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  const [withUrls] = await attachSignedUrls([outcome.driver]);
  return NextResponse.json({ ok: true, driver: withUrls });
}
