import { z } from "zod";
import { TICKET_CATEGORIES, TICKET_IMPACTS } from "@/lib/ticket-constants";

export { TICKET_CATEGORIES, TICKET_IMPACTS };

export const createTicketSchema = z
  .object({
    issue: z.string().min(5).max(5000),
    submitterName: z.string().min(1).max(200).optional(),
    submitterEmail: z.string().email().optional(),
    submitterPhone: z.string().min(5).max(30).optional(),
    placeOfWork: z.string().min(1).max(200).optional(),
    departmentId: z.string().uuid().optional(),
    category: z.enum(TICKET_CATEGORIES).optional(),
    impact: z.enum(TICKET_IMPACTS).optional(),
    campus: z.string().min(1).max(200).optional(),
  })
  .strict()
  .refine((data) => Boolean(data.submitterEmail) || Boolean(data.submitterPhone), {
    message: "Provide an email or a phone number",
  });

// Staff-filed tickets (e.g. "Report a problem" from a tool's page) — no submitter
// email/phone requirement since the reporter is a logged-in staff member, not an
// anonymous public submitter who'd need it to look the ticket up later.
export const createInternalTicketSchema = z
  .object({
    issue: z.string().min(5).max(5000),
    submitterName: z.string().min(1).max(200).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    departmentId: z.string().uuid().optional(),
    toolId: z.string().uuid().optional(),
    category: z.enum(TICKET_CATEGORIES).optional(),
    impact: z.enum(TICKET_IMPACTS).optional(),
    campus: z.string().min(1).max(200).optional(),
    placeOfWork: z.string().min(1).max(200).optional(),
    dueAt: z.string().date().optional(),
  })
  .strict();

export const ticketLookupSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(5).max(30).optional(),
  })
  .strict()
  .refine((data) => Boolean(data.email) || Boolean(data.phone), {
    message: "Provide an email or a phone number",
  });

export const addSolutionSchema = z
  .object({
    body: z.string().min(1).max(5000),
    isSolution: z.boolean().optional(),
  })
  .strict();

export const assignTicketSchema = z
  .object({
    userId: z.string().uuid(),
  })
  .strict();

export const updateTicketPhaseSchema = z
  .object({
    phase: z.enum(["unassigned", "in_progress", "complete"]),
  })
  .strict();

export const updateTicketPrioritySchema = z
  .object({
    priority: z.enum(["low", "medium", "high", "urgent"]),
  })
  .strict();

export const createTicketNotifyRecipientSchema = z
  .object({
    email: z.string().email(),
    name: z.string().max(200).optional(),
  })
  .strict();

export const updateTicketDueSchema = z
  .object({
    dueAt: z.string().date().nullable(),
  })
  .strict();

export const updateTicketFieldsSchema = z
  .object({
    impact: z.enum(TICKET_IMPACTS).optional(),
    campus: z.string().max(200).nullable().optional(),
    internalNotes: z.string().max(8000).nullable().optional(),
  })
  .strict()
  .refine((data) => data.impact !== undefined || data.campus !== undefined || data.internalNotes !== undefined, {
    message: "Nothing to update",
  });

export const convertTicketSchema = z
  .object({
    systemId: z.string().uuid(),
    sprintId: z.string().uuid().optional(),
    phaseId: z.string().uuid().optional(),
  })
  .strict();

export const unassignTicketSchema = z
  .object({
    userId: z.string().uuid(),
  })
  .strict();

export const updateTicketNotifyRecipientSchema = z
  .object({
    email: z.string().email().optional(),
    name: z.string().max(200).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
