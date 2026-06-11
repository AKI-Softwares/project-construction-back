import "@fastify/jwt";
import "fastify";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      companyId: number | null;
      isPlatformAdmin: boolean;
      isCompanyAdmin: boolean;
      roleId: number | null;
      permissions: string[];
      mustChangePassword: boolean;
    };
    user: {
      sub: string;
      companyId: number | null;
      isPlatformAdmin: boolean;
      isCompanyAdmin: boolean;
      roleId: number | null;
      permissions: string[];
      mustChangePassword: boolean;
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
