import { getDb } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
export const legalRoutes = async (app) => {
    // Lista todas as análises jurídicas do usuário
    app.get('/analyses', { preHandler: [authMiddleware] }, async (request) => {
        const userId = request.user.id;
        const db = getDb();
        if (!db) {
            return { analyses: [], total: 0 };
        }
        try {
            const query = request.query;
            const limit = parseInt(query.limit || '100');
            let sqlQuery = `
        SELECT 
          id,
          email_id as "emailId",
          document_name as "documentName",
          document_type as "documentType",
          parties,
          summary,
          key_dates as "keyDates",
          financial_terms as "financialTerms",
          critical_clauses as "criticalClauses",
          risks,
          suggestions,
          overall_risk as "overallRisk",
          requires_attention as "requiresAttention",
          analyzed_at as "analyzedAt",
          required_action as "requiredAction",
          action_description as "actionDescription",
          responsible_parties as "responsibleParties",
          action_deadline as "actionDeadline",
          is_urgent as "isUrgent",
          next_steps as "nextSteps",
          COALESCE(status, 'pending') as "status",
          resolved_at as "resolvedAt",
          resolved_by as "resolvedBy",
          resolution_notes as "resolutionNotes",
          thread_id as "threadId",
          group_id as "groupId"
        FROM legal_analyses
        WHERE user_id = '${userId}'
      `;
            if (query.riskLevel) {
                sqlQuery += ` AND overall_risk = '${query.riskLevel}'`;
            }
            if (query.status) {
                if (query.status === 'pending') {
                    sqlQuery += ` AND (status IS NULL OR status = 'pending' OR status = 'in_progress')`;
                }
                else {
                    sqlQuery += ` AND status = '${query.status}'`;
                }
            }
            sqlQuery += ` ORDER BY analyzed_at DESC LIMIT ${limit}`;
            const result = await db.execute(sql.raw(sqlQuery));
            const analyses = result;
            return {
                analyses: analyses || [],
                total: analyses?.length || 0,
            };
        }
        catch (error) {
            console.error('[LegalRoutes] Erro ao buscar análises:', error);
            return { analyses: [], total: 0 };
        }
    });
    // Estatísticas das análises do usuário
    app.get('/stats', { preHandler: [authMiddleware] }, async (request) => {
        const userId = request.user.id;
        const db = getDb();
        if (!db) {
            return { total: 0, byRisk: {}, byStatus: {}, requiresAttention: 0 };
        }
        try {
            const result = await db.execute(sql.raw(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN overall_risk = 'critical' THEN 1 END) as critical,
          COUNT(CASE WHEN overall_risk = 'high' THEN 1 END) as high,
          COUNT(CASE WHEN overall_risk = 'medium' THEN 1 END) as medium,
          COUNT(CASE WHEN overall_risk = 'low' THEN 1 END) as low,
          COUNT(CASE WHEN requires_attention = true THEN 1 END) as requires_attention,
          COUNT(CASE WHEN status IS NULL OR status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved
        FROM legal_analyses
        WHERE user_id = '${userId}'
      `));
            const stats = result[0] || {};
            return {
                total: parseInt(stats.total) || 0,
                byRisk: {
                    critical: parseInt(stats.critical) || 0,
                    high: parseInt(stats.high) || 0,
                    medium: parseInt(stats.medium) || 0,
                    low: parseInt(stats.low) || 0,
                },
                byStatus: {
                    pending: parseInt(stats.pending) || 0,
                    in_progress: parseInt(stats.in_progress) || 0,
                    resolved: parseInt(stats.resolved) || 0,
                },
                requiresAttention: parseInt(stats.requires_attention) || 0,
            };
        }
        catch (error) {
            console.error('[LegalRoutes] Erro ao buscar stats:', error);
            return { total: 0, byRisk: {}, byStatus: {}, requiresAttention: 0 };
        }
    });
    // Atualiza status de uma análise
    app.patch('/analyses/:id/status', { preHandler: [authMiddleware] }, async (request, reply) => {
        const userId = request.user.id;
        const db = getDb();
        if (!db) {
            return reply.status(500).send({ error: 'Banco não disponível' });
        }
        const { id } = request.params;
        const { status, notes } = request.body || {};
        if (!status || !['pending', 'in_progress', 'resolved'].includes(status)) {
            return reply
                .status(400)
                .send({ error: 'Status inválido. Use: pending, in_progress ou resolved' });
        }
        try {
            // Verifica se a análise pertence ao usuário
            const existing = await db.execute(sql.raw(`
        SELECT id FROM legal_analyses WHERE id = ${id} AND user_id = '${userId}'
      `));
            if (existing.length === 0) {
                return reply.status(404).send({ error: 'Análise não encontrada' });
            }
            const resolvedAt = status === 'resolved' ? new Date().toISOString() : null;
            await db.execute(sql.raw(`
        UPDATE legal_analyses 
        SET 
          status = '${status}',
          resolved_at = ${resolvedAt ? `'${resolvedAt}'` : 'NULL'},
          resolution_notes = ${notes ? `'${notes.replace(/'/g, "''")}'` : 'resolution_notes'}
        WHERE id = ${id} AND user_id = '${userId}'
      `));
            return {
                success: true,
                message: `Status atualizado para ${status}`,
                status,
            };
        }
        catch (error) {
            console.error('[LegalRoutes] Erro ao atualizar status:', error);
            return reply.status(500).send({ error: 'Erro ao atualizar status' });
        }
    });
    // Remove análises duplicadas do usuário
    app.delete('/duplicates', { preHandler: [authMiddleware] }, async (request, reply) => {
        const userId = request.user.id;
        const db = getDb();
        if (!db) {
            return reply.status(500).send({ error: 'Banco não disponível' });
        }
        try {
            // Conta antes
            const countBefore = await db.execute(sql.raw(`
        SELECT COUNT(*) as total FROM legal_analyses WHERE user_id = '${userId}'
      `));
            const totalBefore = parseInt(countBefore[0]?.total || '0');
            // Encontra IDs a manter
            const idsToKeep = await db.execute(sql.raw(`
        SELECT MAX(id) as id FROM legal_analyses WHERE user_id = '${userId}' GROUP BY document_name
      `));
            const keepIds = idsToKeep.map((r) => r.id);
            if (keepIds.length === 0) {
                return {
                    success: true,
                    message: 'Nenhuma análise encontrada',
                    removed: 0,
                };
            }
            // Deleta duplicatas
            await db.execute(sql.raw(`
        DELETE FROM legal_analyses 
        WHERE user_id = '${userId}' AND id NOT IN (${keepIds.join(',')})
      `));
            // Conta depois
            const countAfter = await db.execute(sql.raw(`
        SELECT COUNT(*) as total FROM legal_analyses WHERE user_id = '${userId}'
      `));
            const totalAfter = parseInt(countAfter[0]?.total || '0');
            const removed = totalBefore - totalAfter;
            return {
                success: true,
                message: removed > 0 ? `${removed} duplicata(s) removida(s)` : 'Nenhuma duplicata encontrada',
                removed,
                totalBefore,
                totalAfter,
            };
        }
        catch (error) {
            console.error('[LegalRoutes] Erro ao remover duplicatas:', error);
            return reply.status(500).send({ error: 'Erro ao remover duplicatas' });
        }
    });
    // Busca análises relacionadas por threadId
    app.get('/analyses/thread/:threadId', { preHandler: [authMiddleware] }, async (request, reply) => {
        const userId = request.user.id;
        const db = getDb();
        if (!db) {
            return reply.status(500).send({ error: 'Banco não disponível' });
        }
        try {
            const { threadId } = request.params;
            const result = await db.execute(sql.raw(`
          SELECT 
            id,
            email_id as "emailId",
            document_name as "documentName",
            document_type as "documentType",
            overall_risk as "overallRisk",
            COALESCE(status, 'pending') as "status",
            analyzed_at as "analyzedAt",
            summary
          FROM legal_analyses 
          WHERE thread_id = '${threadId}' AND user_id = '${userId}'
          ORDER BY analyzed_at DESC
        `));
            return {
                threadId,
                analyses: result,
                count: result.length,
            };
        }
        catch (error) {
            console.error('[LegalRoutes] Erro ao buscar análises por thread:', error);
            return reply.status(500).send({ error: 'Erro ao buscar análises relacionadas' });
        }
    });
    // Detalhes de uma análise específica
    app.get('/analyses/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
        const userId = request.user.id;
        const db = getDb();
        if (!db) {
            return reply.status(500).send({ error: 'Banco não disponível' });
        }
        try {
            const result = await db.execute(sql.raw(`
          SELECT * FROM legal_analyses WHERE id = ${request.params.id} AND user_id = '${userId}'
        `));
            const analysis = result[0];
            if (!analysis) {
                return reply.status(404).send({ error: 'Análise não encontrada' });
            }
            return { analysis };
        }
        catch (error) {
            console.error('[LegalRoutes] Erro ao buscar análise:', error);
            return reply.status(500).send({ error: 'Erro ao buscar análise' });
        }
    });
    // Migração para adicionar novos campos (só admin pode executar)
    app.post('/migrate-status', async (_request, reply) => {
        const db = getDb();
        if (!db) {
            return reply.status(500).send({ error: 'Banco não disponível' });
        }
        try {
            await db.execute(sql.raw(`
        ALTER TABLE legal_analyses 
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(255),
        ADD COLUMN IF NOT EXISTS resolution_notes TEXT,
        ADD COLUMN IF NOT EXISTS thread_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS group_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS user_id UUID
      `));
            console.log('[LegalRoutes] Migração de status concluída');
            return { success: true, message: 'Campos de status adicionados com sucesso' };
        }
        catch (error) {
            console.error('[LegalRoutes] Erro na migração:', error);
            return reply.status(500).send({ error: 'Erro na migração' });
        }
    });
};
//# sourceMappingURL=legal.js.map