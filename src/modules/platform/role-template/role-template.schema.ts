import { z } from 'zod';

export const templateParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createRoleTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  permissionIds: z.array(z.number().int().positive()).default([]),
});

export const updateRoleTemplateSchema = createRoleTemplateSchema.partial();

export type TemplateParams          = z.infer<typeof templateParamsSchema>;
export type CreateRoleTemplateInput = z.infer<typeof createRoleTemplateSchema>;
export type UpdateRoleTemplateInput = z.infer<typeof updateRoleTemplateSchema>;
