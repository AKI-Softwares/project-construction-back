import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import jwt from "@fastify/jwt";
import { env } from "../config/env.js";
import { prisma } from "../infra/database/prisma.js";

const companyStatusCache = new Map<
  number,
  { status: string; expiresAt: number }
>();

export async function registerJwt(app: FastifyInstance) {
  await app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  app.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      if (!request.user.isPlatformAdmin && request.user.companyId) {
        const companyId = request.user.companyId;
        const now = Date.now();
        const cached = companyStatusCache.get(companyId);

        let status: string;
        if (cached && cached.expiresAt > now) {
          status = cached.status;
        } else {
          const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: { status: true },
          });
          status = company?.status ?? "SUSPENDED";
          companyStatusCache.set(companyId, {
            status,
            expiresAt: now + 60_000,
          });
        }

        if (status !== "ACTIVE") {
          return reply
            .status(403)
            .send({ error: "Company account is inactive." });
        }
      }
    },
  );
}
