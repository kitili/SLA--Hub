import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { OPENING_2026 } from "./opening-2026";

const prisma = new PrismaClient();
const PASSWORD = "Silverleaf@2026";
const SIZES_NUM = ["18", "20", "22", "24", "26", "28", "30", "32", "34", "36", "38"];
const SIZES_SM = ["S", "M", "18", "20", "22", "24", "26", "28", "30"];

type SkuSeed = {
  code: string;
  name: string;
  colour: string;
  kind: string;
  gender: string;
  buyTzs: number;
  sellTzs: number;
  sizes: string[];
};

const SKUS: SkuSeed[] = [
  { code: "SS1", name: "Navy sweater", colour: "Navy", kind: "SCHOOL", gender: "UNISEX", buyTzs: 18000, sellTzs: 25000, sizes: SIZES_NUM },
  { code: "PT1", name: "Light-blue polo", colour: "Light blue", kind: "SCHOOL", gender: "UNISEX", buyTzs: 11000, sellTzs: 15000, sizes: SIZES_NUM },
  { code: "RT2", name: "Yellow round-neck", colour: "Yellow", kind: "SCHOOL", gender: "UNISEX", buyTzs: 6000, sellTzs: 10000, sizes: SIZES_NUM },
  { code: "TS1", name: "Light-blue tracksuit", colour: "Light blue", kind: "SCHOOL", gender: "UNISEX", buyTzs: 22000, sellTzs: 30000, sizes: SIZES_SM },
  { code: "GS1", name: "Grey skirt / trouser", colour: "Grey", kind: "SCHOOL", gender: "GIRL", buyTzs: 20000, sellTzs: 30000, sizes: SIZES_NUM },
  { code: "BT1", name: "Grey trousers", colour: "Grey", kind: "SCHOOL", gender: "BOY", buyTzs: 20000, sellTzs: 30000, sizes: SIZES_NUM },
  { code: "BSS1", name: "Grey boarding sweater", colour: "Grey", kind: "BOARDING", gender: "UNISEX", buyTzs: 18000, sellTzs: 25000, sizes: SIZES_NUM },
  { code: "BPT1", name: "Red boarding polo", colour: "Red", kind: "BOARDING", gender: "UNISEX", buyTzs: 11000, sellTzs: 15000, sizes: SIZES_NUM },
  { code: "BRT2", name: "Black boarding round-neck", colour: "Black", kind: "BOARDING", gender: "UNISEX", buyTzs: 6000, sellTzs: 10000, sizes: SIZES_NUM },
  { code: "BTS1", name: "Black boarding tracksuit", colour: "Black", kind: "BOARDING", gender: "UNISEX", buyTzs: 22000, sellTzs: 30000, sizes: SIZES_SM },
];

const SUPPLIERS = [
  { name: "Arusha Textile House", phone: "0754 111 222", contact: "Mama Neema", city: "Arusha" },
  { name: "Usa River Tailors Supply", phone: "0754 333 444", contact: "Juma", city: "Usa River" },
  { name: "City Sportswear", phone: "0754 555 666", contact: "Asha", city: "Arusha" },
];

async function reset() {
  await prisma.auditEvent.deleteMany();
  await prisma.sizeForecast.deleteMany();
  await prisma.yearEndSnapshot.deleteMany();
  await prisma.campusEnrolment.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.sizeFit.deleteMany();
  await prisma.garmentRecipe.deleteMany();
  await prisma.materialBatch.deleteMany();
  await prisma.sewingJob.deleteMany();
  await prisma.purchaseOrderLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.distributionLine.deleteMany();
  await prisma.distribution.deleteMany();
  await prisma.campusRequestLine.deleteMany();
  await prisma.campusRequest.deleteMany();
  await prisma.parentIssue.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.parentOrderLine.deleteMany();
  await prisma.parentOrder.deleteMany();
  await prisma.student.deleteMany();
  await prisma.stockMove.deleteMany();
  await prisma.stockBalance.deleteMany();
  await prisma.skuSize.deleteMany();
  await prisma.sku.deleteMany();
  await prisma.user.deleteMany();
  await prisma.family.deleteMany();
  await prisma.location.deleteMany();
  await prisma.campus.deleteMany();
  await prisma.budget.deleteMany();
}

