import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import { getBuses, getSchools } from "@/lib/db/queries";
import { getDrivers } from "@/lib/db/drivers";
import { listMaintenance } from "@/lib/db/maintenance";
import {
  commitMaintenanceImport,
  parseMaintenanceImport,
} from "@/lib/import/maintenance-import";
import { commitBusesImport, parseBusesImport } from "@/lib/import/buses-import";
import { commitDriversImport, parseDriversImport } from "@/lib/import/drivers-import";
import { listExpenses } from "@/lib/db/finance";
import { commitExpenseImport, parseExpenseImport } from "@/lib/import/expense-import";
import {
  listAllKitchenBudgetsForExport,
  listAllKitchenEquipmentForExport,
  listAllKitchenStaffMembersForExport,
  listAllKitchenSuppliesForExport,
  listKitchenIngredients,
  listKitchenMenuItems,
} from "@/lib/db/kitchen";
import {
  commitKitchenBudgetImport,
  parseKitchenBudgetImport,
} from "@/lib/import/kitchen-budget-import";
import {
  commitKitchenEquipmentImport,
  parseKitchenEquipmentImport,
} from "@/lib/import/kitchen-equipment-import";
import {
  commitKitchenIngredientsImport,
  parseKitchenIngredientsImport,
} from "@/lib/import/kitchen-ingredients-import";
import {
  commitKitchenMenuItemsImport,
  parseKitchenMenuItemsImport,
} from "@/lib/import/kitchen-menu-items-import";
import {
  commitKitchenStaffImport,
  parseKitchenStaffImport,
} from "@/lib/import/kitchen-staff-import";
import {
  commitKitchenSuppliesImport,
  parseKitchenSuppliesImport,
} from "@/lib/import/kitchen-supplies-import";

type Ctx = { params: Promise<{ entity: string }> };

const IMPORTABLE_ENTITIES = [
  "maintenance",
  "buses",
  "drivers",
  "expenses",
  "kitchen-ingredients",
  "kitchen-equipment",
  "kitchen-staff",
  "kitchen-supplies",
  "kitchen-menu-items",
  "kitchen-budgets",
] as const;
type ImportableEntity = (typeof IMPORTABLE_ENTITIES)[number];

function isImportableEntity(value: string): value is ImportableEntity {
  return (IMPORTABLE_ENTITIES as readonly string[]).includes(value);
}

// Same KITCHEN_ROLES set used by the export route and every Kitchen write
// route -- least privilege for bulk data movement, excludes cook/head_of_kitchens.
const KITCHEN_ROLES: Role[] = ["admin", "finance", "ops_manager", "finance_manager", "cfo"];

// Per-entity access instead of one blanket check -- see the matching map in
// src/app/api/admin/export/[entity]/route.ts for the same rationale.
const ENTITY_ROLES: Record<ImportableEntity, Role[]> = {
  maintenance: ["admin", "transport"],
  buses: ["admin", "transport"],
  drivers: ["admin", "transport"],
  expenses: ["admin", "transport", "finance"],
  "kitchen-ingredients": KITCHEN_ROLES,
  "kitchen-equipment": KITCHEN_ROLES,
  "kitchen-staff": KITCHEN_ROLES,
  "kitchen-supplies": KITCHEN_ROLES,
  "kitchen-menu-items": KITCHEN_ROLES,
  "kitchen-budgets": KITCHEN_ROLES,
};

