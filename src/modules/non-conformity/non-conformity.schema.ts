import { z } from "zod";

export const listNcQuerySchema = z.object({
  buildingId: z.coerce.number().int().positive().optional(),
  inspectorId: z.coerce.number().int().positive().optional(),
  status: z.enum(["open", "resolved"]).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export type ListNcQuery = z.infer<typeof listNcQuerySchema>;

export const ncParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const photoParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  photoId: z.coerce.number().int().positive(),
});

export type NcParams = z.infer<typeof ncParamsSchema>;
export type PhotoParams = z.infer<typeof photoParamsSchema>;

export const createNcSchema = z.object({
  visitItemId: z.number().int().positive(),
  description: z.string().min(1),
});

export const patchNcSchema = z.object({
  description: z.string().min(1),
});

export type CreateNcInput = z.infer<typeof createNcSchema>;
export type PatchNcInput = z.infer<typeof patchNcSchema>;

export const confirmPhotoSchema = z.object({
  url: z.string().url(),
  publicId: z.string().min(1),
});

export type ConfirmPhotoInput = z.infer<typeof confirmPhotoSchema>;
