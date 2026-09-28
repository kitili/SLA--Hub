import { classifyDays, daysUntil, pickWorst, worstStatus } from "./expiry-check";
import type { ComplianceCheck, ComplianceStatus } from "./expiry-check";
import {
  missingRequiredDocs,
  type DriverDocRecord,
} from "./tz-driver-docs";

export type { ComplianceStatus, ComplianceCheck } from "./expiry-check";
export { docCompletionPercent, missingRequiredDocs, TZ_DRIVER_DOC_REQUIREMENTS } from "./tz-driver-docs";

function checkExpiry(expiry: string | null, label: string, missingNote: string): ComplianceCheck {
  if (!expiry) {
    return { status: "missing", note: missingNote, days_remaining: null };
  }
  const days = daysUntil(expiry);
  const status = classifyDays(days);
  if (status === "expired") {
    return {
      status: "expired",
      note: `${label} expired ${Math.abs(days)} day(s) ago`,
      days_remaining: days,
    };
  }
  if (status === "expiring_soon") {
    return {
      status: "expiring_soon",
      note: `${label} expires in ${days} day(s)`,
      days_remaining: days,
    };
  }
  return {
    status: "ok",
    note: `${label} valid (${days} days remaining)`,
    days_remaining: days,
  };
}

export function buildLicenseCompliance(
  driver: { license_expiry?: string | null } | null,
): ComplianceCheck {
  if (!driver) {
    return { status: "missing", note: "No driver assigned", days_remaining: null };
  }
  return checkExpiry(driver.license_expiry ?? null, "License", "No license expiry on file");
}

export function buildInsuranceCompliance(
  insuranceExpiry: string | null | undefined,
): ComplianceCheck {
  return checkExpiry(insuranceExpiry ?? null, "Insurance", "No insurance expiry on file");
}

export function buildPsvPermitCompliance(
  psvPermitExpiry: string | null | undefined,
): ComplianceCheck {
  return checkExpiry(psvPermitExpiry ?? null, "PSV permit", "No PSV permit expiry on file");
}

export function buildFirstAidCompliance(
  firstAidCertExpiry: string | null | undefined,
): ComplianceCheck {
  return checkExpiry(firstAidCertExpiry ?? null, "First aid cert", "No first aid cert expiry on file");
}

export function buildPersonalInsuranceCompliance(
  personalInsuranceExpiry: string | null | undefined,
): ComplianceCheck {
  return checkExpiry(
    personalInsuranceExpiry ?? null,
    "Personal insurance",
    "No personal insurance expiry on file",
  );
}

// Medical cert expiry is opt-in: unlike the other checks, an unset value is
// not itself a compliance gap (there's no fixed known regulatory interval to
// derive it from) -- it only produces a check once an admin explicitly sets
// one. medical_exam_date (last exam date) never feeds this at all.
export function buildMedicalCertCompliance(
  medicalCertExpiry: string | null | undefined,
): ComplianceCheck | null {
  if (!medicalCertExpiry) return null;
  return checkExpiry(medicalCertExpiry, "Medical cert", "");
}

export function buildServiceDueCompliance(
  nextServiceDue: string | null | undefined,
): ComplianceCheck {
  return checkExpiry(
    nextServiceDue ?? null,
    "Vehicle service",
    "No next service date on file",
  );
}

type DriverComplianceInput = DriverDocRecord & {
  license_expiry?: string | null;
  psv_permit_expiry?: string | null;
  first_aid_cert_expiry?: string | null;
  personal_insurance_expiry?: string | null;
  medical_cert_expiry?: string | null;
  next_service_due?: string | null;
  police_clearance_date?: string | null;
};

function buildPoliceClearanceCheck(
  policeClearanceDate: string | null | undefined,
): ComplianceCheck | null {
  if (!policeClearanceDate) {
    return {
      status: "missing",
      note: "Police clearance date not on file",
      days_remaining: null,
    };
  }
  const days = daysUntil(policeClearanceDate);
  if (days < -365) {
    return {
      status: "expiring_soon",
      note: "Police clearance over 12 months old — renew",
      days_remaining: days,
    };
  }
  return null;
}

export function buildDriverCompliance(
  driver: DriverComplianceInput | null,
): { checks: Record<string, ComplianceCheck>; worst: ComplianceStatus } {
  const checks: Record<string, ComplianceCheck> = {
    license: buildLicenseCompliance(driver),
    psv_permit: buildPsvPermitCompliance(driver?.psv_permit_expiry),
    first_aid: buildFirstAidCompliance(driver?.first_aid_cert_expiry),
    personal_insurance: buildPersonalInsuranceCompliance(
      driver?.personal_insurance_expiry,
    ),
    service: buildServiceDueCompliance(driver?.next_service_due),
  };
  const medicalCert = buildMedicalCertCompliance(driver?.medical_cert_expiry);
  if (medicalCert) checks.medical_cert = medicalCert;

  const police = buildPoliceClearanceCheck(driver?.police_clearance_date);
  if (police) checks.police_clearance = police;

  for (const doc of missingRequiredDocs(driver)) {
    checks[`doc_${doc.field}`] = {
      status: "missing",
      note: `${doc.label} not uploaded`,
      days_remaining: null,
    };
  }

  return { checks, worst: worstStatus(Object.values(checks).map((c) => c.status)) };
}

export function buildBusCompliance(
  bus: { insurance_expiry?: string | null },
  driver: DriverComplianceInput | null,
): {
  busInsurance: ComplianceCheck;
  driver: { checks: Record<string, ComplianceCheck>; worst: ComplianceStatus };
  worst: ComplianceStatus;
} {
  const busInsurance = buildInsuranceCompliance(bus.insurance_expiry);
  const driverCompliance = buildDriverCompliance(driver);
  return {
    busInsurance,
    driver: driverCompliance,
    worst: worstStatus([busInsurance.status, driverCompliance.worst]),
  };
}

export { pickWorst };
