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
  roleId: z.number().int().positive().optional(),
});

export const userParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const savePushTokenSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(["android", "ios"]),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserParams = z.infer<typeof userParamsSchema>;
export type SavePushTokenInput = z.infer<typeof savePushTokenSchema>;

