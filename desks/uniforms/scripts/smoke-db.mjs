#!/usr/bin/env node
/**
 * Database invariants: schema, seed, and ledger must agree.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let failed = 0;

function ok(label, pass, detail = "") {
  console.log(`${pass ? "OK" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!pass) failed += 1;
}

try {
  try {
    await prisma.$connect();
  } catch (err) {
    console.log(`SKIP smoke-db — database unreachable (${err instanceof Error ? err.message.split("\n")[0] : err})`);
    process.exit(0);
  }

  const campuses = await prisma.campus.findMany({ orderBy: { code: "asc" } });
  ok("five campuses", campuses.length === 5, campuses.map((c) => c.code).join(","));

  const locations = await prisma.location.findMany();
  const codes = new Set(locations.map((l) => l.code));
  ok("MAIN + shop + 5 campus stores", ["MAIN", "SHOP_USA", "CAMPUS_USA", "CAMPUS_AM", "CAMPUS_KIJENGE", "CAMPUS_ILBORU", "CAMPUS_BOMA"].every((c) => codes.has(c)));

  const users = await prisma.user.findMany();
  const emails = new Set(users.map((u) => u.email));
  for (const email of [
    "imani@silverleaf.ac.tz",
    "loveness@silverleaf.ac.tz",
    "usa.admin@silverleaf.ac.tz",
    "parent@silverleaf.ac.tz",
  ]) {
    ok(`desk ${email}`, emails.has(email));
  }
  ok("no separate finance login", !emails.has("finance@silverleaf.ac.tz"));

  const orders = await prisma.parentOrder.findMany({ include: { lines: true, pays: true, issues: true } });
  for (const order of orders) {
    const total = order.lines.reduce((s, l) => s + l.qty * l.unitTzs, 0);
    const paid = order.pays.reduce((s, p) => s + p.amountTzs, 0);
    const issuedQty = order.lines.reduce((s, l) => s + l.issued, 0);
    if (issuedQty > 0) {
      ok(`${order.ref} issued only after full pay`, paid >= total, `paid ${paid} / ${total}`);
    }
    const lineIssued = order.lines.every((l) => l.issued <= l.qty);
    ok(`${order.ref} issued ≤ ordered`, lineIssued);
    if (order.status === "PAID") ok(`${order.ref} PAID is fully paid`, paid >= total);
    if (order.status === "ORDERED") ok(`${order.ref} ORDERED is not fully paid`, paid < total || total === 0);
  }

  const balances = await prisma.stockBalance.findMany();
  const moves = await prisma.stockMove.findMany();
  const moveSum = new Map();
  for (const m of moves) {
    const key = `${m.locationId}|${m.skuId}|${m.size}`;
    moveSum.set(key, (moveSum.get(key) ?? 0) + m.qty);
  }
  for (const row of balances) {
    const key = `${row.locationId}|${row.skuId}|${row.size}`;
    const fromMoves = moveSum.get(key) ?? 0;
    ok(`ledger ${row.id.slice(-6)} qty=${row.qty}`, row.qty === fromMoves, `moves ${fromMoves}`);
  }

  const recipes = await prisma.garmentRecipe.count();
  const fits = await prisma.sizeFit.count();
  ok("garment recipes seeded", recipes > 0, String(recipes));
  ok("size fits seeded", fits > 0, String(fits));

  const parent = users.find((u) => u.email === "parent@silverleaf.ac.tz");
  const mine = orders.filter((o) => o.placedById === parent?.id);
  ok("demo parent owns USA coupons only", mine.every((o) => o.ref === "ORD-1001" || o.ref === "ORD-1002") && mine.length === 2);
  const kids = await prisma.student.findMany({ where: { familyId: parent?.familyId ?? "none" } });
  ok("demo family has Amina + Baraka", kids.length === 2 && kids.every((k) => k.campusId === campuses.find((c) => c.code === "USA")?.id));

  const po2 = await prisma.purchaseOrder.findUnique({ where: { ref: "PO-2026-02" }, include: { expenses: true } });
  ok("PO-2026-02 expense attached", (po2?.expenses.length ?? 0) > 0);

  const reqUsa = await prisma.campusRequest.findUnique({ where: { ref: "REQ-USA-01" } });
  ok("REQ-USA-01 still open for Imani", reqUsa?.status === "OPEN");
} finally {
  await prisma.$disconnect();
}

if (failed) {
  console.error(`${failed} database check(s) failed`);
  process.exit(1);
}
console.log("Database smoke passed.");
