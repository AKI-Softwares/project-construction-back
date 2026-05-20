import { buildApp } from "./app.js";
import { env } from "../shared/config/env.js";

const app = await buildApp();

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

process.on("SIGINT", async () => {
  await app.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await app.close();
  process.exit(0);
});

start();
