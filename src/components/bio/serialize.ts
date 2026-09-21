import type { BioReadResult } from "@/lib/db/queries/bio";
import type { BioInitialValues } from "./BioForm";

/**
 * Convert a DB bio read (Drizzle row types with Date/boolean/null) into the
 * plain, string-only initial values the client form expects.
 *
 * This runs on the server (the page) so we hand the client island a fully
 * serialisable object — no Date instances, no `undefined`. Empty/absent values
 * become "" so inputs are controlled from first render.
 */

/** boolean|null → "yes" | "no" | "" for tri-state Yes/No selects. */
function yesNo(v: boolean | null | undefined): "yes" | "no" | "" {
  if (v === true) return "yes";
  if (v === false) return "no";
  return "";
}

/** string|null → string (date columns come back as "yyyy-mm-dd" strings). */
function str(v: string | null | undefined): string {
  return v ?? "";
}

/** number|null → string for numeric inputs. */
function num(v: number | null | undefined): string {
  return v === null || v === undefined ? "" : String(v);
}

/** The three reference slots are fixed (order 1–3); fill from saved rows. */
function referenceSlots(
  rows: BioReadResult["references"] | undefined,
): BioInitialValues["references"] {
  const byOrder = new Map<number, BioReadResult["references"][number]>();
  for (const r of rows ?? []) {
    if (r.referenceOrder != null) byOrder.set(r.referenceOrder, r);
  }
  return [1, 2, 3].map((order) => {
    const r = byOrder.get(order);
    return {
      referenceOrder: order,
      fullName: str(r?.fullName),
      relationship: str(r?.relationship),
      phone: str(r?.phone),
      email: str(r?.email),
      organization: str(r?.organization),
    };
  });
}

export function toInitialValues(
  data: BioReadResult | null,
): BioInitialValues {
  const p = data?.profile;

  return {
    surname: str(p?.surname),
    firstName: str(p?.firstName),
    middleName: str(p?.middleName),
    otherNames: str(p?.otherNames),
    maidenName: str(p?.maidenName),
    gender: str(p?.gender),
    maritalStatus: str(p?.maritalStatus),
    dateOfBirth: str(p?.dateOfBirth),
    placeOfBirth: str(p?.placeOfBirth),
    nationality: str(p?.nationality),
    hasDisabilities: yesNo(p?.hasDisabilities),
    disabilitiesDetails: str(p?.disabilitiesDetails),

    homePhone: str(p?.homePhone),
    mobilePhone: str(p?.mobilePhone),
    email: str(p?.email),
    residentialAddress: str(p?.residentialAddress),

    identificationNo: str(p?.identificationNo),
    idPlaceOfIssue: str(p?.idPlaceOfIssue),
    idExpiryDate: str(p?.idExpiryDate),
    drivingPermitNo: str(p?.drivingPermitNo),
    drivingPlaceOfIssue: str(p?.drivingPlaceOfIssue),
    drivingExpiryDate: str(p?.drivingExpiryDate),
    nssfNo: str(p?.nssfNo),
    tinNo: str(p?.tinNo),
    nhifNo: str(p?.nhifNo),

    position: str(p?.position),
    workStation: str(p?.workStation),

    bankName: p?.bankName ? str(p.bankName) : "CRDB",
    accountName: str(p?.accountName),
    accountNumber: str(p?.accountNumber),
    mobileMoneyNumber: str(p?.mobileMoneyNumber),

    arrestRecord: yesNo(p?.arrestRecord),
    arrestDetails: str(p?.arrestDetails),
    misconductRecord: yesNo(p?.misconductRecord),
    misconductDetails: str(p?.misconductDetails),

    certificationName: str(p?.certificationName),
    certificationDate: str(p?.certificationDate),

    // Consent is re-affirmed each save; never pre-ticked from stored data.
    consent: false,

    spouse: {
      fullName: str(data?.spouse?.fullName),
      phone: str(data?.spouse?.phone),
      occupation: str(data?.spouse?.occupation),
      employer: str(data?.spouse?.employer),
    },
    children: (data?.children ?? []).map((c) => ({
      fullNames: str(c.fullNames),
      dateOfBirth: str(c.dateOfBirth),
      gender: str(c.gender),
      schoolEmployer: str(c.schoolEmployer),
      contactNumber: str(c.contactNumber),
    })),
    familyContacts: (data?.familyContacts ?? []).map((c) => ({
      relationship: str(c.relationship),
      fullName: str(c.fullName),
      phone: str(c.phone),
      address: str(c.address),
      occupation: str(c.occupation),
    })),
    emergencyContacts: (data?.emergencyContacts ?? []).map((c) => ({
      fullName: str(c.fullName),
      relationship: str(c.relationship),
      phone: str(c.phone),
      address: str(c.address),
      priority: str(c.priority),
    })),
    relativesEmployed: (data?.relativesEmployed ?? []).map((c) => ({
      fullName: str(c.fullName),
      relationship: str(c.relationship),
      position: str(c.position),
      workStation: str(c.workStation),
    })),
    qualifications: (data?.qualifications ?? []).map((c) => ({
      level: str(c.level),
      qualification: str(c.qualification),
      institution: str(c.institution),
      yearObtained: num(c.yearObtained),
    })),
    employmentHistory: (data?.employmentHistory ?? []).map((c) => ({
      employer: str(c.employer),
      position: str(c.position),
      dateFrom: str(c.dateFrom),
      dateTo: str(c.dateTo),
      leavingReason: str(c.leavingReason),
    })),
    references: referenceSlots(data?.references),
  };
}
