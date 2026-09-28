/**
 * 2026 Uniform Analysis / Master sheet formulas.
 * OVERALL + campus tabs: required = enrolment × pack, then order = required − remaining, cost = order × buy.
 * Summary: profit = sell − buy. Coupon vs distribution = entitled − handed over.
 */

export const PRIMARY_CLASSES = ["P1", "P2", "P3", "P4", "P5", "P6"] as const;

/** Day-uniform pack per child (Master parent-order / school-order sheet). */
export const SCHOOL_PACK: Record<string, number> = {
  PT1: 2,
  SS1: 1,
  RT2: 1,
  TS1: 1,
  GS1: 1,
  BT1: 1,
};

/** Boarding colourway pack. */
export const BOARDING_PACK: Record<string, number> = {
  BPT1: 2,
  BSS1: 1,
  BRT2: 1,
  BTS1: 1,
};

export function packQty(skuCode: string, kind: string) {
  if (kind === "BOARDING") return BOARDING_PACK[skuCode] ?? 0;
  return SCHOOL_PACK[skuCode] ?? 0;
}

export function requiredQty(heads: number, pack: number) {
  return Math.max(0, Math.round(heads * pack));
}

export function orderQty(required: number, remaining: number) {
  return Math.max(0, required - Math.max(0, remaining));
}

export function buyCost(qty: number, buyTzs: number) {
  return qty * buyTzs;
}

export function sellValue(qty: number, sellTzs: number) {
  return qty * sellTzs;
}

/** Summary tab: profit = sell − buy (integer TZS). */
export function profitTzs(qty: number, buyTzs: number, sellTzs: number) {
  return sellValue(qty, sellTzs) - buyCost(qty, buyTzs);
}

/** Coupon sheet vs distribution sheet. */
export function couponGap(couponQty: number, distributedQty: number) {
  return couponQty - distributedQty;
}

/** Sewed-uniform P&L: city-buy replacement vs jora + labour. */
export function sewingPnl(actual: number, buyTzs: number, materialTzs: number, labourTzs: number) {
  const replacementTzs = actual * buyTzs;
  const sewnCostTzs = materialTzs + labourTzs;
  return { replacementTzs, sewnCostTzs, savedTzs: replacementTzs - sewnCostTzs };
}

export function splitGender(heads: number) {
  const girls = Math.floor(heads / 2);
  return { GIRL: girls, BOY: heads - girls };
}

export type EnrolmentInput = {
  campusId: string;
  campusName: string;
  className: string;
  expectedHeadcount: number;
};

export function expandEnrolment(rows: EnrolmentInput[]): EnrolmentInput[] {
  const out: EnrolmentInput[] = [];
  for (const row of rows) {
    if (row.className !== "ALL") {
      out.push(row);
      continue;
    }
    const n = PRIMARY_CLASSES.length;
    const base = Math.floor(row.expectedHeadcount / n);
    let rem = row.expectedHeadcount % n;
    for (const className of PRIMARY_CLASSES) {
      out.push({
        ...row,
        className,
        expectedHeadcount: base + (rem > 0 ? 1 : 0),
      });
      if (rem > 0) rem -= 1;
    }
  }
  return out;
}

export type OverallRow = {
  campusId: string;
  campusName: string;
  skuId: string;
  skuCode: string;
  size: string;
  required: number;
  remaining: number;
  mainCover: number;
  orderQty: number;
  buyTzs: number;
  sellTzs: number;
  orderCostTzs: number;
  orderSellTzs: number;
  profitTzs: number;
  method: string;
};

/** Spread MAIN leftover across campus shortfalls (stable campus-name order). */
export function allocateMainCover(
  shortfalls: { campusId: string; campusName: string; shortfall: number }[],
  mainQty: number,
): Map<string, number> {
  const cover = new Map<string, number>();
  let left = Math.max(0, mainQty);
  const rows = [...shortfalls].sort((a, b) => a.campusName.localeCompare(b.campusName));
  for (const row of rows) {
    const take = Math.min(left, Math.max(0, row.shortfall));
    cover.set(row.campusId, take);
    left -= take;
  }
  return cover;
}

export function remainingBudgetTzs(allocatedTzs: number, receivedPoTzs: number, committedTzs: number) {
  return allocatedTzs - receivedPoTzs - committedTzs;
}

export function poMoney(
  pos: { status: string; lines: { qty: number; received: number; unitTzs: number }[] }[],
) {
  const committed = pos
    .filter((p) => ["SENT", "PARTIAL", "DRAFT"].includes(p.status))
    .reduce((s, p) => s + p.lines.reduce((a, l) => a + (l.qty - l.received) * l.unitTzs, 0), 0);
  const receivedPo = pos.reduce(
    (s, p) => s + p.lines.reduce((a, l) => a + l.received * l.unitTzs, 0),
    0,
  );
  return { committed, receivedPo };
}

export function planVsBudget(orderCostTzs: number, leftoverBudgetTzs: number) {
  const overByTzs = Math.max(0, orderCostTzs - leftoverBudgetTzs);
  return { remainingBudgetTzs: leftoverBudgetTzs, orderCostTzs, overByTzs, fits: overByTzs === 0 };
}

