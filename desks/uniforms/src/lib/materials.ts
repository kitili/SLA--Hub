export const MATERIAL_KINDS = ["JORA", "FABRIC", "SUPPLY"] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];

export function toCm(qty: number, unit: string): number {
  if (unit === "m") return qty * 100;
  if (unit === "cm") return qty;
  return qty;
}

export function fromCm(cm: number, unit: string): number {
  if (unit === "m") return cm / 100;
  return cm;
}

export function formatQty(qty: number, unit: string): string {
  if (qty === 0) return "—";
  if (unit === "cm") {
    const meters = qty / 100;
    return meters >= 1 ? `${trimNum(meters)} m` : `${qty} cm`;
  }
  return `${trimNum(qty)} ${unit}`;
}

function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

export type RecipeRow = {
  skuId: string;
  skuCode: string;
  skuName: string;
  garmentKind: string;
  size: string;
  materialKind: string;
  materialName: string;
  qtyPerPiece: number;
  unit: string;
};

export type BatchRow = {
  id: string;
  kind: string;
  description: string;
  qty: number;
  remaining: number;
  unit: string;
  unitCostTzs: number;
  sewingJobId: string | null;
};

export type JobNeed = {
  skuId: string;
  skuCode: string;
  skuName: string;
  garmentKind: string;
  size: string;
  pieces: number;
};

export type MaterialNeedRow = {
  key: string;
  materialKind: string;
  materialName: string;
  unit: string;
  bought: number;
  remaining: number;
  used: number;
  needForJobs: number;
  shortfall: number;
  garments: {
    skuCode: string;
    skuName: string;
    garmentKind: string;
    size: string;
    pieces: number;
    need: number;
    qtyPerPiece: number;
  }[];
};

export function planMaterials(
  recipes: RecipeRow[],
  batches: BatchRow[],
  jobs: JobNeed[],
): MaterialNeedRow[] {
  const rows = new Map<string, MaterialNeedRow>();

  function rowKey(kind: string, name: string) {
    return `${kind}|${name.toLowerCase()}`;
  }

  for (const batch of batches) {
    const key = rowKey(batch.kind, batch.description);
    const existing = rows.get(key);
    const length = batch.unit === "m" || batch.unit === "cm";
    const bought = length ? toCm(batch.qty, batch.unit) : batch.qty;
    const remaining = length ? toCm(batch.remaining, batch.unit) : batch.remaining;
    const unit = length ? "cm" : batch.unit;
    if (existing) {
      existing.bought += bought;
      existing.remaining += remaining;
      existing.used = existing.bought - existing.remaining;
    } else {
      rows.set(key, {
        key,
        materialKind: batch.kind,
        materialName: batch.description,
        unit,
        bought,
        remaining,
        used: bought - remaining,
        needForJobs: 0,
        shortfall: 0,
        garments: [],
      });
    }
  }

  for (const job of jobs) {
    const matches = recipes.filter((r) => r.skuId === job.skuId && r.size === job.size);
    for (const recipe of matches) {
      const key = rowKey(recipe.materialKind, recipe.materialName);
      const need = toCm(recipe.qtyPerPiece, recipe.unit) * job.pieces;
      const existing = rows.get(key) ?? {
        key,
        materialKind: recipe.materialKind,
        materialName: recipe.materialName,
        unit: "cm",
        bought: 0,
        remaining: 0,
        used: 0,
        needForJobs: 0,
        shortfall: 0,
        garments: [],
      };
      existing.needForJobs += need;
      existing.garments.push({
        skuCode: job.skuCode,
        skuName: job.skuName,
        garmentKind: job.garmentKind,
        size: job.size,
        pieces: job.pieces,
        need,
        qtyPerPiece: recipe.qtyPerPiece,
      });
      rows.set(key, existing);
    }
  }

  for (const row of rows.values()) {
    row.shortfall = Math.max(0, row.needForJobs - row.remaining);
  }

  return [...rows.values()].sort((a, b) => b.shortfall - a.shortfall || a.materialName.localeCompare(b.materialName));
}

export function recipeFor(recipes: RecipeRow[], skuId: string, size: string): RecipeRow[] {
  return recipes.filter((r) => r.skuId === skuId && r.size === size);
}

export type TopMaterialRow = { kind: string; description: string; unit: string; qty: number; costTzs: number };

// All-time totals across every batch ever bought — ranked by quantity, not
// recency, so a material bought heavily months ago still shows up here even
// if nothing's been bought since.
export function topMaterials(batches: BatchRow[], limit = 8): TopMaterialRow[] {
  const rows = new Map<string, TopMaterialRow>();
  for (const b of batches) {
    const key = `${b.kind}|${b.description}`;
    const row = rows.get(key) ?? { kind: b.kind, description: b.description, unit: b.unit, qty: 0, costTzs: 0 };
    row.qty += b.qty;
    row.costTzs += b.qty * b.unitCostTzs;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.qty - a.qty).slice(0, limit);
}
