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

export const registerCompanySchema = z.object({
  company: z.object({
    name: z.string().min(2).max(255),
    slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers and hyphens only.'),
  }),
  admin: z.object({
    name: z.string().min(2).max(255),
    email: z.email(),
    password: z.string().min(8),
  }),
});

export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;

export const forgotPasswordSchema = z.object({
  email: z.email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
