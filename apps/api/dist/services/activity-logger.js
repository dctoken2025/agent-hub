/**
 * ActivityLogger - Sistema de logging detalhado para agentes
 *
 * Captura logs em tempo real e salva no banco para exibição na UI.
 */
import { getDb, agentActivityLogs } from '../db/index.js';
import { eq, desc, and, sql } from 'drizzle-orm';
// Buffer de logs para inserção em batch
const logBuffer = [];
let flushTimeout = null;
/**
 * Adiciona um log ao buffer e agenda flush.
 */
export function logActivity(entry) {
    logBuffer.push(entry);
    // Agenda flush se não houver um pendente
    if (!flushTimeout) {
        flushTimeout = setTimeout(flushLogs, 1000); // Flush a cada 1 segundo
    }
}
/**
 * Flush dos logs no buffer para o banco.
 */
async function flushLogs() {
    flushTimeout = null;
    if (logBuffer.length === 0)
        return;
    const db = getDb();
    if (!db)
        return;
    // Pega todos os logs do buffer
    const logsToInsert = [...logBuffer];
    logBuffer.length = 0;
    try {
        await db.insert(agentActivityLogs).values(logsToInsert);
    }
    catch (error) {
        console.error('[ActivityLogger] Erro ao salvar logs:', error);
    }
}
/**
 * Cria um logger para um agente específico.
 */
export function createAgentLogger(userId, agentId, agentName) {
    return {
        info: (message, emoji) => {
            console.log(`[${agentName}] ${emoji || 'ℹ️'} ${message}`);
            logActivity({ userId, agentId, agentName, level: 'info', emoji: emoji || 'ℹ️', message });
        },
        success: (message, emoji) => {
            console.log(`[${agentName}] ${emoji || '✅'} ${message}`);
            logActivity({ userId, agentId, agentName, level: 'success', emoji: emoji || '✅', message });
        },
        warning: (message, emoji) => {
            console.log(`[${agentName}] ${emoji || '⚠️'} ${message}`);
            logActivity({ userId, agentId, agentName, level: 'warning', emoji: emoji || '⚠️', message });
        },
        error: (message, emoji) => {
            console.error(`[${agentName}] ${emoji || '❌'} ${message}`);
            logActivity({ userId, agentId, agentName, level: 'error', emoji: emoji || '❌', message });
        },
        debug: (message, emoji) => {
            console.log(`[${agentName}] ${emoji || '🔍'} ${message}`);
            logActivity({ userId, agentId, agentName, level: 'debug', emoji: emoji || '🔍', message });
        },
        detail: (message, indent = 3) => {
            const prefix = ' '.repeat(indent);
            console.log(`[${agentName}] ${prefix}${message}`);
            logActivity({ userId, agentId, agentName, level: 'info', message: `${prefix}${message}` });
        },
    };
}
/**
 * Busca logs de atividade de um usuário.
 */
export async function getActivityLogs(userId, options) {
    const db = getDb();
    if (!db)
        return [];
    const limit = options?.limit || 100;
    try {
        // Monta condições de filtro
        const conditions = [eq(agentActivityLogs.userId, userId)];
        // Filtra por agentId se especificado (busca parcial para funcionar com sufixos como -userId)
        if (options?.agentId) {
            conditions.push(sql `${agentActivityLogs.agentId} LIKE ${`%${options.agentId}%`}`);
        }
        const results = await db
            .select()
            .from(agentActivityLogs)
            .where(and(...conditions))
            .orderBy(desc(agentActivityLogs.createdAt))
            .limit(limit);
        return results;
    }
    catch (error) {
        console.error('[ActivityLogger] Erro ao buscar logs:', error);
        return [];
    }
}
/**
 * Limpa logs antigos (mais de 24 horas).
 */
export async function cleanOldLogs() {
    const db = getDb();
    if (!db)
        return;
    try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        await db.execute(`DELETE FROM agent_activity_logs WHERE created_at < '${oneDayAgo.toISOString()}'`);
        console.log('[ActivityLogger] Logs antigos limpos');
    }
    catch (error) {
        console.error('[ActivityLogger] Erro ao limpar logs:', error);
    }
}
//# sourceMappingURL=activity-logger.js.map