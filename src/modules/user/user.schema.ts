import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  password: z.string().min(6),
  roleId: z.number().int().positive(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.email().optional(),
  password: z.string().min(6).optional(),
  roleId: z.number().int().positive().optional(),
});

export const userParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const userResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  roleId: z.number(),
  role: z.object({ id: z.number(), name: z.string() }),
  createdAt: z.date(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserParams = z.infer<typeof userParamsSchema>;

export const adminResetPasswordParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type AdminResetPasswordParams = z.infer<typeof adminResetPasswordParamsSchema>;
