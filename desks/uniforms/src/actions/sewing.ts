"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyMove, locationByCode, StockError } from "@/lib/stock";
import { fail } from "@/lib/form";
import { fromCm, toCm } from "@/lib/materials";
import { writeAudit } from "@/lib/audit";

async function consumeMaterials(
  tx: Prisma.TransactionClient,
  skuId: string,
  size: string,
  pieces: number,
) {
  const recipes = await tx.garmentRecipe.findMany({ where: { skuId, size } });
  for (const recipe of recipes) {
    let needCm = toCm(recipe.qtyPerPiece, recipe.unit) * pieces;
    const batches = await tx.materialBatch.findMany({
      where: {
        kind: recipe.materialKind,
        description: recipe.materialName,
        remaining: { gt: 0 },
      },
      orderBy: { createdAt: "asc" },
    });
    for (const batch of batches) {
      if (needCm <= 0) break;
      const haveCm = toCm(batch.remaining, batch.unit);
      const take = Math.min(haveCm, needCm);
      const leftCm = haveCm - take;
      await tx.materialBatch.update({
        where: { id: batch.id },
        data: { remaining: Math.max(0, Math.round(fromCm(leftCm, batch.unit))) },
      });
      needCm -= take;
    }
  }
}

export async function createSewingJob(formData: FormData) {
  const user = await requireUser(["TAILOR", "STORE"]);
  const skuId = String(formData.get("skuId") ?? "");
  const size = String(formData.get("size") ?? "");
  const expected = Number.parseInt(String(formData.get("expected") ?? "0"), 10);
  const location = String(formData.get("location") ?? "MAIN");
  if (!skuId || !size || expected <= 0) await fail("SKU, size, and expected qty required.");

  // A second open job for the exact same SKU/size/location is almost always
  // an accidental double-submit (e.g. the MAIN-shortage alert's "Send to
  // Loveness" button staying clickable after already being used) rather than
  // a real need for two parallel batches — needing more of the same job
  // means editing its expected qty, not queuing a duplicate.
  const existingOpenJob = await prisma.sewingJob.findFirst({
    where: { skuId, size, location, status: { in: ["QUEUED", "IN_PROGRESS"] } },
  });
  if (existingOpenJob) {
    await fail(
      `There's already an open job for this SKU/size at ${location} (queued ${existingOpenJob.expected}) — edit its quantity on the Sewing page instead of starting a second one.`,
    );
  }

  let tailorId = user.id;
  if (user.role === "STORE") {
    // Imani is raising this on Loveness's behalf (e.g. from the MAIN-shortage
    // alert) — there's only one tailor today, so no picker is needed.
    const tailor = await prisma.user.findFirst({ where: { role: "TAILOR" } });
    if (!tailor) await fail("No tailor account exists to assign this job to.");
    tailorId = tailor.id;
  }

  const job = await prisma.sewingJob.create({
    data: {
      tailorId,
      skuId,
      size,
      expected,
      status: "QUEUED",
      note: String(formData.get("note") ?? ""),
      location,
    },
  });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "CREATE",
    entity: "SewingJob",
    entityId: job.id,
    note: `${skuId} ${size} x${expected}`,
  });
  revalidatePath("/sewing");
  revalidatePath("/slm");
  revalidatePath("/alerts");
}

