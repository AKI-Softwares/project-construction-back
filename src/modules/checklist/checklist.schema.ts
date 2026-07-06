import { z } from "zod";

export const checklistParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const checklistQuerySchema = z.object({
  apartmentId: z.coerce.number().int().positive().optional(),
});

export const updateChecklistSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  status: z.enum(["PENDING", "FINALIZED"]).optional(),
});

export const createVisitSchema = z.object({
  inspectorId: z.number().int().positive(),
});

export type ChecklistParams = z.infer<typeof checklistParamsSchema>;
export type ChecklistQuery = z.infer<typeof checklistQuerySchema>;
export type UpdateChecklistInput = z.infer<typeof updateChecklistSchema>;
export type CreateVisitInput = z.infer<typeof createVisitSchema>;

export const checklistItemParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  itemId: z.coerce.number().int().positive(),
});

export const resolveChecklistItemSchema = z.object({
  notes: z.string().min(1).optional(),
});

export type ChecklistItemParams = z.infer<typeof checklistItemParamsSchema>;
export type ResolveChecklistItemInput = z.infer<typeof resolveChecklistItemSchema>;
