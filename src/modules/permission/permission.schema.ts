import { z } from "zod";

export const permissionResponseSchema = z.array(
  z.object({
    resource: z.string(),
    permissions: z.array(
      z.object({
        id: z.number(),
        action: z.string(),
        operation: z.string(),
      }),
    ),
  }),
);

export type PermissionGroup = z.infer<typeof permissionResponseSchema>[number];
