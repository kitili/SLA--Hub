import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { createDriver, getDrivers } from "@/lib/db/drivers";

/**
 * GET /api/drivers — admin only (deliberately narrower than /api/buses;
 * license number + phone is more sensitive than a bus label/plate).
 */
export async function GET() {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const drivers = await getDrivers();
  return NextResponse.json({ drivers });
}

/**
 * POST /api/drivers — admin only
 * Body: { name, licenseNumber?, licenseExpiry?, phone?, nextOfKinName?,
 *         nextOfKinPhone?, nextOfKinRelationship?, psvPermitNumber?,
 *         psvPermitExpiry?, firstAidCertExpiry?, personalInsuranceExpiry?,
 *         medicalExamDate?, medicalCertExpiry?, licenseClass?,
 *         policeClearanceDate?, childSafetyTrainingDate?,
 *         defensiveDrivingTrainingDate? }
 */
export async function POST(request: Request) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    name?: string;
    licenseNumber?: string;
    licenseExpiry?: string;
    phone?: string;
    nextOfKinName?: string;
    nextOfKinPhone?: string;
    nextOfKinRelationship?: string;
    psvPermitNumber?: string;
    psvPermitExpiry?: string;
    firstAidCertExpiry?: string;
    personalInsuranceExpiry?: string;
    medicalExamDate?: string;
    medicalCertExpiry?: string;
    licenseClass?: string;
    policeClearanceDate?: string;
    childSafetyTrainingDate?: string;
    defensiveDrivingTrainingDate?: string;
    photoUrl?: string;
    nationalIdNumber?: string;
    nationalIdPhotoUrl?: string;
    passportNumber?: string;
    passportPhotoUrl?: string;
    cvUrl?: string;
    licensePhotoUrl?: string;
    psvBadgePhotoUrl?: string;
    medicalCertPhotoUrl?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const outcome = await createDriver({
    name: body.name.trim(),
    licenseNumber: body.licenseNumber?.trim() || null,
    licenseExpiry: body.licenseExpiry?.trim() || null,
    phone: body.phone?.trim() || null,
    nextOfKinName: body.nextOfKinName?.trim() || null,
    nextOfKinPhone: body.nextOfKinPhone?.trim() || null,
    nextOfKinRelationship: body.nextOfKinRelationship?.trim() || null,
    psvPermitNumber: body.psvPermitNumber?.trim() || null,
    psvPermitExpiry: body.psvPermitExpiry?.trim() || null,
    firstAidCertExpiry: body.firstAidCertExpiry?.trim() || null,
    personalInsuranceExpiry: body.personalInsuranceExpiry?.trim() || null,
    medicalExamDate: body.medicalExamDate?.trim() || null,
    medicalCertExpiry: body.medicalCertExpiry?.trim() || null,
    licenseClass: body.licenseClass?.trim() || null,
    policeClearanceDate: body.policeClearanceDate?.trim() || null,
    childSafetyTrainingDate: body.childSafetyTrainingDate?.trim() || null,
    defensiveDrivingTrainingDate: body.defensiveDrivingTrainingDate?.trim() || null,
    photoUrl: body.photoUrl?.trim() || null,
    nationalIdNumber: body.nationalIdNumber?.trim() || null,
    nationalIdPhotoUrl: body.nationalIdPhotoUrl?.trim() || null,
    passportNumber: body.passportNumber?.trim() || null,
    passportPhotoUrl: body.passportPhotoUrl?.trim() || null,
    cvUrl: body.cvUrl?.trim() || null,
    licensePhotoUrl: body.licensePhotoUrl?.trim() || null,
    psvBadgePhotoUrl: body.psvBadgePhotoUrl?.trim() || null,
    medicalCertPhotoUrl: body.medicalCertPhotoUrl?.trim() || null,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome, { status: 201 });
}
