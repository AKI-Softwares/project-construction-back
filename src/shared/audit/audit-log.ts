import { prisma } from "../infra/database/prisma.js";

interface AuditParams {
  companyId: number | null;
  userId: number;
  entityType: string;
  entityId: number;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string;
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.auditLog.create({
      data: {
        companyId: params.companyId,
        userId: params.userId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        before: params.before ?? null,
        after: params.after ?? null,
        ip: params.ip,
      } as any,
    });
  } catch (err) {
    // Audit failures must never break the main flow
    console.error("[AuditLog] Failed to write audit entry:", err);
  }
}
