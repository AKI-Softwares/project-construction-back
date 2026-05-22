import "@fastify/jwt";
import "fastify";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      roleId: number;
      permissions: string[];
    };
    user: {
      sub: string;
      roleId: number;
      permissions: string[];
    };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: import("fastify").FastifyRequest,
      reply: import("fastify").FastifyReply,
    ) => Promise<void>;
  }
}
