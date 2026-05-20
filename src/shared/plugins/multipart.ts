import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function registerMultipart(app: FastifyInstance) {
  await app.register(multipart, {
    limits: {
      fileSize: MAX_FILE_SIZE,
    },
  });
}
