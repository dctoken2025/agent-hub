import type { FastifyPluginAsync } from 'fastify';
import { getDb, actionItems } from '../db/index.js';
import { eq, sql, and } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';

export const taskRoutes: FastifyPluginAsync = async (app) => {
  // Lista action items do usuário
  app.get('/items', { preHandler: [authMiddleware] }, async (request) => {
    const userId = request.user!.id;
    const query = request.query as { 
      status?: string; 
      priority?: string;
      project?: string;
      stakeholder?: string;
      limit?: string;
    };
    const db = getDb();
    
    if (!db) {
      return { items: [] };
    }

    try {
      let sqlQuery = `
        SELECT
          id,
          email_id as "emailId",
          thread_id as "threadId",
          email_subject as "emailSubject",
          email_from as "emailFrom",
          email_date as "emailDate",
          stakeholder_name as "stakeholderName",
          stakeholder_company as "stakeholderCompany",
          stakeholder_role as "stakeholderRole",
          stakeholder_email as "stakeholderEmail",
          stakeholder_importance as "stakeholderImportance",
          project_name as "projectName",
          project_code as "projectCode",
          project_type as "projectType",
          title,
          description,
          original_text as "originalText",
          category,
          deadline_date as "deadlineDate",
          deadline_relative as "deadlineRelative",
          deadline_is_explicit as "deadlineIsExplicit",
          deadline_depends_on as "deadlineDependsOn",
          deadline_urgency as "deadlineUrgency",
          status,
          response_text as "responseText",
          responded_at as "respondedAt",
          priority,
          priority_reason as "priorityReason",
          suggested_response as "suggestedResponse",
          suggested_action as "suggestedAction",
          related_documents as "relatedDocuments",
          blocked_by_external as "blockedByExternal",
          confidence,
          created_at as "createdAt",
          updated_at as "updatedAt",
          completed_at as "completedAt"
        FROM action_items
        WHERE user_id = '${userId}'
      `;

      if (query.status && query.status !== 'all') {
        sqlQuery += ` AND status = '${query.status}'`;
      }
      
      if (query.priority && query.priority !== 'all') {
        sqlQuery += ` AND priority = '${query.priority}'`;
      }
      
      if (query.project) {
        sqlQuery += ` AND project_name ILIKE '%${query.project}%'`;
      }
      
      if (query.stakeholder) {
        sqlQuery += ` AND (stakeholder_name ILIKE '%${query.stakeholder}%' OR stakeholder_company ILIKE '%${query.stakeholder}%')`;
      }

      sqlQuery += ` ORDER BY 
        CASE priority 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
        END,
        CASE WHEN deadline_date IS NOT NULL THEN deadline_date ELSE '2099-12-31' END,
        created_at DESC
      `;

      const limit = parseInt(query.limit || '100');
      sqlQuery += ` LIMIT ${limit}`;

      const result = await db.execute(sql.raw(sqlQuery));
      
      return { items: result as any[] };
    } catch (error) {
      console.error('[TaskRoutes] Erro ao listar items:', error);
      return { items: [] };
    }
  });

  // Estatísticas de tarefas
  app.get('/stats', { preHandler: [authMiddleware] }, async (request) => {
    const userId = request.user!.id;
    const db = getDb();
    
    if (!db) {
      return { total: 0, pending: 0, done: 0, critical: 0 };
    }

    try {
      const result = await db.execute(sql.raw(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
          COUNT(CASE WHEN status = 'waiting' THEN 1 END) as waiting,
          COUNT(CASE WHEN status = 'done' THEN 1 END) as done,
          COUNT(CASE WHEN priority = 'critical' AND status NOT IN ('done', 'cancelled') THEN 1 END) as critical,
          COUNT(CASE WHEN priority = 'high' AND status NOT IN ('done', 'cancelled') THEN 1 END) as high,
          COUNT(CASE WHEN deadline_date IS NOT NULL AND deadline_date < NOW() AND status NOT IN ('done', 'cancelled') THEN 1 END) as overdue
        FROM action_items
        WHERE user_id = '${userId}'
      `));

      const stats = (result as any[])[0] || {};

      // Busca projetos distintos
      const projectsResult = await db.execute(sql.raw(`
        SELECT project_name as name, COUNT(*) as count
        FROM action_items
        WHERE user_id = '${userId}' 
          AND project_name IS NOT NULL 
          AND status NOT IN ('done', 'cancelled')
        GROUP BY project_name
        ORDER BY count DESC
        LIMIT 10
      `));

      // Busca stakeholders distintos
      const stakeholdersResult = await db.execute(sql.raw(`
        SELECT 
          stakeholder_name as name, 
          stakeholder_company as company,
          stakeholder_importance as importance,
          COUNT(*) as count
        FROM action_items
        WHERE user_id = '${userId}' 
          AND status NOT IN ('done', 'cancelled')
        GROUP BY stakeholder_name, stakeholder_company, stakeholder_importance
        ORDER BY 
          CASE stakeholder_importance WHEN 'vip' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
          count DESC
        LIMIT 10
      `));

      return {
        total: parseInt(stats.total) || 0,
        pending: parseInt(stats.pending) || 0,
        inProgress: parseInt(stats.in_progress) || 0,
        waiting: parseInt(stats.waiting) || 0,
        done: parseInt(stats.done) || 0,
        critical: parseInt(stats.critical) || 0,
        high: parseInt(stats.high) || 0,
        overdue: parseInt(stats.overdue) || 0,
        byProject: projectsResult as any[],
        byStakeholder: stakeholdersResult as any[],
      };
    } catch (error) {
      console.error('[TaskRoutes] Erro ao buscar stats:', error);
      return { total: 0, pending: 0, done: 0, critical: 0 };
    }
  });

  // Busca um item específico
  app.get('/items/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };
    const db = getDb();
    
    if (!db) {
      return reply.status(500).send({ error: 'Banco de dados não disponível' });
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
          stakeholder_name as "stakeholderName",
          stakeholder_company as "stakeholderCompany",
          stakeholder_role as "stakeholderRole",
          stakeholder_email as "stakeholderEmail",
          stakeholder_phone as "stakeholderPhone",
          stakeholder_importance as "stakeholderImportance",
          project_name as "projectName",
          project_code as "projectCode",
          project_type as "projectType",
          title,
          description,
          original_text as "originalText",
          category,
          deadline_date as "deadlineDate",
          deadline_relative as "deadlineRelative",
          deadline_is_explicit as "deadlineIsExplicit",
          deadline_depends_on as "deadlineDependsOn",
          deadline_urgency as "deadlineUrgency",
          status,
          response_text as "responseText",
          responded_at as "respondedAt",
          responded_by as "respondedBy",
          priority,
          priority_reason as "priorityReason",
          suggested_response as "suggestedResponse",
          suggested_action as "suggestedAction",
          related_documents as "relatedDocuments",
          blocked_by_external as "blockedByExternal",
          confidence,
          created_at as "createdAt",
          updated_at as "updatedAt",
          completed_at as "completedAt"
        FROM action_items
        WHERE id = ${id} AND user_id = '${userId}'
      `));

      if (!result || (result as any[]).length === 0) {
        return reply.status(404).send({ error: 'Item não encontrado' });
      }

      return { item: (result as any[])[0] };
    } catch (error) {
      console.error('[TaskRoutes] Erro ao buscar item:', error);
      return reply.status(500).send({ error: 'Erro ao buscar item' });
    }
  });

  // Atualiza status de um item
  app.patch('/items/:id/status', { preHandler: [authMiddleware] }, async (request, reply) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };
    const { status, responseText } = request.body as { status: string; responseText?: string };
    const db = getDb();
    
    if (!db) {
      return reply.status(500).send({ error: 'Banco de dados não disponível' });
    }

    try {
      const updateData: Record<string, any> = {
        status,
        updated_at: new Date(),
      };

      if (responseText) {
        updateData.response_text = responseText;
        updateData.responded_at = new Date();
        updateData.responded_by = request.user!.email;
      }

      if (status === 'done') {
        updateData.completed_at = new Date();
      }

      await db.update(actionItems)
        .set(updateData)
        .where(and(
          eq(actionItems.id, parseInt(id)),
          eq(actionItems.userId, userId)
        ));

      return { success: true };
    } catch (error) {
      console.error('[TaskRoutes] Erro ao atualizar status:', error);
      return reply.status(500).send({ error: 'Erro ao atualizar status' });
    }
  });

  // Atualiza resposta de um item
  app.patch('/items/:id/response', { preHandler: [authMiddleware] }, async (request, reply) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };
    const { responseText } = request.body as { responseText: string };
    const db = getDb();
    
    if (!db) {
      return reply.status(500).send({ error: 'Banco de dados não disponível' });
    }

    try {
      await db.update(actionItems)
        .set({
          responseText,
          respondedAt: new Date(),
          respondedBy: request.user!.email,
          updatedAt: new Date(),
        })
        .where(and(
          eq(actionItems.id, parseInt(id)),
          eq(actionItems.userId, userId)
        ));

      return { success: true };
    } catch (error) {
      console.error('[TaskRoutes] Erro ao atualizar resposta:', error);
      return reply.status(500).send({ error: 'Erro ao atualizar resposta' });
    }
  });

  // Agrupa itens por email (para ver todos os itens de um email)
  app.get('/by-email/:emailId', { preHandler: [authMiddleware] }, async (request) => {
    const userId = request.user!.id;
    const { emailId } = request.params as { emailId: string };
    const db = getDb();
    
    if (!db) {
      return { items: [] };
    }

    try {
      const result = await db.execute(sql.raw(`
        SELECT
          id,
          title,
          description,
          category,
          status,
          priority,
          deadline_date as "deadlineDate",
          deadline_relative as "deadlineRelative",
          suggested_response as "suggestedResponse",
          response_text as "responseText",
          confidence
        FROM action_items
        WHERE user_id = '${userId}' AND email_id = '${emailId}'
        ORDER BY 
          CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
          id
      `));

      return { items: result as any[] };
    } catch (error) {
      console.error('[TaskRoutes] Erro ao buscar itens por email:', error);
      return { items: [] };
    }
  });

  // Dashboard com resumo
  app.get('/dashboard', { preHandler: [authMiddleware] }, async (request) => {
    const userId = request.user!.id;
    const db = getDb();
    
    if (!db) {
      return { criticalItems: [], overdueItems: [], todayItems: [], recentItems: [] };
    }

    try {
      // Itens críticos pendentes
      const criticalResult = await db.execute(sql.raw(`
        SELECT id, title, description, stakeholder_name as "stakeholderName", 
               stakeholder_company as "stakeholderCompany", project_name as "projectName",
               deadline_date as "deadlineDate", deadline_relative as "deadlineRelative",
               category, email_subject as "emailSubject", priority_reason as "priorityReason"
        FROM action_items
        WHERE user_id = '${userId}' 
          AND priority = 'critical' 
          AND status NOT IN ('done', 'cancelled')
        ORDER BY deadline_date ASC NULLS LAST, created_at DESC
        LIMIT 10
      `));

      // Itens vencidos
      const overdueResult = await db.execute(sql.raw(`
        SELECT id, title, description, stakeholder_name as "stakeholderName", 
               stakeholder_company as "stakeholderCompany", project_name as "projectName",
               deadline_date as "deadlineDate", category, priority
        FROM action_items
        WHERE user_id = '${userId}' 
          AND deadline_date < NOW() 
          AND status NOT IN ('done', 'cancelled')
        ORDER BY deadline_date ASC
        LIMIT 10
      `));

      // Itens para hoje/amanhã
      const todayResult = await db.execute(sql.raw(`
        SELECT id, title, description, stakeholder_name as "stakeholderName", 
               stakeholder_company as "stakeholderCompany", project_name as "projectName",
               deadline_date as "deadlineDate", deadline_urgency as "deadlineUrgency",
               category, priority
        FROM action_items
        WHERE user_id = '${userId}' 
          AND (
            deadline_urgency IN ('immediate', 'soon')
            OR (deadline_date >= NOW() AND deadline_date <= NOW() + INTERVAL '2 days')
          )
          AND status NOT IN ('done', 'cancelled')
        ORDER BY deadline_date ASC NULLS LAST, priority DESC
        LIMIT 10
      `));

      // Itens recentes
      const recentResult = await db.execute(sql.raw(`
        SELECT id, title, stakeholder_name as "stakeholderName", 
               stakeholder_company as "stakeholderCompany", project_name as "projectName",
               category, priority, status, created_at as "createdAt"
        FROM action_items
        WHERE user_id = '${userId}'
        ORDER BY created_at DESC
        LIMIT 10
      `));

      return {
        criticalItems: criticalResult as any[],
        overdueItems: overdueResult as any[],
        todayItems: todayResult as any[],
        recentItems: recentResult as any[],
      };
    } catch (error) {
      console.error('[TaskRoutes] Erro ao buscar dashboard:', error);
      return { criticalItems: [], overdueItems: [], todayItems: [], recentItems: [] };
    }
  });

  // Gera resposta sugerida para um conjunto de itens
  app.post('/generate-reply', { preHandler: [authMiddleware] }, async (request, reply) => {
    const userId = request.user!.id;
    const { emailId } = request.body as { emailId: string };
    const db = getDb();
    
    if (!db) {
      return reply.status(500).send({ error: 'Banco de dados não disponível' });
    }

    try {
      // Busca todos os itens do email
      const items = await db.execute(sql.raw(`
        SELECT 
          title, 
          description, 
          category, 
          status, 
          response_text as "responseText",
          suggested_response as "suggestedResponse"
        FROM action_items
        WHERE user_id = '${userId}' AND email_id = '${emailId}'
        ORDER BY id
      `));

      if (!items || (items as any[]).length === 0) {
        return reply.status(404).send({ error: 'Nenhum item encontrado para este email' });
      }

      // Monta a resposta baseada nos status
      const statusIcons: Record<string, string> = {
        done: '✅',
        in_progress: '🔄',
        waiting: '⏳',
        pending: '❓',
        cancelled: '❌',
      };
      
      const itemsList = (items as any[]).map((item, i) => {
        const statusIcon = statusIcons[item.status] || '❓';

        return `${i + 1}. ${statusIcon} ${item.title}\n   → ${item.responseText || item.suggestedResponse || 'A verificar'}`;
      }).join('\n\n');

      const reply_text = `Prezado(a),

Segue o status das pendências solicitadas:

${itemsList}

Fico à disposição para esclarecimentos.

Atenciosamente`;

      return { suggestedReply: reply_text };
    } catch (error) {
      console.error('[TaskRoutes] Erro ao gerar resposta:', error);
      return reply.status(500).send({ error: 'Erro ao gerar resposta' });
    }
  });

  // Excluir item de tarefa
  app.delete<{ Params: { id: string } }>(
    '/items/:id',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const userId = request.user!.id;
      const itemId = request.params.id;
      const db = getDb();

      if (!db) {
        return reply.status(500).send({ error: 'Banco de dados não disponível' });
      }

      try {
        const result = await db
          .delete(actionItems)
          .where(
            and(
              eq(actionItems.id, parseInt(itemId)),
              eq(actionItems.userId, userId)
            )
          )
          .returning({ id: actionItems.id });

        if (result.length === 0) {
          return reply.status(404).send({ error: 'Item não encontrado' });
        }

        return { success: true, message: 'Tarefa excluída com sucesso' };
      } catch (error) {
        console.error('[TaskRoutes] Erro ao excluir tarefa:', error);
        return reply.status(500).send({ error: 'Erro ao excluir tarefa' });
      }
    }
  );
};
