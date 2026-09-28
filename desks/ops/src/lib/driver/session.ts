import { createClient } from "@/lib/supabase/server";
import { getBuses } from "@/lib/db/queries";
import { getDriverById } from "@/lib/db/drivers";
import type { Bus } from "@/types/database";

export type DriverSession = {
  userId: string;
  driverId: string | null;
  driverName: string | null;
  assignedBuses: Bus[];
  allBuses: Bus[];
};

/**
 * Resolve driver app session: profile.driver_id → buses.driver_id.
 * Falls back to matching buses.driver_name ≈ profile.full_name when no link.
 */
export async function getDriverSession(
  userId: string,
): Promise<DriverSession> {
  const supabase = await createClient();
  const allBuses = await getBuses();

  let fullName: string | null = null;
  let driverId: string | null = null;

  const withLink = await supabase
    .from("profiles")
    .select("full_name, phone, driver_id")
    .eq("id", userId)
    .maybeSingle();

  if (withLink.error) {
    // Column may not exist until migrate_driver_profile_link.sql is applied.
    const basic = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", userId)
      .maybeSingle();
    fullName = basic.data?.full_name ?? null;
  } else {
    fullName = withLink.data?.full_name ?? null;
    driverId =
      typeof withLink.data?.driver_id === "string"
        ? withLink.data.driver_id
        : null;
  }

  let driverName: string | null = null;
  if (driverId) {
    const driver = await getDriverById(driverId);
    driverName = driver?.name ?? null;
  }

  let assignedBuses = driverId
    ? allBuses.filter((b) => b.driver_id === driverId)
    : [];

  if (assignedBuses.length === 0 && fullName) {
    const needle = fullName.trim().toLowerCase();
    if (needle.length >= 3) {
      assignedBuses = allBuses.filter(
        (b) => (b.driver_name ?? "").trim().toLowerCase() === needle,
      );
      if (assignedBuses.length > 0 && assignedBuses[0].driver_id) {
        driverId = assignedBuses[0].driver_id;
        driverName = assignedBuses[0].driver_name ?? null;
      }
    }
  }

  return {
    userId,
    driverId,
    driverName,
    assignedBuses,
    allBuses,
  };
}
