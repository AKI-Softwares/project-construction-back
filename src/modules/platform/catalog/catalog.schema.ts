import { z } from 'zod';

export const catalogParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createServiceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
});

export const updateServiceSchema = createServiceSchema.partial();

export const createApartmentTypeSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
});

export const updateApartmentTypeSchema = createApartmentTypeSchema.partial();

export type CatalogParams            = z.infer<typeof catalogParamsSchema>;
export type CreateServiceInput       = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput       = z.infer<typeof updateServiceSchema>;
export type CreateApartmentTypeInput = z.infer<typeof createApartmentTypeSchema>;
export type UpdateApartmentTypeInput = z.infer<typeof updateApartmentTypeSchema>;
