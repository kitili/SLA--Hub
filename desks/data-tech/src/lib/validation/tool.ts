import { z } from "zod";

const TOOL_CATEGORY_ICONS = ["phone", "tablet", "laptop", "desktop", "projector", "camera", "printer", "other"] as const;

export const createToolCategorySchema = z
  .object({
    name: z.string().min(1).max(200),
    icon: z.enum(TOOL_CATEGORY_ICONS).optional(),
    usefulLifeYears: z.number().int().min(1).max(50).optional(),
  })
  .strict();

export const updateToolCategorySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    icon: z.enum(TOOL_CATEGORY_ICONS).optional(),
    usefulLifeYears: z.number().int().min(1).max(50).nullable().optional(),
  })
  .strict();

export const createToolLocationSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
  })
  .strict();

export const createToolSchema = z
  .object({
    assetTag: z.string().min(1).max(100),
    name: z.string().min(1).max(200),
    categoryId: z.string().uuid(),
    brand: z.string().max(200).optional(),
    model: z.string().max(200).optional(),
    specifications: z.string().max(2000).optional(),
    serialNumber: z.string().max(200).optional(),
    purchaseDate: z.string().date().optional(),
    purchasePrice: z.coerce.number().nonnegative().max(100_000_000).optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export const updateToolSchema = z
  .object({
    locationId: z.string().uuid().nullable().optional(),
    status: z.enum(["available", "allocated", "in_repair", "retired"]).optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .strict();

function exactlyOneAllocationTarget(data: {
  allocatedToPersonName?: string;
  allocatedToDepartmentId?: string;
  allocatedToLocationId?: string;
}) {
  return (
    [data.allocatedToPersonName, data.allocatedToDepartmentId, data.allocatedToLocationId].filter(Boolean)
      .length === 1
  );
}

const ALLOCATION_TARGET_MESSAGE = {
  message: "Provide exactly one of allocatedToPersonName, allocatedToDepartmentId, or allocatedToLocationId",
};

export const allocateToolSchema = z
  .object({
    toolId: z.string().uuid(),
    allocatedToPersonName: z.string().trim().min(1).max(200).optional(),
    allocatedToDepartmentId: z.string().uuid().optional(),
    allocatedToLocationId: z.string().uuid().optional(),
    expectedReturnAt: z.string().datetime().optional(),
    purpose: z.string().max(500).optional(),
    notes: z.string().max(1000).optional(),
  })
  .strict()
  .refine(exactlyOneAllocationTarget, ALLOCATION_TARGET_MESSAGE);

export const bulkAllocateToolSchema = z
  .object({
    toolIds: z.array(z.string().uuid()).min(1).max(500),
    allocatedToPersonName: z.string().trim().min(1).max(200).optional(),
    allocatedToDepartmentId: z.string().uuid().optional(),
    allocatedToLocationId: z.string().uuid().optional(),
    expectedReturnAt: z.string().datetime().optional(),
    purpose: z.string().max(500).optional(),
    notes: z.string().max(1000).optional(),
  })
  .strict()
  .refine(exactlyOneAllocationTarget, ALLOCATION_TARGET_MESSAGE);

export const returnToolSchema = z
  .object({
    allocationId: z.string().uuid(),
  })
  .strict();

export const recordConditionSchema = z
  .object({
    condition: z.enum(["new", "good", "fair", "damaged", "faulty", "retired"]),
    note: z.string().max(1000).optional(),
  })
  .strict();

export const IMPORT_TOOL_COLUMNS = [
  "Asset Tag",
  "Name",
  "Category",
  "Brand",
  "Model",
  "Specifications",
  "Serial Number",
  "Purchase Date",
  "Purchase Price",
] as const;

export const importToolRowSchema = z.object({
  assetTag: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(200).optional(),
  model: z.string().trim().max(200).optional(),
  specifications: z.string().trim().max(2000).optional(),
  serialNumber: z.string().trim().max(200).optional(),
  purchaseDate: z.string().trim().max(30).optional(),
  purchasePrice: z.coerce.number().nonnegative().max(100_000_000).optional(),
});
