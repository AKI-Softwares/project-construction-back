import { z } from "zod";

export const createBuildingSchema = z.object({
  name: z.string().min(2).max(255),
  address: z.string().min(5).max(500),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const updateBuildingSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  address: z.string().min(5).max(500).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const buildingParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type UpdateBuildingInput = z.infer<typeof updateBuildingSchema>;
export type BuildingParams = z.infer<typeof buildingParamsSchema>;
