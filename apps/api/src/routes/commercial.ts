import type { FastifyPluginAsync } from 'fastify';
import { getDb } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';

export const commercialRoutes: FastifyPluginAsync = async (app) => {
  // Lista todos os itens comerciais do usuário
  app.get('/items', { preHandler: [authMiddleware] }, async (request) => {
    const userId = request.user!.id;
    const db = getDb();
    
    if (!db) {
      return { items: [], total: 0 };
    }

    try {
      const query = request.query as { 
        limit?: string; 
        status?: string; 
        type?: string;
        priority?: string;
        clientType?: string;
      };
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
          client_name as "clientName",
          client_company as "clientCompany",
          client_email as "clientEmail",
          client_phone as "clientPhone",
          client_type as "clientType",
          title,
          description,
          products_services as "productsServices",
          estimated_value as "estimatedValue",
          currency,
          quantity,
          deadline_date as "deadlineDate",
          desired_delivery_date as "desiredDeliveryDate",
          has_competitors as "hasCompetitors",
          competitor_names as "competitorNames",
          is_urgent_bid as "isUrgentBid",
          priority,
          priority_reason as "priorityReason",
          suggested_action as "suggestedAction",
          suggested_response as "suggestedResponse",
          won_at as "wonAt",
          lost_at as "lostAt",
          lost_reason as "lostReason",
          won_value as "wonValue",
          assigned_to as "assignedTo",
          assigned_at as "assignedAt",
          tags,
          notes,
          confidence,
          analyzed_at as "analyzedAt",
          created_at as "createdAt"
        FROM commercial_items
        WHERE user_id = '${userId}'
      `;

      if (query.status) {
        sqlQuery += ` AND status = '${query.status}'`;
      }

      if (query.type) {
        sqlQuery += ` AND type = '${query.type}'`;
      }

      if (query.priority) {
        sqlQuery += ` AND priority = '${query.priority}'`;
      }

      if (query.clientType) {
        sqlQuery += ` AND client_type = '${query.clientType}'`;
      }

      sqlQuery += ` ORDER BY 
        CASE priority 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'normal' THEN 3 
          WHEN 'low' THEN 4 
        END,
        created_at DESC 
        LIMIT ${limit}`;

      const result = await db.execute(sql.raw(sqlQuery));
      const items = result as unknown as any[];

      return {
        items: items || [],
        total: items?.length || 0,
      };
    } catch (error) {
      console.error('[CommercialRoutes] Erro ao buscar itens:', error);
      return { items: [], total: 0 };
    }
  });

  // Estatísticas comerciais do usuário
  app.get('/stats', { preHandler: [authMiddleware] }, async (request) => {
    const userId = request.user!.id;
    const db = getDb();
    
    if (!db) {
      return { 
        total: 0, 
        newItems: 0,
        inProgress: 0,
        won: 0,
        lost: 0,
        totalEstimatedValue: 0,
        wonValue: 0,
        byType: {},
        byPriority: {},
      };
    }

    try {
      // Stats gerais
      const result = await db.execute(sql.raw(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'new' THEN 1 END) as new_items,
          COUNT(CASE WHEN status IN ('in_progress', 'quoted', 'negotiating') THEN 1 END) as in_progress,
          COUNT(CASE WHEN status = 'won' THEN 1 END) as won,
          COUNT(CASE WHEN status = 'lost' THEN 1 END) as lost,
          COALESCE(SUM(estimated_value), 0) as total_estimated_value,
          COALESCE(SUM(CASE WHEN status = 'won' THEN COALESCE(won_value, estimated_value) ELSE 0 END), 0) as won_value,
          COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical_count,
          COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_count
        FROM commercial_items
        WHERE user_id = '${userId}'
      `));

      const stats = (result as any[])[0] || {};

      // Por tipo
      const typeResult = await db.execute(sql.raw(`
        SELECT 
          type,
          COUNT(*) as count,
          COALESCE(SUM(estimated_value), 0) as value
        FROM commercial_items
        WHERE user_id = '${userId}' AND type IS NOT NULL
        GROUP BY type
        ORDER BY count DESC
      `));

      const byType: Record<string, { count: number; value: number }> = {};
      (typeResult as any[]).forEach((row: any) => {
        byType[row.type] = { 
          count: parseInt(row.count), 
          value: parseInt(row.value) 
        };
      });

      // Por prioridade
      const priorityResult = await db.execute(sql.raw(`
        SELECT 
          priority,
          COUNT(*) as count
        FROM commercial_items
        WHERE user_id = '${userId}' AND priority IS NOT NULL
          AND status NOT IN ('won', 'lost', 'cancelled')
        GROUP BY priority
        ORDER BY 
          CASE priority 
            WHEN 'critical' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'normal' THEN 3 
            WHEN 'low' THEN 4 
          END
      `));

      const byPriority: Record<string, number> = {};
      (priorityResult as any[]).forEach((row: any) => {
        byPriority[row.priority] = parseInt(row.count);
      });

      return {
        total: parseInt(stats.total) || 0,
        newItems: parseInt(stats.new_items) || 0,
        inProgress: parseInt(stats.in_progress) || 0,
        won: parseInt(stats.won) || 0,
        lost: parseInt(stats.lost) || 0,
        totalEstimatedValue: parseInt(stats.total_estimated_value) || 0,
        wonValue: parseInt(stats.won_value) || 0,
        criticalCount: parseInt(stats.critical_count) || 0,
        highCount: parseInt(stats.high_count) || 0,
        byType,
        byPriority,
      };
    } catch (error) {
      console.error('[CommercialRoutes] Erro ao buscar stats:', error);
      return { 
        total: 0, 
        newItems: 0, 
        inProgress: 0, 
        won: 0,
        lost: 0,
        totalEstimatedValue: 0,
        wonValue: 0,
        byType: {},
        byPriority: {},
      };
    }
  });

  // Atualiza status de um item
  app.patch('/items/:id/status', { preHandler: [authMiddleware] }, async (request, reply) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };
    const { status, notes, wonValue, lostReason, assignedTo } = request.body as { 
      status: string; 
      notes?: string;
      wonValue?: number;
      lostReason?: string;
      assignedTo?: string;
    };
    
    const db = getDb();
    if (!db) {
      return reply.status(500).send({ error: 'Database not available' });
    }

    try {
      let updateQuery = `
        UPDATE commercial_items 
        SET status = '${status}', updated_at = NOW()
      `;

      if (status === 'won') {
        updateQuery += `, won_at = NOW()`;
        if (wonValue) {
          updateQuery += `, won_value = ${wonValue}`;
        }
      } else if (status === 'lost') {
        updateQuery += `, lost_at = NOW()`;
        if (lostReason) {
          updateQuery += `, lost_reason = '${lostReason.replace(/'/g, "''")}'`;
        }
      }

      if (notes) {
        updateQuery += `, notes = '${notes.replace(/'/g, "''")}'`;
      }

      if (assignedTo !== undefined) {
        if (assignedTo) {
          updateQuery += `, assigned_to = '${assignedTo.replace(/'/g, "''")}', assigned_at = NOW()`;
        } else {
          updateQuery += `, assigned_to = NULL, assigned_at = NULL`;
        }
      }

      updateQuery += ` WHERE id = ${id} AND user_id = '${userId}'`;

      await db.execute(sql.raw(updateQuery));

      return { success: true, message: 'Status atualizado' };
    } catch (error) {
      console.error('[CommercialRoutes] Erro ao atualizar status:', error);
      return reply.status(500).send({ error: 'Erro ao atualizar status' });
    }
  });

  // Busca item por ID
  app.get('/items/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };
    
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
          client_name as "clientName",
          client_company as "clientCompany",
          client_email as "clientEmail",
          client_phone as "clientPhone",
          client_type as "clientType",
          title,
          description,
          products_services as "productsServices",
          estimated_value as "estimatedValue",
          currency,
          quantity,
          deadline_date as "deadlineDate",
          desired_delivery_date as "desiredDeliveryDate",
          has_competitors as "hasCompetitors",
          competitor_names as "competitorNames",
          is_urgent_bid as "isUrgentBid",
          priority,
          priority_reason as "priorityReason",
          suggested_action as "suggestedAction",
          suggested_response as "suggestedResponse",
          won_at as "wonAt",
          lost_at as "lostAt",
          lost_reason as "lostReason",
          won_value as "wonValue",
          assigned_to as "assignedTo",
          assigned_at as "assignedAt",
          tags,
          notes,
          confidence,
          analyzed_at as "analyzedAt",
          created_at as "createdAt"
        FROM commercial_items
        WHERE id = ${id} AND user_id = '${userId}'
      `));

      const items = result as any[];
      if (items.length === 0) {
        return reply.status(404).send({ error: 'Item não encontrado' });
      }

      return items[0];
    } catch (error) {
      console.error('[CommercialRoutes] Erro ao buscar item:', error);
      return reply.status(500).send({ error: 'Erro ao buscar item' });
    }
  });

  // Dashboard - resumo para a página inicial
  app.get('/dashboard', { preHandler: [authMiddleware] }, async (request) => {
    const userId = request.user!.id;
    const db = getDb();
    
    if (!db) {
      return { 
        criticalItems: [],
        highPriorityItems: [],
        recentItems: [],
        pendingQuotes: [],
        summary: { critical: 0, high: 0, pending: 0, totalValue: 0 }
      };
    }

    try {
      // Itens críticos
      const criticalResult = await db.execute(sql.raw(`
        SELECT id, title, client_name as "clientName", client_company as "clientCompany",
               type, priority, estimated_value as "estimatedValue", deadline_date as "deadlineDate",
               email_subject as "emailSubject", email_from as "emailFrom", 
               email_date as "emailDate", confidence, analyzed_at as "analyzedAt",
               suggested_action as "suggestedAction"
        FROM commercial_items
        WHERE user_id = '${userId}' 
          AND status NOT IN ('won', 'lost', 'cancelled')
          AND priority = 'critical'
        ORDER BY deadline_date ASC NULLS LAST, created_at DESC
        LIMIT 10
      `));

      // Itens de alta prioridade
      const highResult = await db.execute(sql.raw(`
        SELECT id, title, client_name as "clientName", client_company as "clientCompany",
               type, priority, estimated_value as "estimatedValue", deadline_date as "deadlineDate",
               email_subject as "emailSubject", email_from as "emailFrom", 
               email_date as "emailDate", confidence, analyzed_at as "analyzedAt",
               suggested_action as "suggestedAction"
        FROM commercial_items
        WHERE user_id = '${userId}'
          AND status NOT IN ('won', 'lost', 'cancelled')
          AND priority = 'high'
        ORDER BY deadline_date ASC NULLS LAST, created_at DESC
        LIMIT 10
      `));

      // Pedidos de cotação pendentes
      const quotesResult = await db.execute(sql.raw(`
        SELECT id, title, client_name as "clientName", client_company as "clientCompany",
               type, priority, estimated_value as "estimatedValue", deadline_date as "deadlineDate",
               email_subject as "emailSubject", analyzed_at as "analyzedAt",
               suggested_action as "suggestedAction", status
        FROM commercial_items
        WHERE user_id = '${userId}'
          AND type = 'quote_request'
          AND status IN ('new', 'in_progress')
        ORDER BY deadline_date ASC NULLS LAST, created_at DESC
        LIMIT 10
      `));

      // Itens recentes
      const recentResult = await db.execute(sql.raw(`
        SELECT id, title, client_name as "clientName", client_company as "clientCompany",
               type, priority, status, estimated_value as "estimatedValue",
               analyzed_at as "analyzedAt", email_subject as "emailSubject"
        FROM commercial_items
        WHERE user_id = '${userId}'
        ORDER BY analyzed_at DESC
        LIMIT 5
      `));

      // Totais
      const summaryResult = await db.execute(sql.raw(`
        SELECT 
          COUNT(CASE WHEN priority = 'critical' AND status NOT IN ('won', 'lost', 'cancelled') THEN 1 END) as critical,
          COUNT(CASE WHEN priority = 'high' AND status NOT IN ('won', 'lost', 'cancelled') THEN 1 END) as high,
          COUNT(CASE WHEN status IN ('new', 'in_progress', 'quoted', 'negotiating') THEN 1 END) as pending,
          COALESCE(SUM(CASE WHEN status NOT IN ('won', 'lost', 'cancelled') THEN estimated_value ELSE 0 END), 0) as total_value
        FROM commercial_items
        WHERE user_id = '${userId}'
      `));

      const summary = (summaryResult as any[])[0] || {};

      return {
        criticalItems: criticalResult as any[],
        highPriorityItems: highResult as any[],
        pendingQuotes: quotesResult as any[],
        recentItems: recentResult as any[],
        summary: {
          critical: parseInt(summary.critical) || 0,
          high: parseInt(summary.high) || 0,
          pending: parseInt(summary.pending) || 0,
          totalValue: parseInt(summary.total_value) || 0,
        },
      };
    } catch (error) {
      console.error('[CommercialRoutes] Erro ao buscar dashboard:', error);
      return { 
        criticalItems: [],
        highPriorityItems: [],
        recentItems: [],
        pendingQuotes: [],
        summary: { critical: 0, high: 0, pending: 0, totalValue: 0 }
      };
    }
  });

  // Excluir item comercial
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
        const result = await db.execute(sql.raw(`
          DELETE FROM commercial_items 
          WHERE id = ${itemId} AND user_id = '${userId}'
          RETURNING id
        `));

        if ((result as any[]).length === 0) {
          return reply.status(404).send({ error: 'Item não encontrado' });
        }

        return { success: true, message: 'Item excluído com sucesso' };
      } catch (error) {
        console.error('[CommercialRoutes] Erro ao excluir item:', error);
        return reply.status(500).send({ error: 'Erro ao excluir item' });
      }
    }
  );

  // Pipeline - visão Kanban
  app.get('/pipeline', { preHandler: [authMiddleware] }, async (request) => {
    const userId = request.user!.id;
    const db = getDb();
    
    if (!db) {
      return { 
        new: [],
        in_progress: [],
        quoted: [],
        negotiating: [],
        won: [],
        lost: [],
      };
    }

    try {
      const result = await db.execute(sql.raw(`
        SELECT 
          id,
          title,
          client_name as "clientName",
          client_company as "clientCompany",
          type,
          status,
          priority,
          estimated_value as "estimatedValue",
          deadline_date as "deadlineDate",
          analyzed_at as "analyzedAt"
        FROM commercial_items
        WHERE user_id = '${userId}'
        ORDER BY 
          CASE priority 
            WHEN 'critical' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'normal' THEN 3 
            WHEN 'low' THEN 4 
          END,
          deadline_date ASC NULLS LAST
      `));

      const items = result as any[];
      
      // Agrupa por status
      const pipeline: Record<string, any[]> = {
        new: [],
        in_progress: [],
        quoted: [],
        negotiating: [],
        won: [],
        lost: [],
      };

      items.forEach(item => {
        if (pipeline[item.status]) {
          pipeline[item.status].push(item);
        }
      });

      return pipeline;
    } catch (error) {
      console.error('[CommercialRoutes] Erro ao buscar pipeline:', error);
      return { 
        new: [],
        in_progress: [],
        quoted: [],
        negotiating: [],
        won: [],
        lost: [],
      };
    }
  });
};

