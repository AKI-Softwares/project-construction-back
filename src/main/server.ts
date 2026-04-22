import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: z.url(),
    JWT_SECRET: z.string().min(8),
    PORT: z.coerce.number().default(3333),
});

const env = envSchema.parse(process.env);

const app = Fastify({
    logger: {
        level: env.NODE_ENV === "production" ? "info" : "debug",
        ...(env.NODE_ENV === "development" && {
            transport: { target: "pino-pretty", options: { translateTime: "HH:MM:ss Z", ignore: "pid,hostname" } }
        })
    }
});

await app.register(cors, {
    origin: true
});

await app.register(jwt, {
    secret: env.JWT_SECRET
});

await app.register(multipart, {
    limits: {
        fileSize: 10 * 1024 * 1024 //10MB
    }
});

app.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            await request.jwtVerify();
        } catch {
            return reply.status(401).send({ error: "Unauthorized" });
        }
    }
);

declare module '@fastify/jwt' {
    interface FastifyJWT {
        user: {
            sub: string;
            role: string;
        }
    }
}

declare module 'fastify' {
    interface FastifyInstance {
        authenticate: any;
    }
}

app.get('/health', async () => {
    return { status: "ok" };
});

app.get('/auth', {
    preHandler: [app.authenticate]
}, async (request) => {
    return { message: "Authenticated", user: request.user };
});

app.setErrorHandler((error, request, reply) => {
    app.log.error(error)

    if ((error as any).validation) {
        return reply.status(400).send({ 
            message: "Validation error",
            issues: (error as any).validation
        });
    }

    return reply.status(500).send({ 
        message: env.NODE_ENV === "production" ? "Internal server error" : (error as Error).message
     });
})

const start = async () => {
    try {
        await app.listen({ port: env.PORT });
    } catch (error) {
        app.log.error(error);
        process.exit(1);
    }
}

process.on("SIGINT", async () => {
    await app.close();
    process.exit(0);
})

process.on("SIGTERM", async () => {
    await app.close();
    process.exit(0);
})

start();