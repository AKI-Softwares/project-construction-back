import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { env } from "../config/env.js";

export async function registerCors(app: FastifyInstance) {
  const allowList = env.CORS_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const origin =
    env.NODE_ENV === "production"
      ? allowList.length > 0
        ? allowList
        : false
      : true;

  await app.register(cors, {
    origin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-company-id"],
  });
}
