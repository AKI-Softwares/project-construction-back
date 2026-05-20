import "dotenv/config";
import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../src/main/app.js";

const app = await buildApp();
await app.ready();

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  app.server.emit("request", req, res);
}