async function main() {
  await reset();
  const hash = await bcrypt.hash(PASSWORD, 10);

  const campuses = await Promise.all([
    prisma.campus.create({ data: { code: "USA", name: "Usa River", requestBy: "ADMIN" } }),
    prisma.campus.create({ data: { code: "AM", name: "Arusha Town (AM)", requestBy: "ADMIN" } }),
    prisma.campus.create({ data: { code: "KIJENGE", name: "Kijenge", requestBy: "HEAD_TEACHER" } }),
    prisma.campus.create({ data: { code: "ILBORU", name: "Ilboru", requestBy: "HEAD_TEACHER" } }),
    prisma.campus.create({ data: { code: "BOMA", name: "Boma", requestBy: "HEAD_TEACHER" } }),
  ]);
  const byCode = Object.fromEntries(campuses.map((c) => [c.code, c]));

  const mainWh = await prisma.location.create({
    data: { code: "MAIN", name: "Main warehouse", kind: "WAREHOUSE" },
  });
  const shop = await prisma.location.create({
    data: { code: "SHOP_USA", name: "Usa River shop", kind: "SHOP", campusId: byCode.USA.id },
  });
  const campusStores: Record<string, { id: string }> = {};
  for (const campus of campuses) {
    campusStores[campus.code] = await prisma.location.create({
      data: {
        code: `CAMPUS_${campus.code}`,
        name: `${campus.name} store`,
        kind: "CAMPUS",
        campusId: campus.id,
      },
    });
  }

  const users = {
    imani: await prisma.user.create({
      data: { email: "imani@silverleaf.ac.tz", passwordHash: hash, name: "Imani", role: "STORE" },
    }),
    loveness: await prisma.user.create({
      data: { email: "loveness@silverleaf.ac.tz", passwordHash: hash, name: "Loveness", role: "TAILOR", campusId: byCode.USA.id },
    }),
    ceo: await prisma.user.create({
      data: { email: "ceo@silverleaf.ac.tz", passwordHash: hash, name: "Leadership", role: "CEO" },
    }),
    schools: await prisma.user.create({
      data: { email: "schools@silverleaf.ac.tz", passwordHash: hash, name: "School admins", role: "ADMIN" },
    }),
    usaAdmin: await prisma.user.create({
      data: { email: "usa.admin@silverleaf.ac.tz", passwordHash: hash, name: "Usa River admin", role: "ADMIN", campusId: byCode.USA.id },
    }),
    amAdmin: await prisma.user.create({
      data: { email: "am.admin@silverleaf.ac.tz", passwordHash: hash, name: "Arusha Town admin", role: "ADMIN", campusId: byCode.AM.id },
    }),
    kijengeHt: await prisma.user.create({
      data: { email: "kijenge.ht@silverleaf.ac.tz", passwordHash: hash, name: "Kijenge HT", role: "HEAD_TEACHER", campusId: byCode.KIJENGE.id },
    }),
    bomaHt: await prisma.user.create({
      data: { email: "boma.ht@silverleaf.ac.tz", passwordHash: hash, name: "Boma HT", role: "HEAD_TEACHER", campusId: byCode.BOMA.id },
    }),
    ilboruHt: await prisma.user.create({
      data: { email: "ilboru.ht@silverleaf.ac.tz", passwordHash: hash, name: "Ilboru HT", role: "HEAD_TEACHER", campusId: byCode.ILBORU.id },
    }),
    parent: await prisma.user.create({
      data: { email: "parent@silverleaf.ac.tz", passwordHash: hash, name: "Demo parent", role: "PARENT", campusId: byCode.USA.id },
    }),
  };

  const skuRows = [];
  for (const sku of SKUS) {
    const row = await prisma.sku.create({
      data: {
        code: sku.code,
        name: sku.name,
        colour: sku.colour,
        kind: sku.kind,
        gender: sku.gender,
        buyTzs: sku.buyTzs,
        sellTzs: sku.sellTzs,
        reorder: 8,
        sizes: { create: sku.sizes.map((size) => ({ size })) },
      },
    });
    skuRows.push({ ...row, sizes: sku.sizes });
  }
  const skuByCode = Object.fromEntries(skuRows.map((s) => [s.code, s]));

  const locByCode: Record<string, { id: string }> = {
    MAIN: mainWh,
    SHOP_USA: shop,
    ...Object.fromEntries(Object.entries(campusStores).map(([code, loc]) => [`CAMPUS_${code}`, loc])),
  };
  for (const row of OPENING_2026) {
    const loc = locByCode[row.location];
    const sku = skuByCode[row.sku];
    if (!loc || !sku || !sku.sizes.includes(row.size)) continue;
    await prisma.stockBalance.create({
      data: { locationId: loc.id, skuId: sku.id, size: row.size, qty: row.qty },
    });
    await prisma.stockMove.create({
      data: {
        locationId: loc.id,
        skuId: sku.id,
        size: row.size,
        qty: row.qty,
        reason: "RECEIVE",
        ref: "OPENING-2026",
        note: "Leftover from 2026 STOCK / size sheet",
      },
    });
  }

  const students = await Promise.all([
    prisma.student.create({
      data: { regNo: "SLA/UR/2023/312", name: "Amina Juma", className: "P4", gender: "GIRL", campusId: byCode.USA.id },
    }),
    prisma.student.create({
      data: { regNo: "SLA/UR/2024/088", name: "Baraka Ally", className: "P2", gender: "BOY", campusId: byCode.USA.id },
    }),
    prisma.student.create({
      data: { regNo: "SLA/AM/2024/101", name: "Neema Paul", className: "P3", gender: "GIRL", campusId: byCode.AM.id },
    }),
    prisma.student.create({
      data: { regNo: "SLA/KJ/2024/055", name: "Daniel Mushi", className: "P5", gender: "BOY", campusId: byCode.KIJENGE.id },
    }),
    prisma.student.create({
      data: { regNo: "SLA/IL/2023/210", name: "Grace Mollel", className: "P6", gender: "GIRL", campusId: byCode.ILBORU.id },
    }),
    prisma.student.create({
      data: { regNo: "SLA/BM/2024/017", name: "Ibrahim Said", className: "P1", gender: "BOY", campusId: byCode.BOMA.id },
    }),
  ]);

  const family = await prisma.family.create({ data: { phone: "0754 111 000" } });
  await prisma.user.update({
    where: { id: users.parent.id },
    data: { familyId: family.id, name: "Amina & Baraka's family", phone: "0754 111 000" },
  });
  await prisma.student.update({ where: { id: students[0].id }, data: { familyId: family.id } });
  await prisma.student.update({ where: { id: students[1].id }, data: { familyId: family.id } });

  const older = new Date("2026-01-12T08:00:00.000Z");
  const mid = new Date("2026-01-15T09:30:00.000Z");
  const newer = new Date("2026-01-20T11:00:00.000Z");

  const paidOrder = await prisma.parentOrder.create({
    data: {
      ref: "ORD-1001",
      campusId: byCode.USA.id,
      studentId: students[0].id,
      studentName: students[0].name,
      className: students[0].className,
      gender: students[0].gender,
      regNo: students[0].regNo,
      kind: "SCHOOL",
      status: "PAID",
      placedById: users.parent.id,
      orderedAt: older,
      paidAt: new Date("2026-01-14T10:00:00.000Z"),
      readyAt: new Date("2026-01-21T08:00:00.000Z"),
      lines: {
        create: [
          { skuId: skuByCode.PT1.id, size: "24", qty: 2, unitTzs: 15000, issued: 0 },
          { skuId: skuByCode.SS1.id, size: "24", qty: 1, unitTzs: 25000, issued: 0 },
        ],
      },
      pays: {
        create: {
          amountTzs: 55000,
          channel: "LIPA",
          ref: "LIPA-1001",
          receivedOn: new Date("2026-01-14T10:00:00.000Z"),
          cashierId: users.usaAdmin.id,
        },
      },
    },
  });

  await prisma.parentOrder.create({
    data: {
      ref: "ORD-1002",
      campusId: byCode.USA.id,
      studentId: students[1].id,
      studentName: students[1].name,
      className: students[1].className,
      gender: students[1].gender,
      regNo: students[1].regNo,
      kind: "SCHOOL",
      status: "ORDERED",
      placedById: users.parent.id,
      orderedAt: mid,
      lines: {
        create: [{ skuId: skuByCode.BT1.id, size: "22", qty: 1, unitTzs: 30000 }],
      },
    },
  });

  await prisma.parentOrder.create({
    data: {
      ref: "ORD-1003",
      campusId: byCode.KIJENGE.id,
      studentId: students[3].id,
      studentName: students[3].name,
      className: students[3].className,
      gender: students[3].gender,
      regNo: students[3].regNo,
      kind: "SCHOOL",
      status: "PARTIAL",
      orderedAt: newer,
      paidAt: new Date("2026-01-21T08:00:00.000Z"),
      lines: {
        create: [{ skuId: skuByCode.PT1.id, size: "26", qty: 2, unitTzs: 15000, issued: 1 }],
      },
      pays: {
        create: {
          amountTzs: 30000,
          channel: "CASH",
          ref: "CASH-1003",
          cashierId: users.imani.id,
        },
      },
      issues: {
        create: {
          skuId: skuByCode.PT1.id,
          size: "26",
          qty: 1,
          locationId: campusStores.KIJENGE.id,
        },
      },
    },
  });

  await prisma.stockBalance.update({
    where: {
      locationId_skuId_size: {
        locationId: campusStores.KIJENGE.id,
        skuId: skuByCode.PT1.id,
        size: "26",
      },
    },
    data: { qty: { decrement: 1 } },
  });
  await prisma.stockMove.create({
    data: {
      locationId: campusStores.KIJENGE.id,
      skuId: skuByCode.PT1.id,
      size: "26",
      qty: -1,
      reason: "PARENT_ISSUE",
      ref: "ISS-1003",
      note: "ORD-1003 · Imani",
    },
  });

  const reqUsa = await prisma.campusRequest.create({
    data: {
      ref: "REQ-USA-01",
      campusId: byCode.USA.id,
      requesterId: users.usaAdmin.id,
      status: "OPEN",
      neededBy: "2026-02-01",
      lines: {
        create: [
          { skuId: skuByCode.PT1.id, size: "24", qty: 10 },
          { skuId: skuByCode.SS1.id, size: "26", qty: 6 },
        ],
      },
    },
  });

  await prisma.campusRequest.create({
    data: {
      ref: "REQ-KJ-01",
      campusId: byCode.KIJENGE.id,
      requesterId: users.kijengeHt.id,
      status: "OPEN",
      neededBy: "2026-02-05",
      lines: { create: [{ skuId: skuByCode.BT1.id, size: "28", qty: 8 }] },
    },
  });

  await prisma.distribution.create({
    data: {
      ref: "DN-0001",
      fromId: mainWh.id,
      toCampusId: byCode.USA.id,
      issuerId: users.imani.id,
      receiver: "Usa River admin",
      lines: { create: [{ skuId: skuByCode.PT1.id, size: "24", qty: 4 }] },
    },
  });
  await prisma.stockBalance.update({
    where: { locationId_skuId_size: { locationId: mainWh.id, skuId: skuByCode.PT1.id, size: "24" } },
    data: { qty: { decrement: 4 } },
  });
  await prisma.stockBalance.update({
    where: { locationId_skuId_size: { locationId: campusStores.USA.id, skuId: skuByCode.PT1.id, size: "24" } },
    data: { qty: { increment: 4 } },
  });
  await prisma.stockMove.create({
    data: {
      locationId: mainWh.id,
      skuId: skuByCode.PT1.id,
      size: "24",
      qty: -4,
      reason: "DISTRIBUTE",
      ref: "DN-0001",
      note: "to campus · Usa River admin",
    },
  });
  await prisma.stockMove.create({
    data: {
      locationId: campusStores.USA.id,
      skuId: skuByCode.PT1.id,
      size: "24",
      qty: 4,
      reason: "DISTRIBUTE",
      ref: "DN-0001",
      note: "incoming DN",
    },
  });

  for (const s of SUPPLIERS) {
    await prisma.supplier.create({ data: s });
  }
  const supplier = await prisma.supplier.findFirstOrThrow({ where: { name: "City Sportswear" } });

  const po = await prisma.purchaseOrder.create({
    data: {
      ref: "PO-2026-01",
      supplierId: supplier.id,
      raisedById: users.imani.id,
      status: "SENT",
      lines: {
        create: [
          { skuId: skuByCode.TS1.id, size: "26", qty: 40, unitTzs: 22000, received: 0 },
          { skuId: skuByCode.PT1.id, size: "28", qty: 50, unitTzs: 10000, received: 0 },
        ],
      },
    },
  });

  const po2 = await prisma.purchaseOrder.create({
    data: {
      ref: "PO-2026-02",
      supplierId: supplier.id,
      raisedById: users.imani.id,
      status: "PARTIAL",
      lines: {
        create: [{ skuId: skuByCode.SS1.id, size: "30", qty: 20, unitTzs: 18000, received: 8 }],
      },
    },
  });
  await prisma.stockBalance.update({
    where: { locationId_skuId_size: { locationId: mainWh.id, skuId: skuByCode.SS1.id, size: "30" } },
    data: { qty: { increment: 8 } },
  });
  await prisma.stockMove.create({
    data: {
      locationId: mainWh.id,
      skuId: skuByCode.SS1.id,
      size: "30",
      qty: 8,
      reason: "RECEIVE",
      ref: "PO-2026-02",
      note: "Partial receive into MAIN",
    },
  });

  await prisma.budget.create({
    data: { name: "Uniform buying 2026", year: 2026, allocatedTzs: 50_000_000 },
  });

  const job = await prisma.sewingJob.create({
    data: {
      tailorId: users.loveness.id,
      skuId: skuByCode.PT1.id,
      size: "24",
      expected: 20,
      actual: 0,
      status: "IN_PROGRESS",
      note: "Day-school polos",
      location: "MAIN",
    },
  });
  await prisma.materialBatch.create({
    data: {
      kind: "FABRIC",
      description: "Light-blue polo fabric",
      qty: 4000,
      remaining: 4000,
      unit: "cm",
      unitCostTzs: 35,
      sewingJobId: job.id,
    },
  });
  await prisma.materialBatch.create({
    data: {
      kind: "JORA",
      description: "Navy sweater jora",
      qty: 2500,
      remaining: 1800,
      unit: "cm",
      unitCostTzs: 42,
      },
  });
  await prisma.materialBatch.create({
    data: {
      kind: "FABRIC",
      description: "Grey trouser cloth",
      qty: 3000,
      remaining: 3000,
      unit: "cm",
      unitCostTzs: 28,
    },
  });
  await prisma.materialBatch.create({
    data: {
      kind: "SUPPLY",
      description: "Buttons and thread pack",
      qty: 50,
      remaining: 44,
      unit: "pcs",
      unitCostTzs: 400,
    },
  });

  await seedRecipesAndFits(skuRows);
  await prisma.expense.create({
    data: {
      kind: "MATERIAL",
      amountTzs: 140000,
      note: "Polo fabric 40 m for job",
      sewingJobId: job.id,
    },
  });

  const doneJob = await prisma.sewingJob.create({
    data: {
      tailorId: users.loveness.id,
      skuId: skuByCode.SS1.id,
      size: "26",
      expected: 12,
      actual: 12,
      status: "DONE",
      note: "Completed sample",
      location: "MAIN",
    },
  });
  await prisma.expense.create({
    data: {
      kind: "LABOUR",
      amountTzs: 36000,
      note: "Loveness — 12 sweaters",
      sewingJobId: doneJob.id,
    },
  });
  await prisma.stockBalance.update({
    where: { locationId_skuId_size: { locationId: mainWh.id, skuId: skuByCode.SS1.id, size: "26" } },
    data: { qty: { increment: 12 } },
  });
  await prisma.stockMove.create({
    data: {
      locationId: mainWh.id,
      skuId: skuByCode.SS1.id,
      size: "26",
      qty: 12,
      reason: "SEW_IN",
      ref: "SEW-SAMPLE",
      note: "Loveness completed job",
    },
  });

  const classes = ["P1", "P2", "P3", "P4", "P5", "P6"];
  for (const campus of campuses) {
    const total = campus.code === "USA" ? 180 : 90;
    const base = Math.floor(total / classes.length);
    let rem = total % classes.length;
    for (const className of classes) {
      await prisma.campusEnrolment.create({
        data: {
          campusId: campus.id,
          year: 2027,
          className,
          expectedHeadcount: base + (rem > 0 ? 1 : 0),
        },
      });
      if (rem > 0) rem -= 1;
    }
  }

  await prisma.expense.create({
    data: {
      kind: "SUPPLIER",
      amountTzs: 144000,
      note: "Partial sweater receive on PO-2026-02",
      poId: po2.id,
    },
  });

  console.log("Seeded Silverleaf Uniform Tracker demo data.");
  console.log("Password for every desk:", PASSWORD);
  console.log("Paid sample order:", paidOrder.ref);
}

