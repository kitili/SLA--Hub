import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { deleteDriver, updateDriver } from "@/lib/db/drivers";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/drivers/:id — admin only
 * Body: { name?, licenseNumber?, licenseExpiry?, phone?, nextOfKinName?,
 *         nextOfKinPhone?, nextOfKinRelationship?, psvPermitNumber?,
 *         psvPermitExpiry?, firstAidCertExpiry?, personalInsuranceExpiry?,
 *         medicalExamDate?, medicalCertExpiry?, licenseClass?,
 *         policeClearanceDate?, childSafetyTrainingDate?,
 *         defensiveDrivingTrainingDate? }
 */
export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const body = (await request.json()) as {
    name?: string;
    licenseNumber?: string | null;
    licenseExpiry?: string | null;
    phone?: string | null;
    nextOfKinName?: string | null;
    nextOfKinPhone?: string | null;
    nextOfKinRelationship?: string | null;
    psvPermitNumber?: string | null;
    psvPermitExpiry?: string | null;
    firstAidCertExpiry?: string | null;
    personalInsuranceExpiry?: string | null;
    medicalExamDate?: string | null;
    medicalCertExpiry?: string | null;
    licenseClass?: string | null;
    policeClearanceDate?: string | null;
    childSafetyTrainingDate?: string | null;
    defensiveDrivingTrainingDate?: string | null;
    photoUrl?: string | null;
    nationalIdNumber?: string | null;
    nationalIdPhotoUrl?: string | null;
    passportNumber?: string | null;
    passportPhotoUrl?: string | null;
    cvUrl?: string | null;
    licensePhotoUrl?: string | null;
    psvBadgePhotoUrl?: string | null;
    medicalCertPhotoUrl?: string | null;
  };

  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json(
      { error: "Driver name is required" },
      { status: 400 },
    );
  }

  const outcome = await updateDriver(id, body);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome);
}

/**
 * DELETE /api/drivers/:id — admin only
 * Unlinks (doesn't delete) any bus pointing at this driver.
 */
export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const outcome = await deleteDriver(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
