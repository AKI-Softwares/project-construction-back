import { z } from "zod";

export const ncParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const photoParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  photoId: z.coerce.number().int().positive(),
});

export const addPhotoSchema = z.object({
  url: z.string().url().max(500),
});

export type NcParams = z.infer<typeof ncParamsSchema>;
export type PhotoParams = z.infer<typeof photoParamsSchema>;
export type AddPhotoInput = z.infer<typeof addPhotoSchema>;
