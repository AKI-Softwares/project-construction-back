import "dotenv/config";
declare module '@fastify/jwt' {
    interface FastifyJWT {
        user: {
            sub: string;
            role: string;
        };
    }
}
declare module 'fastify' {
    interface FastifyInstance {
        authenticate: any;
    }
}
//# sourceMappingURL=server.d.ts.map