function cmForSize(base: number, size: string): number {
  const n = Number.parseInt(size, 10);
  if (Number.isFinite(n)) return base + Math.max(0, n - 18) * 4;
  if (size === "S") return base + 8;
  if (size === "M") return base + 16;
  return base + 12;
}

async function seedRecipesAndFits(skuRows: { id: string; code: string; sizes: string[] }[]) {
  const fabric: Record<string, { kind: string; name: string; baseCm: number }> = {
    SS1: { kind: "JORA", name: "Navy sweater jora", baseCm: 95 },
    PT1: { kind: "FABRIC", name: "Light-blue polo fabric", baseCm: 110 },
    RT2: { kind: "FABRIC", name: "Yellow jersey cloth", baseCm: 90 },
    TS1: { kind: "FABRIC", name: "Light-blue tracksuit cloth", baseCm: 180 },
    GS1: { kind: "FABRIC", name: "Grey trouser cloth", baseCm: 120 },
    BT1: { kind: "FABRIC", name: "Grey trouser cloth", baseCm: 125 },
    BSS1: { kind: "JORA", name: "Grey boarding jora", baseCm: 95 },
    BPT1: { kind: "FABRIC", name: "Red boarding polo fabric", baseCm: 110 },
    BRT2: { kind: "FABRIC", name: "Black jersey cloth", baseCm: 90 },
    BTS1: { kind: "FABRIC", name: "Black tracksuit cloth", baseCm: 180 },
  };

  for (const sku of skuRows) {
    const recipe = fabric[sku.code];
    if (!recipe) continue;
    for (const size of sku.sizes) {
      await prisma.garmentRecipe.create({
        data: {
          skuId: sku.id,
          size,
          materialKind: recipe.kind,
          materialName: recipe.name,
          qtyPerPiece: cmForSize(recipe.baseCm, size),
          unit: "cm",
        },
      });
    }
  }

  const classSizes: [string, string][] = [
    ["P1", "18"],
    ["P2", "20"],
    ["P3", "22"],
    ["P4", "24"],
    ["P5", "26"],
    ["P6", "28"],
    ["P7", "30"],
  ];
  const notes: Record<string, string> = {
    "18": "Smallest junior — chest about 56–60 cm",
    "20": "P2 typical — chest about 60–64 cm",
    "22": "P3 typical — chest about 64–68 cm",
    "24": "P4 typical — chest about 68–72 cm",
    "26": "P5 typical — chest about 72–76 cm",
    "28": "P6 typical — chest about 76–80 cm",
    "30": "P7 / older — chest about 80–84 cm",
  };

  for (const [className, size] of classSizes) {
    for (const sku of skuRows) {
      const genders = sku.code === "GS1" ? ["GIRL"] : sku.code === "BT1" ? ["BOY"] : ["GIRL", "BOY"];
      for (const gender of genders) {
        const available = sku.sizes.includes(size) ? size : sku.sizes.includes("S") && size <= "22" ? "S" : sku.sizes.includes("M") ? "M" : sku.sizes[0];
        await prisma.sizeFit.create({
          data: {
            className,
            gender,
            skuId: sku.id,
            size: available,
            note: notes[size] ?? "",
          },
        });
      }
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
