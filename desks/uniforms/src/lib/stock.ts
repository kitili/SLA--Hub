import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { MoveReason } from "./constants";

type Tx = Prisma.TransactionClient;

export class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockError";
  }
}

export async function applyMove(
  tx: Tx,
  input: {
    locationId: string;
    skuId: string;
    size: string;
    qty: number;
    reason: MoveReason;
    ref: string;
    note?: string;
  },
) {
  const existing = await tx.stockBalance.findUnique({
    where: {
      locationId_skuId_size: {
        locationId: input.locationId,
        skuId: input.skuId,
        size: input.size,
      },
    },
  });
  const next = (existing?.qty ?? 0) + input.qty;
  if (next < 0) {
    // Only fetched on the failure path — the caller only ever has a skuId in
    // scope here, and "not enough stock" without saying which item is
    // useless to whoever has to go do something about it.
    const sku = await tx.sku.findUnique({ where: { id: input.skuId }, select: { code: true, name: true } });
    const have = existing?.qty ?? 0;
    const need = have - next;
    throw new StockError(
      `Not enough ${sku ? `${sku.code} · ${sku.name}` : "stock"} size ${input.size} at this location — have ${have}, need ${need}.`,
    );
  }
  if (existing) {
    await tx.stockBalance.update({
      where: { id: existing.id },
      data: { qty: next },
    });
  } else {
    await tx.stockBalance.create({
      data: {
        locationId: input.locationId,
        skuId: input.skuId,
        size: input.size,
        qty: next,
      },
    });
  }
  await tx.stockMove.create({
    data: {
      locationId: input.locationId,
      skuId: input.skuId,
      size: input.size,
      qty: input.qty,
      reason: input.reason,
      ref: input.ref,
      note: input.note ?? "",
    },
  });
}

export async function getOnHand(locationId: string, skuId: string, size: string) {
  const row = await prisma.stockBalance.findUnique({
    where: { locationId_skuId_size: { locationId, skuId, size } },
  });
  return row?.qty ?? 0;
}

export async function locationByCode(code: string) {
  const loc = await prisma.location.findUnique({ where: { code } });
  if (!loc) throw new StockError(`Unknown location ${code}`);
  return loc;
}

export async function campusStore(campusId: string) {
  const loc = await prisma.location.findFirst({
    where: { campusId, kind: "CAMPUS" },
  });
  if (!loc) throw new StockError("Campus store not found");
  return loc;
}