/** POST /api/admin/import/:entity — roles vary per entity (see ENTITY_ROLES). Body: { csv, dryRun }. */
export async function POST(request: Request, context: Ctx) {
  const { entity } = await context.params;
  if (!isImportableEntity(entity)) {
    return NextResponse.json({ error: "Unknown import entity" }, { status: 400 });
  }

  const auth = await requireUser(ENTITY_ROLES[entity]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as { csv?: string; dryRun?: boolean };
  if (!body.csv?.trim()) {
    return NextResponse.json({ error: "csv is required" }, { status: 400 });
  }
  const csv = body.csv;
  const dryRun = body.dryRun !== false;

  switch (entity) {
    case "maintenance": {
      const [buses, existingRecords] = await Promise.all([getBuses(), listMaintenance()]);
      const preview = parseMaintenanceImport(csv, { buses, existingRecords });
      if (dryRun || preview.headerErrors.length > 0) {
        return NextResponse.json({ preview });
      }
      return NextResponse.json({ result: await commitMaintenanceImport(preview) });
    }
    case "buses": {
      const [schools, buses] = await Promise.all([getSchools(), getBuses()]);
      const preview = parseBusesImport(csv, { schools, buses });
      if (dryRun || preview.headerErrors.length > 0) {
        return NextResponse.json({ preview });
      }
      return NextResponse.json({ result: await commitBusesImport(preview) });
    }
    case "drivers": {
      const drivers = await getDrivers();
      const preview = parseDriversImport(csv, { drivers });
      if (dryRun || preview.headerErrors.length > 0) {
        return NextResponse.json({ preview });
      }
      return NextResponse.json({ result: await commitDriversImport(preview) });
    }
    case "kitchen-ingredients": {
      const ingredients = await listKitchenIngredients();
      const preview = parseKitchenIngredientsImport(csv, { ingredients });
      if (dryRun || preview.headerErrors.length > 0) {
        return NextResponse.json({ preview });
      }
      return NextResponse.json({ result: await commitKitchenIngredientsImport(preview) });
    }
    case "kitchen-equipment": {
      const [schools, equipment] = await Promise.all([
        getSchools(),
        listAllKitchenEquipmentForExport(),
      ]);
      const preview = parseKitchenEquipmentImport(csv, { schools, equipment });
      if (dryRun || preview.headerErrors.length > 0) {
        return NextResponse.json({ preview });
      }
      return NextResponse.json({ result: await commitKitchenEquipmentImport(preview) });
    }
    case "kitchen-staff": {
      const [schools, staff] = await Promise.all([
        getSchools(),
        listAllKitchenStaffMembersForExport(),
      ]);
      const preview = parseKitchenStaffImport(csv, { schools, staff });
      if (dryRun || preview.headerErrors.length > 0) {
        return NextResponse.json({ preview });
      }
      return NextResponse.json({ result: await commitKitchenStaffImport(preview) });
    }
    case "kitchen-supplies": {
      const supplies = await listAllKitchenSuppliesForExport();
      const preview = parseKitchenSuppliesImport(csv, { supplies });
      if (dryRun || preview.headerErrors.length > 0) {
        return NextResponse.json({ preview });
      }
      return NextResponse.json({ result: await commitKitchenSuppliesImport(preview) });
    }
    case "kitchen-menu-items": {
      const items = await listKitchenMenuItems();
      const preview = parseKitchenMenuItemsImport(csv, { items });
      if (dryRun || preview.headerErrors.length > 0) {
        return NextResponse.json({ preview });
      }
      return NextResponse.json({ result: await commitKitchenMenuItemsImport(preview) });
    }
    case "kitchen-budgets": {
      const [schools, budgets] = await Promise.all([
        getSchools(),
        listAllKitchenBudgetsForExport(),
      ]);
      const preview = parseKitchenBudgetImport(csv, { schools, budgets });
      if (dryRun || preview.headerErrors.length > 0) {
        return NextResponse.json({ preview });
      }
      return NextResponse.json({ result: await commitKitchenBudgetImport(preview) });
    }
    case "expenses": {
      const [schools, buses, existingExpenses] = await Promise.all([
        getSchools(),
        getBuses(),
        listExpenses(),
      ]);
      const preview = parseExpenseImport(csv, { schools, buses, existingExpenses });
      if (dryRun || preview.headerErrors.length > 0) {
        return NextResponse.json({ preview });
      }
      return NextResponse.json({ result: await commitExpenseImport(preview) });
    }
  }
}
