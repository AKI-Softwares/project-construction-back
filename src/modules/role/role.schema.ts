import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().min(2).max(255),
  description: z.string().max(500).optional(),
  permissionIds: z.array(z.number().int().positive()).min(1),
});

export const updateRoleSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  description: z.string().max(500).nullable().optional(),
  permissionIds: z.array(z.number().int().positive()).optional(),
});

export const roleParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type RoleParams = z.infer<typeof roleParamsSchema>;
