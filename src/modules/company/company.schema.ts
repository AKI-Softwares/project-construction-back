import { z } from "zod";

export const updateMyCompanySchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

export type UpdateMyCompanyInput = z.infer<typeof updateMyCompanySchema>;
