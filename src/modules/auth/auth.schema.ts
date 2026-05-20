import { z } from "zod";

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

export const tokenResponseSchema = z.object({
  token: z.string(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type TokenResponse = z.infer<typeof tokenResponseSchema>;
