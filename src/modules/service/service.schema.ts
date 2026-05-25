import { z } from "zod";

export const createServiceSchema = z.object({
  name: z.string().min(2).max(255),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
});

export const updateServiceSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
});

export const serviceParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const serviceQuerySchema = z.object({
  category: z.string().optional(),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type ServiceParams = z.infer<typeof serviceParamsSchema>;
export type ServiceQuery = z.infer<typeof serviceQuerySchema>;
