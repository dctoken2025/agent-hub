import jwt from 'jsonwebtoken';
// Obtém o JWT_SECRET
function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET não configurado');
    }
    return secret;
}
/**
 * Middleware de autenticação.
 * Valida o token JWT e adiciona o usuário ao request.
 */
export async function authMiddleware(request, reply) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({
            error: 'Token não fornecido',
            code: 'NO_TOKEN'
        });
    }
    const token = authHeader.substring(7);
    try {
        const payload = jwt.verify(token, getJwtSecret());
        request.user = payload;
    }
    catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return reply.status(401).send({
                error: 'Token expirado',
                code: 'TOKEN_EXPIRED'
            });
        }
        return reply.status(401).send({
            error: 'Token inválido',
            code: 'INVALID_TOKEN'
        });
    }
}
/**
 * Middleware que exige role de admin.
 * Deve ser usado após authMiddleware.
 */
export async function adminMiddleware(request, reply) {
    if (!request.user) {
        return reply.status(401).send({
            error: 'Não autenticado',
            code: 'NOT_AUTHENTICATED'
        });
    }
    if (request.user.role !== 'admin') {
        return reply.status(403).send({
            error: 'Acesso negado. Requer permissão de administrador.',
            code: 'ADMIN_REQUIRED'
        });
    }
}
/**
 * Middleware opcional de autenticação.
 * Se tiver token, valida. Se não tiver, continua sem user.
 * Útil para rotas que podem ser acessadas com ou sem auth.
 */
export async function optionalAuthMiddleware(request, _reply) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return; // Continua sem user
    }
    const token = authHeader.substring(7);
    try {
        const payload = jwt.verify(token, getJwtSecret());
        request.user = payload;
    }
    catch {
        // Token inválido, mas continua sem user
    }
}
/**
 * Gera um token JWT para o usuário.
 */
export function generateToken(user) {
    const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
    };
    return jwt.sign(payload, getJwtSecret(), {
        expiresIn: '7d', // Token válido por 7 dias
    });
}
/**
 * Verifica um token JWT sem lançar erro.
 */
export function verifyToken(token) {
    try {
        return jwt.verify(token, getJwtSecret());
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=auth.js.map