export function collapsePlanLines(rows: OverallRow[]) {
  const map = new Map<string, { skuId: string; skuCode: string; size: string; qty: number; unitTzs: number }>();
  for (const row of rows) {
    if (row.orderQty <= 0) continue;
    const key = `${row.skuId}|${row.size}`;
    const prev = map.get(key) ?? {
      skuId: row.skuId,
      skuCode: row.skuCode,
      size: row.size,
      qty: 0,
      unitTzs: row.buyTzs,
    };
    prev.qty += row.orderQty;
    map.set(key, prev);
  }
  return [...map.values()].sort((a, b) => a.skuCode.localeCompare(b.skuCode) || a.size.localeCompare(b.size));
}

export function buildOverallPlan(input: {
  enrolment: EnrolmentInput[];
  fits: { className: string; gender: string; skuId: string; size: string }[];
  skus: { id: string; code: string; kind: string; gender: string; buyTzs: number; sellTzs: number }[];
  onHand: { campusId: string | null; skuId: string; size: string; qty: number }[];
}): OverallRow[] {
  const enrolment = expandEnrolment(input.enrolment);
  const skuById = new Map(input.skus.map((s) => [s.id, s]));
  const fitOf = new Map(input.fits.map((f) => [`${f.className}|${f.gender}|${f.skuId}`, f.size]));

  type Need = { campusId: string; campusName: string; skuId: string; size: string; qty: number };
  const required = new Map<string, Need>();

  for (const row of enrolment) {
    const genders = splitGender(row.expectedHeadcount);
    for (const sku of input.skus) {
      const pack = packQty(sku.code, sku.kind);
      if (pack <= 0) continue;
      for (const gender of ["GIRL", "BOY"] as const) {
        if (sku.gender === "GIRL" && gender !== "GIRL") continue;
        if (sku.gender === "BOY" && gender !== "BOY") continue;
        const size = fitOf.get(`${row.className}|${gender}|${sku.id}`);
        if (!size) continue;
        const heads = genders[gender];
        const add = requiredQty(heads, pack);
        if (add <= 0) continue;
        const key = `${row.campusId}|${sku.id}|${size}`;
        const prev = required.get(key) ?? {
          campusId: row.campusId,
          campusName: row.campusName,
          skuId: sku.id,
          size,
          qty: 0,
        };
        prev.qty += add;
        required.set(key, prev);
      }
    }
  }

  const remainingAt = (campusId: string | null, skuId: string, size: string) =>
    input.onHand
      .filter((b) => b.skuId === skuId && b.size === size && b.campusId === campusId)
      .reduce((s, b) => s + b.qty, 0);

  const groups = new Map<string, Need[]>();
  for (const row of required.values()) {
    const key = `${row.skuId}|${row.size}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const rows: OverallRow[] = [];
  for (const group of groups.values()) {
    const sku = skuById.get(group[0].skuId);
    if (!sku) continue;
    const mainQty = remainingAt(null, sku.id, group[0].size);
    const shortfalls = group.map((row) => {
      const remaining = remainingAt(row.campusId, row.skuId, row.size);
      return {
        campusId: row.campusId,
        campusName: row.campusName,
        shortfall: orderQty(row.qty, remaining),
        remaining,
        required: row.qty,
      };
    });
    const cover = allocateMainCover(shortfalls, mainQty);
    for (const row of shortfalls) {
      const mainCover = cover.get(row.campusId) ?? 0;
      const buy = orderQty(row.shortfall, mainCover);
      rows.push({
        campusId: row.campusId,
        campusName: row.campusName,
        skuId: sku.id,
        skuCode: sku.code,
        size: group[0].size,
        required: row.required,
        remaining: row.remaining,
        mainCover,
        orderQty: buy,
        buyTzs: sku.buyTzs,
        sellTzs: sku.sellTzs,
        orderCostTzs: buyCost(buy, sku.buyTzs),
        orderSellTzs: sellValue(buy, sku.sellTzs),
        profitTzs: profitTzs(buy, sku.buyTzs, sku.sellTzs),
        method: "enrolment × pack − campus − MAIN",
      });
    }
  }

  return rows.sort(
    (a, b) => a.campusName.localeCompare(b.campusName) || a.skuCode.localeCompare(b.skuCode) || a.size.localeCompare(b.size),
  );
}

export function rollupOverall(rows: OverallRow[]) {
  return {
    required: rows.reduce((s, r) => s + r.required, 0),
    remaining: rows.reduce((s, r) => s + r.remaining, 0),
    mainCover: rows.reduce((s, r) => s + r.mainCover, 0),
    orderQty: rows.reduce((s, r) => s + r.orderQty, 0),
    orderCostTzs: rows.reduce((s, r) => s + r.orderCostTzs, 0),
    orderSellTzs: rows.reduce((s, r) => s + r.orderSellTzs, 0),
    profitTzs: rows.reduce((s, r) => s + r.profitTzs, 0),
  };
}
