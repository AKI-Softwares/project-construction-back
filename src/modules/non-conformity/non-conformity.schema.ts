import { z } from "zod";

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
