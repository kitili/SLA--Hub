import { z } from "zod";
import { MODULE_KEYS } from "@/lib/modules";

// Each module maps to "view" | "manage" | null (null explicitly clears any existing access).
// Ignored entirely when isAdmin is true, since admins bypass the module system.
const moduleAssignmentSchema = z
  .object(Object.fromEntries(MODULE_KEYS.map((key) => [key, z.enum(["view", "manage"]).nullable().optional()])))
  .strict();

export const createUserSchema = z
  .object({
    name: z.string().min(1).max(200),
    email: z.string().email(),
    isAdmin: z.boolean(),
    modules: moduleAssignmentSchema.optional(),
    departmentId: z.string().uuid().optional(),
  })
  .strict();

export const updateUserSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    isAdmin: z.boolean().optional(),
    modules: moduleAssignmentSchema.optional(),
    departmentId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const changeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(10).max(200),
  })
  .strict();

export const adminSetPasswordSchema = z
  .object({
    newPassword: z.string().min(10).max(200),
  })
  .strict();

export const createDepartmentSchema = z.object({ name: z.string().min(1).max(200) }).strict();

export const createSupportContactSchema = z
  .object({
    name: z.string().min(1).max(200),
    title: z.string().max(200).optional(),
    phone: z.string().max(50).optional(),
    email: z.string().email().optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .strict();

export const updateSupportContactSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    title: z.string().max(200).nullable().optional(),
    phone: z.string().max(50).nullable().optional(),
    email: z.string().email().nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
