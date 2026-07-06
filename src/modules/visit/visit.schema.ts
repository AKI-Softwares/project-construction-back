import { z } from "zod";

export const visitParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const visitItemParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  itemId: z.coerce.number().int().positive(),
});

export const visitMineQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((val) =>
      val
        ? (val.split(",") as Array<"NOT_STARTED" | "ONGOING" | "FINALIZED">)
        : undefined,
    ),
});

export const visitListQuerySchema = z.object({
  buildingId: z.coerce.number().int().positive().optional(),
  inspectorId: z.coerce.number().int().positive().optional(),
  status: z.enum(["NOT_STARTED", "ONGOING", "FINALIZED"]).optional(),
  type: z.enum(["INITIAL", "REINSPECTION"]).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export type VisitListQuery = z.infer<typeof visitListQuerySchema>;

export const finalizeVisitSchema = z.object({
  status: z.literal("FINALIZED"),
  observations: z.string().min(1).optional(),
});

export const updateVisitItemSchema = z.object({
  status: z.enum(["OK", "NOK"]).nullable(),
});

export const addNonConformitySchema = z.object({
  description: z.string().min(1),
});

export const createReinspectionSchema = z.object({
  inspectorId: z.number().int().positive().optional(),
  scheduledFor: z.string().datetime({ offset: true }).optional(),
});

export const saveSignatureSchema = z.object({
  imageBase64: z.string().min(100),
});

export const assignInspectorSchema = z.object({
  inspectorId: z.number().int().positive(),
});

export type AssignInspectorInput = z.infer<typeof assignInspectorSchema>;

export type VisitParams = z.infer<typeof visitParamsSchema>;
export type VisitItemParams = z.infer<typeof visitItemParamsSchema>;
export type VisitMineQuery = z.infer<typeof visitMineQuerySchema>;
export type FinalizeVisitInput = z.infer<typeof finalizeVisitSchema>;
export type UpdateVisitItemInput = z.infer<typeof updateVisitItemSchema>;
export type AddNonConformityInput = z.infer<typeof addNonConformitySchema>;
export type CreateReinspectionInput = z.infer<typeof createReinspectionSchema>;
export type SaveSignatureInput = z.infer<typeof saveSignatureSchema>;
