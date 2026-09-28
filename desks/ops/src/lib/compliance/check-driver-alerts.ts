import { createServiceClient } from "@/lib/supabase/admin";
import {
  buildDriverCompliance,
  buildInsuranceCompliance,
} from "@/lib/compliance/driver-compliance";
import { EXPIRING_SOON_DAYS } from "@/lib/compliance/expiry-check";
import { notifyAdminSms, notifyDriverSms } from "@/lib/messaging/notify-driver";

type Raised = {
  driver_id: string;
  driver_name: string;
  alert_key: string;
  note: string;
  admin: boolean;
  driver: boolean;
};

/**
 * Find licences / PSV / insurance / medical / service due within ~7 days
 * (or already expired) and SMS admin + driver once per alert_key window.
 */
export async function checkDriverComplianceAlerts(): Promise<{
  raised: Raised[];
}> {
  const supabase = createServiceClient();
  const raised: Raised[] = [];

  const { data: drivers, error } = await supabase
    .from("drivers")
    .select(
      `id, name, phone, license_expiry, psv_permit_expiry, first_aid_cert_expiry,
       personal_insurance_expiry, medical_cert_expiry, next_service_due, police_clearance_date,
       photo_url, license_photo_url, psv_badge_photo_url, medical_cert_photo_url,
       national_id_photo_url, cv_url, active`,
    )
    .eq("active", true);

  if (error) throw new Error(error.message);

  const { data: buses } = await supabase
    .from("buses")
    .select("id, label, driver_id, insurance_expiry")
    .eq("active", true)
    .not("insurance_expiry", "is", null);

  const busInsuranceByDriver = new Map<string, { label: string; expiry: string }[]>();
  for (const bus of buses ?? []) {
    if (!bus.driver_id || !bus.insurance_expiry) continue;
    const list = busInsuranceByDriver.get(bus.driver_id) ?? [];
    list.push({ label: bus.label, expiry: bus.insurance_expiry });
    busInsuranceByDriver.set(bus.driver_id, list);
  }

  for (const driver of drivers ?? []) {
    const { checks } = buildDriverCompliance(driver);
    const notes: { key: string; note: string }[] = [];

    for (const [key, check] of Object.entries(checks)) {
      if (
        check.status === "expiring_soon" ||
        check.status === "expired" ||
        check.status === "missing"
      ) {
        notes.push({ key, note: check.note });
      }
    }

    for (const bus of busInsuranceByDriver.get(driver.id) ?? []) {
      const ins = buildInsuranceCompliance(bus.expiry);
      if (ins.status === "expiring_soon" || ins.status === "expired") {
        notes.push({
          key: `bus_insurance:${bus.label}`,
          note: `${bus.label}: ${ins.note}`,
        });
      }
    }

    for (const item of notes) {
      const weekKey =
        item.key.startsWith("doc_") || item.note.includes("not uploaded")
          ? `${item.key}:missing`
          : `${item.key}:${isoWeekStamp()}`;
      const { error: dupErr } = await supabase
        .from("driver_compliance_alerts")
        .insert({
          driver_id: driver.id,
          alert_key: weekKey,
          channel: "sms",
        });

      // Unique violation → already alerted this week for this key
      if (dupErr) continue;

      const message = `Silverleaf Driver: ${driver.name} — ${item.note}. Renew within ${EXPIRING_SOON_DAYS} days if not already done.`;

      const admin = await notifyAdminSms({ message });
      const driverSms = await notifyDriverSms({
        phone: driver.phone,
        message,
      });

      raised.push({
        driver_id: driver.id,
        driver_name: driver.name,
        alert_key: weekKey,
        note: item.note,
        admin: admin.sent,
        driver: driverSms.sent,
      });
    }
  }

  return { raised };
}

function isoWeekStamp(): string {
  const d = new Date();
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
