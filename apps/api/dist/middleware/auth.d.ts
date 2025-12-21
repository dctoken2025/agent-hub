import type { FastifyRequest, FastifyReply } from 'fastify';
export interface AuthUser {
    id: string;
    email: string;
    role: 'admin' | 'user';
}
declare module 'fastify' {
    interface FastifyRequest {
        user?: AuthUser;
    }
}
/**
 * Middleware de autenticação.
 * Valida o token JWT e adiciona o usuário ao request.
 */
export declare function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void>;
/**
 * Middleware que exige role de admin.
 * Deve ser usado após authMiddleware.
 */
export declare function adminMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void>;
/**
 * Middleware opcional de autenticação.
 * Se tiver token, valida. Se não tiver, continua sem user.
 * Útil para rotas que podem ser acessadas com ou sem auth.
 */
export declare function optionalAuthMiddleware(request: FastifyRequest, _reply: FastifyReply): Promise<void>;
/**
 * Gera um token JWT para o usuário.
 */
export declare function generateToken(user: {
    id: string;
    email: string;
    role: string;
}): string;
/**
 * Verifica um token JWT sem lançar erro.
 */
export declare function verifyToken(token: string): AuthUser | null;
//# sourceMappingURL=auth.d.ts.map