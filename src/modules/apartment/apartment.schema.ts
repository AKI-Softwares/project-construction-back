import { z } from "zod";

export const createApartmentSchema = z.object({
  buildingId: z.number().int().positive(),
  apartmentTypeId: z.number().int().positive(),
  identifier: z.string().min(1).max(50),
  floor: z.number().int().optional(),
  block: z.string().max(50).optional(),
});

export const updateApartmentSchema = z.object({
  identifier: z.string().min(1).max(50).optional(),
  floor: z.number().int().optional(),
  block: z.string().max(50).optional(),
});

export const updateApartmentRoomSchema = z.object({
  name: z.string().min(2).max(255),
});

export const addRoomServiceSchema = z.object({
  serviceId: z.number().int().positive(),
});

export const apartmentParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const apartmentRoomParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  roomId: z.coerce.number().int().positive(),
});

export const apartmentRoomServiceParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  roomId: z.coerce.number().int().positive(),
  serviceId: z.coerce.number().int().positive(),
});

export const apartmentQuerySchema = z.object({
  buildingId: z.coerce.number().int().positive().optional(),
});

export type CreateApartmentInput = z.infer<typeof createApartmentSchema>;
export type UpdateApartmentInput = z.infer<typeof updateApartmentSchema>;
export type UpdateApartmentRoomInput = z.infer<
  typeof updateApartmentRoomSchema
>;
export type AddRoomServiceInput = z.infer<typeof addRoomServiceSchema>;
export type ApartmentParams = z.infer<typeof apartmentParamsSchema>;
export type ApartmentRoomParams = z.infer<typeof apartmentRoomParamsSchema>;
export type ApartmentRoomServiceParams = z.infer<
  typeof apartmentRoomServiceParamsSchema
>;
export type ApartmentQuery = z.infer<typeof apartmentQuerySchema>;
