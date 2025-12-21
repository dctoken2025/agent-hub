import { getDb } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
export const financialRoutes = async (app) => {
    // Lista todos os itens financeiros do usuário
    app.get('/items', { preHandler: [authMiddleware] }, async (request) => {
        const userId = request.user.id;
        const db = getDb();
        if (!db) {
            return { items: [], total: 0 };
        }
        try {
            const query = request.query;
            const limit = parseInt(query.limit || '100');
            let sqlQuery = `
        SELECT 
          id,
          email_id as "emailId",
          thread_id as "threadId",
          email_subject as "emailSubject",
          email_from as "emailFrom",
          email_date as "emailDate",
          type,
          status,
          amount,
          currency,
          due_date as "dueDate",
          issue_date as "issueDate",
          competence_date as "competenceDate",
          paid_at as "paidAt",
          creditor,
          creditor_type as "creditorType",
          creditor_document as "creditorDocument",
          description,
          category,
          reference,
          installment_current as "installmentCurrent",
          installment_total as "installmentTotal",
          barcode_data as "barcodeData",
          barcode_type as "barcodeType",
          bank_code as "bankCode",
          pix_key as "pixKey",
          pix_key_type as "pixKeyType",
          bank_account as "bankAccount",
          recurrence,
          attachment_id as "attachmentId",
          attachment_filename as "attachmentFilename",
          priority,
          notes,
          related_project as "relatedProject",
          requires_approval as "requiresApproval",
          approved_by as "approvedBy",
          approved_at as "approvedAt",
          confidence,
          analyzed_at as "analyzedAt",
          created_at as "createdAt"
        FROM financial_items
        WHERE user_id = '${userId}'
      `;
            if (query.status) {
                sqlQuery += ` AND status = '${query.status}'`;
            }
            if (query.type) {
                sqlQuery += ` AND type = '${query.type}'`;
            }
            if (query.category) {
                sqlQuery += ` AND category = '${query.category}'`;
            }
            if (query.priority) {
                sqlQuery += ` AND priority = '${query.priority}'`;
            }
            if (query.startDate) {
                sqlQuery += ` AND due_date >= '${query.startDate}'`;
            }
            if (query.endDate) {
                sqlQuery += ` AND due_date <= '${query.endDate}'`;
            }
            sqlQuery += ` ORDER BY due_date ASC NULLS LAST, created_at DESC LIMIT ${limit}`;
            const result = await db.execute(sql.raw(sqlQuery));
            const items = result;
            return {
                items: items || [],
                total: items?.length || 0,
            };
        }
        catch (error) {
            console.error('[FinancialRoutes] Erro ao buscar itens:', error);
            return { items: [], total: 0 };
        }
    });
    // Estatísticas financeiras do usuário
    app.get('/stats', { preHandler: [authMiddleware] }, async (request) => {
        const userId = request.user.id;
        const db = getDb();
        if (!db) {
            return {
                total: 0,
                pending: 0,
                overdue: 0,
                paid: 0,
                totalAmount: 0,
                pendingAmount: 0,
                overdueAmount: 0,
                byCategory: {},
                byCreditorType: {},
            };
        }
        try {
            // Stats gerais
            const result = await db.execute(sql.raw(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid,
          COALESCE(SUM(amount), 0) as total_amount,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_amount,
          COALESCE(SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END), 0) as overdue_amount,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid_amount
        FROM financial_items
        WHERE user_id = '${userId}'
      `));
            const stats = result[0] || {};
            // Por categoria
            const categoryResult = await db.execute(sql.raw(`
        SELECT 
          category,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as amount
        FROM financial_items
        WHERE user_id = '${userId}' AND category IS NOT NULL
        GROUP BY category
        ORDER BY amount DESC
      `));
            const byCategory = {};
            categoryResult.forEach((row) => {
                byCategory[row.category] = {
                    count: parseInt(row.count),
                    amount: parseInt(row.amount)
                };
            });
            // Por tipo de credor
            const creditorResult = await db.execute(sql.raw(`
        SELECT 
          creditor_type as "creditorType",
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as amount
        FROM financial_items
        WHERE user_id = '${userId}' AND creditor_type IS NOT NULL
        GROUP BY creditor_type
        ORDER BY amount DESC
      `));
            const byCreditorType = {};
            creditorResult.forEach((row) => {
                byCreditorType[row.creditorType] = {
                    count: parseInt(row.count),
                    amount: parseInt(row.amount)
                };
            });
            // Próximos vencimentos (7 dias)
            const upcomingResult = await db.execute(sql.raw(`
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as amount
        FROM financial_items
        WHERE user_id = '${userId}' 
          AND status = 'pending'
          AND due_date IS NOT NULL 
          AND due_date <= NOW() + INTERVAL '7 days'
          AND due_date >= NOW()
      `));
            const upcoming = upcomingResult[0] || { count: 0, amount: 0 };
            return {
                total: parseInt(stats.total) || 0,
                pending: parseInt(stats.pending) || 0,
                overdue: parseInt(stats.overdue) || 0,
                paid: parseInt(stats.paid) || 0,
                totalAmount: parseInt(stats.total_amount) || 0,
                pendingAmount: parseInt(stats.pending_amount) || 0,
                overdueAmount: parseInt(stats.overdue_amount) || 0,
                paidAmount: parseInt(stats.paid_amount) || 0,
                byCategory,
                byCreditorType,
                upcoming: {
                    count: parseInt(upcoming.count) || 0,
                    amount: parseInt(upcoming.amount) || 0,
                },
            };
        }
        catch (error) {
            console.error('[FinancialRoutes] Erro ao buscar stats:', error);
            return {
                total: 0,
                pending: 0,
                overdue: 0,
                paid: 0,
                totalAmount: 0,
                pendingAmount: 0,
                overdueAmount: 0,
                paidAmount: 0,
                byCategory: {},
                byCreditorType: {},
                upcoming: { count: 0, amount: 0 },
            };
        }
    });
    // Atualiza status de um item (marcar como pago, etc.)
    app.patch('/items/:id/status', { preHandler: [authMiddleware] }, async (request, reply) => {
        const userId = request.user.id;
        const { id } = request.params;
        const { status, paidAt, notes } = request.body;
        const db = getDb();
        if (!db) {
            return reply.status(500).send({ error: 'Database not available' });
        }
        try {
            let updateQuery = `
        UPDATE financial_items 
        SET status = '${status}', updated_at = NOW()
      `;
            if (status === 'paid' && paidAt) {
                updateQuery += `, paid_at = '${paidAt}'`;
            }
            else if (status === 'paid') {
                updateQuery += `, paid_at = NOW()`;
            }
            if (notes) {
                updateQuery += `, notes = '${notes.replace(/'/g, "''")}'`;
            }
            updateQuery += ` WHERE id = ${id} AND user_id = '${userId}'`;
            await db.execute(sql.raw(updateQuery));
            return { success: true, message: 'Status atualizado' };
        }
        catch (error) {
            console.error('[FinancialRoutes] Erro ao atualizar status:', error);
            return reply.status(500).send({ error: 'Erro ao atualizar status' });
        }
    });
    // Aprovar item financeiro
    app.post('/items/:id/approve', { preHandler: [authMiddleware] }, async (request, reply) => {
        const userId = request.user.id;
        const userName = request.user.email;
        const { id } = request.params;
        const db = getDb();
        if (!db) {
            return reply.status(500).send({ error: 'Database not available' });
        }
        try {
            await db.execute(sql.raw(`
        UPDATE financial_items 
        SET 
          requires_approval = false,
          approved_by = '${userName}',
          approved_at = NOW(),
          updated_at = NOW()
        WHERE id = ${id} AND user_id = '${userId}'
      `));
            return { success: true, message: 'Item aprovado' };
        }
        catch (error) {
            console.error('[FinancialRoutes] Erro ao aprovar:', error);
            return reply.status(500).send({ error: 'Erro ao aprovar item' });
        }
    });
    // Busca item por ID
    app.get('/items/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
        const userId = request.user.id;
        const { id } = request.params;
        const db = getDb();
        if (!db) {
            return reply.status(500).send({ error: 'Database not available' });
        }
        try {
            const result = await db.execute(sql.raw(`
        SELECT 
          id,
          email_id as "emailId",
          thread_id as "threadId",
          email_subject as "emailSubject",
          email_from as "emailFrom",
          email_date as "emailDate",
          type,
          status,
          amount,
          currency,
          due_date as "dueDate",
          issue_date as "issueDate",
          competence_date as "competenceDate",
          paid_at as "paidAt",
          creditor,
          creditor_type as "creditorType",
          creditor_document as "creditorDocument",
          description,
          category,
          reference,
          installment_current as "installmentCurrent",
          installment_total as "installmentTotal",
          barcode_data as "barcodeData",
          barcode_type as "barcodeType",
          bank_code as "bankCode",
          pix_key as "pixKey",
          pix_key_type as "pixKeyType",
          bank_account as "bankAccount",
          recurrence,
          attachment_id as "attachmentId",
          attachment_filename as "attachmentFilename",
          priority,
          notes,
          related_project as "relatedProject",
          requires_approval as "requiresApproval",
          approved_by as "approvedBy",
          approved_at as "approvedAt",
          confidence,
          analyzed_at as "analyzedAt",
          created_at as "createdAt"
        FROM financial_items
        WHERE id = ${id} AND user_id = '${userId}'
      `));
            const items = result;
            if (items.length === 0) {
                return reply.status(404).send({ error: 'Item não encontrado' });
            }
            return items[0];
        }
        catch (error) {
            console.error('[FinancialRoutes] Erro ao buscar item:', error);
            return reply.status(500).send({ error: 'Erro ao buscar item' });
        }
    });
    // Dashboard - resumo para a página inicial
    app.get('/dashboard', { preHandler: [authMiddleware] }, async (request) => {
        const userId = request.user.id;
        const db = getDb();
        if (!db) {
            return {
                overdueItems: [],
                urgentItems: [],
                upcomingItems: [],
                recentItems: [],
                summary: { overdue: 0, urgent: 0, upcoming: 0, pendingTotal: 0 }
            };
        }
        try {
            // Itens vencidos
            const overdueResult = await db.execute(sql.raw(`
        SELECT id, creditor, amount, due_date as "dueDate", description, type,
               recurrence, related_project as "relatedProject",
               email_subject as "emailSubject", email_from as "emailFrom", 
               email_date as "emailDate", confidence, analyzed_at as "analyzedAt"
        FROM financial_items
        WHERE user_id = '${userId}' AND status = 'overdue'
        ORDER BY due_date ASC
        LIMIT 10
      `));
            // Itens urgentes (vence em até 3 dias)
            const urgentResult = await db.execute(sql.raw(`
        SELECT id, creditor, amount, due_date as "dueDate", description, type,
               recurrence, related_project as "relatedProject",
               email_subject as "emailSubject", email_from as "emailFrom", 
               email_date as "emailDate", confidence, analyzed_at as "analyzedAt"
        FROM financial_items
        WHERE user_id = '${userId}'
          AND status = 'pending'
          AND due_date IS NOT NULL
          AND due_date <= NOW() + INTERVAL '3 days'
          AND due_date >= NOW()
        ORDER BY due_date ASC
        LIMIT 10
      `));
            // Próximos vencimentos (4-14 dias)
            const upcomingResult = await db.execute(sql.raw(`
        SELECT id, creditor, amount, due_date as "dueDate", description, type,
               recurrence, related_project as "relatedProject",
               email_subject as "emailSubject", email_from as "emailFrom", 
               email_date as "emailDate", confidence, analyzed_at as "analyzedAt"
        FROM financial_items
        WHERE user_id = '${userId}'
          AND status = 'pending'
          AND due_date IS NOT NULL
          AND due_date > NOW() + INTERVAL '3 days'
          AND due_date <= NOW() + INTERVAL '14 days'
        ORDER BY due_date ASC
        LIMIT 10
      `));
            // Itens recentes
            const recentResult = await db.execute(sql.raw(`
        SELECT id, creditor, amount, due_date as "dueDate", description, type, status,
               analyzed_at as "analyzedAt", recurrence, related_project as "relatedProject",
               email_subject as "emailSubject", email_from as "emailFrom", 
               email_date as "emailDate", confidence
        FROM financial_items
        WHERE user_id = '${userId}'
        ORDER BY analyzed_at DESC
        LIMIT 5
      `));
            // Totais
            const summaryResult = await db.execute(sql.raw(`
        SELECT 
          COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue,
          COUNT(CASE WHEN status = 'pending' AND due_date <= NOW() + INTERVAL '3 days' AND due_date >= NOW() THEN 1 END) as urgent,
          COUNT(CASE WHEN status = 'pending' AND due_date > NOW() + INTERVAL '3 days' AND due_date <= NOW() + INTERVAL '14 days' THEN 1 END) as upcoming,
          COALESCE(SUM(CASE WHEN status IN ('pending', 'overdue') THEN amount ELSE 0 END), 0) as pending_total
        FROM financial_items
        WHERE user_id = '${userId}'
      `));
            const summary = summaryResult[0] || {};
            return {
                overdueItems: overdueResult,
                urgentItems: urgentResult,
                upcomingItems: upcomingResult,
                recentItems: recentResult,
                summary: {
                    overdue: parseInt(summary.overdue) || 0,
                    urgent: parseInt(summary.urgent) || 0,
                    upcoming: parseInt(summary.upcoming) || 0,
                    pendingTotal: parseInt(summary.pending_total) || 0,
                },
            };
        }
        catch (error) {
            console.error('[FinancialRoutes] Erro ao buscar dashboard:', error);
            return {
                overdueItems: [],
                urgentItems: [],
                upcomingItems: [],
                recentItems: [],
                summary: { overdue: 0, urgent: 0, upcoming: 0, pendingTotal: 0 }
            };
        }
    });
    // Excluir item financeiro
    app.delete('/items/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
        const userId = request.user.id;
        const itemId = request.params.id;
        const db = getDb();
        if (!db) {
            return reply.status(500).send({ error: 'Banco de dados não disponível' });
        }
        try {
            const result = await db.execute(sql.raw(`
          DELETE FROM financial_items 
          WHERE id = ${itemId} AND user_id = '${userId}'
          RETURNING id
        `));
            if (result.length === 0) {
                return reply.status(404).send({ error: 'Item não encontrado' });
            }
            return { success: true, message: 'Item excluído com sucesso' };
        }
        catch (error) {
            console.error('[FinancialRoutes] Erro ao excluir item:', error);
            return reply.status(500).send({ error: 'Erro ao excluir item' });
        }
    });
    // Atualizar status de itens vencidos automaticamente
    app.post('/update-overdue', { preHandler: [authMiddleware] }, async (request) => {
        const userId = request.user.id;
        const db = getDb();
        if (!db) {
            return { updated: 0 };
        }
        try {
            const result = await db.execute(sql.raw(`
        UPDATE financial_items 
        SET status = 'overdue', updated_at = NOW()
        WHERE user_id = '${userId}'
          AND status = 'pending'
          AND due_date IS NOT NULL
          AND due_date < NOW()
        RETURNING id
      `));
            const updated = result.length;
            return { updated };
        }
        catch (error) {
            console.error('[FinancialRoutes] Erro ao atualizar vencidos:', error);
            return { updated: 0 };
        }
    });
};
//# sourceMappingURL=financial.js.map