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
export {};
//# sourceMappingURL=server.d.ts.map