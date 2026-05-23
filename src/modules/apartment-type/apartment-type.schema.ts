import { z } from "zod";

export const createApartmentTypeSchema = z.object({
  name: z.string().min(2).max(255),
  description: z.string().max(500).optional(),
});

export const updateApartmentTypeSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  description: z.string().max(500).optional(),
});

export const apartmentTypeParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const roomParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  roomId: z.coerce.number().int().positive(),
});

export const createRoomSchema = z.object({
  name: z.string().min(2).max(255),
});

export type CreateApartmentTypeInput = z.infer<typeof createApartmentTypeSchema>;
export type UpdateApartmentTypeInput = z.infer<typeof updateApartmentTypeSchema>;
export type ApartmentTypeParams = z.infer<typeof apartmentTypeParamsSchema>;
export type RoomParams = z.infer<typeof roomParamsSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
