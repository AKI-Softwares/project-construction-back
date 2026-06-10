import { z } from 'zod';

export const companyParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createCompanySchema = z.object({
  name: z.string().min(2).max(255),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers and hyphens only.'),
});

export const updateCompanySchema = z.object({
  name: z.string().min(2).max(255).optional(),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/).optional(),
});

export const updateCompanyStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']),
});

export const listCompaniesQuerySchema = z.object({
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']).optional(),
});

export type CompanyParams            = z.infer<typeof companyParamsSchema>;
export type CreateCompanyInput       = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput       = z.infer<typeof updateCompanySchema>;
export type UpdateCompanyStatusInput = z.infer<typeof updateCompanyStatusSchema>;
export type ListCompaniesQuery       = z.infer<typeof listCompaniesQuerySchema>;
