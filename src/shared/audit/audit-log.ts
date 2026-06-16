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
    await prisma.auditLog.create({
      data: {
        companyId: params.companyId,
        userId: params.userId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        ...(params.before !== undefined && { before: params.before }),
        ...(params.after !== undefined && { after: params.after }),
        ip: params.ip,
      },
    });
  } catch (err) {
    // Audit failures must never break the main flow
    console.error("[AuditLog] Failed to write audit entry:", err);
  }
}