export async function completeSewingJob(formData: FormData) {
  const user = await requireUser(["TAILOR"]);
  const id = String(formData.get("jobId") ?? "");
  const actual = Number.parseInt(String(formData.get("actual") ?? "0"), 10);
  const job = await prisma.sewingJob.findUnique({ where: { id } });
  if (!job) return fail("Job not found.");
  if (actual <= 0) return fail("Actual qty required.");

  const destCode = job.location === "SHOP_USA" ? "SHOP_USA" : "MAIN";
  try {
    const dest = await locationByCode(destCode);
    await prisma.$transaction(async (tx) => {
      await applyMove(tx, {
        locationId: dest.id,
        skuId: job.skuId,
        size: job.size,
        qty: actual,
        reason: "SEW_IN",
        ref: `SEW-${job.id.slice(-6)}`,
        note: `${user.name} completed job`,
      });
      await consumeMaterials(tx, job.skuId, job.size, actual);
      await tx.sewingJob.update({
        where: { id },
        data: { actual, status: "DONE" },
      });
    });
  } catch (err) {
    await fail(err instanceof StockError ? err.message : "Complete failed.");
  }
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "COMPLETE",
    entity: "SewingJob",
    entityId: id,
    note: `actual ${actual}`,
  });
  revalidatePath("/sewing");
  revalidatePath("/slm");
  revalidatePath("/stock");
}

// Scoped to jobs that aren't DONE yet — no stock has been credited, so
// deleting is a clean no-side-effects operation. A DONE job already moved
// real stock via completeSewingJob and consumed materials, so deleting it
// here would silently desync the ledger — re-checked server-side, not just
// trusted from the UI only rendering this for open jobs.
export async function deleteSewingJob(formData: FormData) {
  const user = await requireUser(["TAILOR"]);
  const id = String(formData.get("jobId") ?? "");
  const job = await prisma.sewingJob.findUnique({ where: { id }, include: { sku: true } });
  if (!job) return fail("Job not found.");
  if (job.status === "DONE") return fail("Job is already completed — can't delete a job that already moved stock.");
  // MaterialRequest.sewingJobId is a required FK — deleting a job with any
  // request against it (even a cancelled/rejected one) would otherwise hit a
  // raw DB constraint error instead of a clean message.
  const hasRequests = await prisma.materialRequest.findFirst({ where: { sewingJobId: id } });
  if (hasRequests) {
    await fail(`${job.sku.code} ${job.size} has a materials/labour request against it — cancel or resolve that first.`);
  }

  await prisma.sewingJob.delete({ where: { id } });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "DELETE",
    entity: "SewingJob",
    entityId: id,
    ref: `${job.sku.code} ${job.size}`,
    note: `Expected ${job.expected}`,
  });
  revalidatePath("/sewing");
  revalidatePath("/slm");
}

// Same non-DONE scoping as deleteSewingJob — only the SKU/size/expected
// quantity are editable, never actual/status (those only ever change via
// completeSewingJob, which is the one place stock actually moves).
export async function updateSewingJob(formData: FormData) {
  const user = await requireUser(["TAILOR"]);
  const id = String(formData.get("jobId") ?? "");
  const skuId = String(formData.get("skuId") ?? "");
  const size = String(formData.get("size") ?? "");
  const expected = Number.parseInt(String(formData.get("expected") ?? "0"), 10);
  if (!skuId || !size || expected <= 0) return fail("SKU, size, and expected qty required.");

  const job = await prisma.sewingJob.findUnique({ where: { id }, include: { sku: true } });
  if (!job) return fail("Job not found.");
  if (job.status === "DONE") return fail("Job is already completed — can't edit a job that already moved stock.");
  // Changing the garment after materials/labour were already requested (or
  // bought) for THIS job would silently consume the wrong batch at
  // completion — MaterialRequestLine has no skuId/size of its own, only a
  // sewingJobId link, so it has no way to notice the mismatch on its own.
  if (skuId !== job.skuId || size !== job.size) {
    const hasRequests = await prisma.materialRequest.findFirst({ where: { sewingJobId: id } });
    if (hasRequests) {
      await fail("This job already has a materials/labour request against it — cancel that request first if the SKU or size needs to change.");
    }
  }

  await prisma.sewingJob.update({ where: { id }, data: { skuId, size, expected } });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "UPDATE",
    entity: "SewingJob",
    entityId: id,
    ref: `${job.sku.code} ${size}`,
    note: `Updated to expected ${expected}`,
  });
  revalidatePath("/sewing");
  revalidatePath("/slm");
}
