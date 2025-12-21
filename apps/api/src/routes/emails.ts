import type { FastifyPluginAsync } from 'fastify';
import { getDb, classifiedEmails, legalAnalyses, financialItems, actionItems, commercialItems, users } from '../db/index.js';
import { eq, desc, sql, and } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { loadGlobalConfig } from './config.js';
import { getAgentManager } from '../services/agent-manager.js';
import type { ClassifiedEmail, ContractAnalysis } from '@agent-hub/email-agent';
import type { FinancialItem } from '@agent-hub/financial-agent';
import type { ActionItem } from '@agent-hub/task-agent';
import type { CommercialItem } from '@agent-hub/commercial-agent';

// Função para salvar emails no banco (com userId)
async function saveEmailsToDatabase(emails: ClassifiedEmail[], userId: string): Promise<void> {
  const db = getDb();
  if (!db) {
    console.log('[EmailRoutes] Banco não disponível para salvar emails');
    return;
  }

  let savedCount = 0;
  let skippedCount = 0;

  for (const email of emails) {
    try {
      // Verifica se já existe para este usuário
      const existing = await db
        .select()
        .from(classifiedEmails)
        .where(and(eq(classifiedEmails.emailId, email.id), eq(classifiedEmails.userId, userId)))
        .limit(1);

      if (existing.length > 0) {
        // Atualiza classificação
        await db
          .update(classifiedEmails)
          .set({
            priority: email.classification.priority,
            action: email.classification.action,
            confidence: email.classification.confidence,
            reasoning: email.classification.reasoning,
            suggestedResponse: email.classification.suggestedResponse,
            tags: JSON.stringify(email.classification.tags),
            sentiment: email.classification.sentiment,
            isDirectedToMe: email.classification.isDirectedToMe,
            requiresAction: email.classification.requiresAction,
            deadline: email.classification.deadline,
            classifiedAt: new Date(),
          })
          .where(eq(classifiedEmails.emailId, email.id));
        skippedCount++;
      } else {
        // Insere novo
        await db.insert(classifiedEmails).values({
          userId,
          emailId: email.id,
          threadId: email.threadId,
          fromEmail: email.from.email,
          fromName: email.from.name,
          toEmails: JSON.stringify(email.to),
          ccEmails: JSON.stringify(email.cc),
          subject: email.subject,
          snippet: email.snippet,
          body: email.body.substring(0, 10000),
          priority: email.classification.priority,
          action: email.classification.action,
          confidence: email.classification.confidence,
          reasoning: email.classification.reasoning,
          suggestedResponse: email.classification.suggestedResponse,
          tags: JSON.stringify(email.classification.tags),
          sentiment: email.classification.sentiment,
          isDirectedToMe: email.classification.isDirectedToMe,
          requiresAction: email.classification.requiresAction,
          deadline: email.classification.deadline,
          emailDate: new Date(email.date),
          classifiedAt: new Date(),
          hasAttachments: email.hasAttachments,
        });
        savedCount++;
      }
    } catch (error) {
      console.error(`[EmailRoutes] Erro ao salvar email ${email.id}:`, error);
    }
  }

  console.log(`[EmailRoutes] Emails salvos: ${savedCount} novos, ${skippedCount} atualizados`);
}

// Função para salvar análises jurídicas no banco (com userId)
async function saveLegalAnalysesToDatabase(
  analyses: ContractAnalysis[],
  userId: string
): Promise<void> {
  const db = getDb();
  if (!db) {
    console.log('[EmailRoutes] Banco não disponível para salvar análises jurídicas');
    return;
  }

  let savedCount = 0;
  let skippedCount = 0;

  for (const analysis of analyses) {
    try {
      // Verifica se já existe
      const existing = await db
        .select()
        .from(legalAnalyses)
        .where(
          and(
            eq(legalAnalyses.documentName, analysis.documentName),
            eq(legalAnalyses.userId, userId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        console.log(`[EmailRoutes] ⏭️ Análise já existe: ${analysis.documentName}`);
        skippedCount++;
        continue;
      }

      await db.insert(legalAnalyses).values({
        userId,
        emailId: analysis.emailId || 'unknown',
        threadId: analysis.threadId || null,
        documentName: analysis.documentName,
        documentType: analysis.documentType,
        parties: Array.isArray(analysis.parties)
          ? analysis.parties.join(', ')
          : (analysis.parties as unknown as string) || '',
        summary: analysis.summary,
        keyDates: analysis.keyDates,
        financialTerms: analysis.financialTerms,
        criticalClauses: analysis.criticalClauses,
        risks: analysis.risks,
        suggestions: analysis.suggestions,
        overallRisk: analysis.overallRisk,
        requiresAttention: analysis.requiresAttention,
        analyzedAt: new Date(),
        requiredAction: analysis.requiredAction || 'review',
        actionDescription: analysis.actionDescription || '',
        responsibleParties: analysis.responsibleParties || [],
        actionDeadline: analysis.actionDeadline,
        isUrgent: analysis.isUrgent || false,
        nextSteps: analysis.nextSteps || [],
      });
      savedCount++;
    } catch (error) {
      console.error(`[EmailRoutes] Erro ao salvar análise ${analysis.documentName}:`, error);
    }
  }

  console.log(
    `[EmailRoutes] Total de análises jurídicas: ${savedCount} novas, ${skippedCount} já existentes`
  );
}

// Função para salvar itens financeiros no banco (com userId)
async function saveFinancialItemsToDatabase(
  items: FinancialItem[],
  userId: string
): Promise<void> {
  const db = getDb();
  if (!db) {
    console.log('[EmailRoutes] Banco não disponível para salvar itens financeiros');
    return;
  }

  let savedCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    try {
      // Garante que amount é um número válido (campo obrigatório no banco)
      const amount = typeof item.amount === 'number' && !isNaN(item.amount) ? item.amount : 0;
      
      // Verifica se já existe (baseado em emailId + creditor + amount + dueDate)
      const existing = await db
        .select()
        .from(financialItems)
        .where(
          and(
            eq(financialItems.emailId, item.emailId),
            eq(financialItems.creditor, item.creditor),
            eq(financialItems.amount, amount),
            eq(financialItems.userId, userId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        console.log(`[EmailRoutes] ⏭️ Item financeiro já existe: ${item.creditor} - R$ ${(amount / 100).toFixed(2)}`);
        skippedCount++;
        continue;
      }

      await db.insert(financialItems).values({
        userId,
        emailId: item.emailId,
        threadId: item.threadId || null,
        // Contexto do email original
        emailSubject: item.emailSubject || null,
        emailFrom: item.emailFrom || null,
        emailDate: item.emailDate ? new Date(item.emailDate) : null,
        // Dados financeiros
        type: item.type,
        status: item.status,
        amount: amount,
        currency: item.currency || 'BRL',
        dueDate: item.dueDate ? new Date(item.dueDate) : null,
        issueDate: item.issueDate ? new Date(item.issueDate) : null,
        competenceDate: item.competenceDate || null,
        creditor: item.creditor,
        creditorType: item.creditorType,
        creditorDocument: item.creditorDocument || null,
        description: item.description,
        category: item.category,
        reference: item.reference || null,
        installmentCurrent: item.installment?.current || null,
        installmentTotal: item.installment?.total || null,
        barcodeData: item.barcodeData || null,
        barcodeType: item.barcodeType || null,
        bankCode: item.bankCode || null,
        // Novos campos de formas de pagamento
        pixKey: (item as any).pixKey || null,
        pixKeyType: (item as any).pixKeyType || null,
        bankAccount: (item as any).bankAccount || null,
        recurrence: (item as any).recurrence || null,
        attachmentId: item.attachmentId || null,
        attachmentFilename: item.attachmentFilename || null,
        priority: item.priority,
        notes: item.notes || null,
        relatedProject: item.relatedProject || null,
        requiresApproval: item.requiresApproval || false,
        confidence: item.confidence,
        analyzedAt: new Date(),
      });
      savedCount++;
    } catch (error) {
      console.error(`[EmailRoutes] Erro ao salvar item financeiro ${item.creditor}:`, error);
    }
  }

  console.log(
    `[EmailRoutes] Total de itens financeiros: ${savedCount} novos, ${skippedCount} já existentes`
  );
}

// Função para salvar action items no banco (com userId)
async function saveActionItemsToDatabase(
  items: ActionItem[],
  userId: string
): Promise<void> {
  const db = getDb();
  if (!db) {
    console.log('[EmailRoutes] Banco não disponível para salvar action items');
    return;
  }

  let savedCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    try {
      // Verifica se já existe item com mesmo emailId e título para este usuário
      const existing = await db.execute(sql.raw(`
        SELECT id FROM action_items 
        WHERE user_id = '${userId}' 
          AND email_id = '${item.emailId}'
          AND title = '${item.title.replace(/'/g, "''")}'
        LIMIT 1
      `));

      if ((existing as any[]).length > 0) {
        skippedCount++;
        continue;
      }

      // Insere novo action item
      await db.insert(actionItems).values({
        userId,
        emailId: item.emailId,
        threadId: item.threadId || null,
        emailSubject: item.emailSubject,
        emailFrom: item.emailFrom,
        emailDate: item.emailDate ? new Date(item.emailDate) : null,
        // Stakeholder
        stakeholderName: item.stakeholder.name,
        stakeholderCompany: item.stakeholder.company || null,
        stakeholderRole: item.stakeholder.role || null,
        stakeholderEmail: item.stakeholder.email || null,
        stakeholderPhone: item.stakeholder.phone || null,
        stakeholderImportance: item.stakeholder.importance,
        // Projeto
        projectName: item.project?.name || null,
        projectCode: item.project?.code || null,
        projectType: item.project?.type || null,
        // Tarefa
        title: item.title,
        description: item.description,
        originalText: item.originalText,
        category: item.category,
        // Prazo
        deadlineDate: item.deadline?.date ? new Date(item.deadline.date) : null,
        deadlineRelative: item.deadline?.relative || null,
        deadlineIsExplicit: item.deadline?.isExplicit || false,
        deadlineDependsOn: item.deadline?.dependsOn || null,
        deadlineUrgency: item.deadline?.urgencyLevel || null,
        // Status
        status: 'pending',
        // Prioridade
        priority: item.priority,
        priorityReason: item.priorityReason || null,
        // Sugestões
        suggestedResponse: item.suggestedResponse || null,
        suggestedAction: item.suggestedAction || null,
        relatedDocuments: item.relatedDocuments ? JSON.stringify(item.relatedDocuments) : null,
        blockedByExternal: item.blockedByExternal || null,
        // Confiança
        confidence: item.confidence,
      });
      savedCount++;
    } catch (error) {
      console.error(`[EmailRoutes] Erro ao salvar action item "${item.title}":`, error);
    }
  }

  console.log(
    `[EmailRoutes] Total de action items: ${savedCount} novos, ${skippedCount} já existentes`
  );
}

// Função para salvar commercial items no banco (com userId)
async function saveCommercialItemsToDatabase(
  items: CommercialItem[],
  userId: string
): Promise<void> {
  const db = getDb();
  if (!db) {
    console.log('[EmailRoutes] Banco não disponível para salvar commercial items');
    return;
  }

  let savedCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    try {
      // Verifica se já existe item com mesmo emailId e título para este usuário
      const existing = await db.execute(sql.raw(`
        SELECT id FROM commercial_items 
        WHERE user_id = '${userId}' 
          AND email_id = '${item.emailId}'
          AND title = '${item.title.replace(/'/g, "''")}'
        LIMIT 1
      `));

      if ((existing as any[]).length > 0) {
        skippedCount++;
        continue;
      }

      // Insere novo commercial item
      await db.insert(commercialItems).values({
        userId,
        emailId: item.emailId,
        threadId: item.threadId || null,
        emailSubject: item.emailSubject || null,
        emailFrom: item.emailFrom || null,
        emailDate: item.emailDate ? new Date(item.emailDate) : null,
        // Tipo e status
        type: item.type,
        status: item.status,
        // Cliente/Contato
        clientName: item.clientName,
        clientCompany: item.clientCompany || null,
        clientEmail: item.clientEmail || null,
        clientPhone: item.clientPhone || null,
        clientType: item.clientType || null,
        // Detalhes
        title: item.title,
        description: item.description,
        productsServices: item.productsServices ? JSON.stringify(item.productsServices) : null,
        estimatedValue: item.estimatedValue || null,
        currency: item.currency || 'BRL',
        quantity: item.quantity || null,
        // Prazos
        deadlineDate: item.deadlineDate ? new Date(item.deadlineDate) : null,
        desiredDeliveryDate: item.desiredDeliveryDate ? new Date(item.desiredDeliveryDate) : null,
        // Competição
        hasCompetitors: item.hasCompetitors || false,
        competitorNames: item.competitorNames ? JSON.stringify(item.competitorNames) : null,
        isUrgentBid: item.isUrgentBid || false,
        // Priorização
        priority: item.priority,
        priorityReason: item.priorityReason || null,
        // Ações
        suggestedAction: item.suggestedAction || null,
        suggestedResponse: item.suggestedResponse || null,
        // Tags
        tags: item.tags ? JSON.stringify(item.tags) : null,
        // Confiança
        confidence: item.confidence,
        analyzedAt: new Date(),
      });
      savedCount++;
    } catch (error) {
      console.error(`[EmailRoutes] Erro ao salvar commercial item "${item.title}":`, error);
    }
  }

  console.log(
    `[EmailRoutes] Total de commercial items: ${savedCount} novos, ${skippedCount} já existentes`
  );
}

export const emailRoutes: FastifyPluginAsync = async (app) => {
  // Lista todos os emails classificados do usuário
  app.get('/', { preHandler: [authMiddleware] }, async (request) => {
    const userId = request.user!.id;
    const db = getDb();

    if (!db) {
      return { emails: [], fromCache: true };
    }

    try {
      const query = request.query as { priority?: string; limit?: string; offset?: string };
      const limit = parseInt(query.limit || '1000');
      const offset = parseInt(query.offset || '0');

      const conditions = [eq(classifiedEmails.userId, userId)];
      
      if (query.priority) {
        conditions.push(eq(classifiedEmails.priority, query.priority));
      }

      const queryBuilder = db
        .select()
        .from(classifiedEmails)
        .where(and(...conditions));

      const dbEmails = await queryBuilder
        .orderBy(desc(classifiedEmails.emailDate))
        .limit(limit)
        .offset(offset);

      // Transforma para o formato esperado pelo frontend
      const emails = dbEmails.map((email) => ({
        id: email.emailId,
        threadId: email.threadId,
        from: {
          name: email.fromName || '',
          email: email.fromEmail,
        },
        to: email.toEmails ? JSON.parse(email.toEmails) : [],
        cc: email.ccEmails ? JSON.parse(email.ccEmails) : [],
        subject: email.subject || '',
        snippet: email.snippet || '',
        body: email.body || '',
        date: email.emailDate?.toISOString() || '',
        hasAttachments: email.hasAttachments,
        isRead: email.isRead || false,
        isArchived: email.isArchived || false,
        classification: {
          priority: email.priority,
          action: email.action,
          confidence: email.confidence || 0,
          reasoning: email.reasoning || '',
          suggestedResponse: email.suggestedResponse,
          tags: email.tags ? JSON.parse(email.tags) : [],
          sentiment: email.sentiment || 'neutral',
          isDirectedToMe: email.isDirectedToMe || false,
          requiresAction: email.requiresAction || false,
          deadline: email.deadline,
        },
        classifiedAt: email.classifiedAt?.toISOString(),
      }));

      return {
        emails,
        total: emails.length,
        fromDatabase: true,
      };
    } catch (error) {
      console.error('[EmailRoutes] Erro ao buscar emails:', error);
      return { emails: [], fromCache: true };
    }
  });

  // Busca emails e classifica
  app.post('/fetch', { preHandler: [authMiddleware] }, async (request, reply) => {
    const userId = request.user!.id;
    const agentManager = getAgentManager();

    try {
      // Força execução do agente do usuário
      await agentManager.runAgentOnce(userId, 'email');

      return {
        success: true,
        message: 'Emails sendo processados',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      return reply.status(500).send({ error: message });
    }
  });

  // Estatísticas de emails do usuário
  app.get('/stats', { preHandler: [authMiddleware] }, async (request) => {
    const userId = request.user!.id;
    const db = getDb();

    if (!db) {
      return { totalProcessed: 0, byPriority: {}, lastRun: null };
    }

    try {
      // Conta por prioridade
      const stats = await db
        .select({
          priority: classifiedEmails.priority,
          count: sql<number>`count(*)::int`,
        })
        .from(classifiedEmails)
        .where(eq(classifiedEmails.userId, userId))
        .groupBy(classifiedEmails.priority);

      const byPriority: Record<string, number> = {};
      let total = 0;
      for (const stat of stats) {
        byPriority[stat.priority] = stat.count;
        total += stat.count;
      }

      // Pega a data do último email classificado
      const lastEmail = await db
        .select({ classifiedAt: classifiedEmails.classifiedAt })
        .from(classifiedEmails)
        .where(eq(classifiedEmails.userId, userId))
        .orderBy(desc(classifiedEmails.classifiedAt))
        .limit(1);

      return {
        totalProcessed: total,
        byPriority,
        lastRun: lastEmail[0]?.classifiedAt?.toISOString() || null,
      };
    } catch (error) {
      console.error('[EmailRoutes] Erro ao buscar stats:', error);
      return { totalProcessed: 0, byPriority: {}, lastRun: null };
    }
  });

  // Emails urgentes do usuário
  app.get('/urgent', { preHandler: [authMiddleware] }, async (request) => {
    const userId = request.user!.id;
    const db = getDb();

    if (!db) {
      return { emails: [] };
    }

    try {
      const urgent = await db
        .select()
        .from(classifiedEmails)
        .where(and(eq(classifiedEmails.userId, userId), eq(classifiedEmails.priority, 'urgent')))
        .orderBy(desc(classifiedEmails.emailDate))
        .limit(50);

      return { emails: urgent };
    } catch (error) {
      console.error('[EmailRoutes] Erro ao buscar urgentes:', error);
      return { emails: [] };
    }
  });

  // Emails que precisam de resposta
  app.get('/needs-response', { preHandler: [authMiddleware] }, async (request) => {
    const userId = request.user!.id;
    const db = getDb();

    if (!db) {
      return { emails: [] };
    }

    try {
      const needsResponse = await db
        .select()
        .from(classifiedEmails)
        .where(
          and(eq(classifiedEmails.userId, userId), eq(classifiedEmails.requiresAction, true))
        )
        .orderBy(desc(classifiedEmails.emailDate))
        .limit(50);

      return { emails: needsResponse };
    } catch (error) {
      console.error('[EmailRoutes] Erro ao buscar emails:', error);
      return { emails: [] };
    }
  });

  // Marca um email específico como lido
  app.post<{ Params: { emailId: string } }>(
    '/:emailId/mark-read',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const userId = request.user!.id;
      const { emailId } = request.params;

      const db = getDb();
      if (!db) {
        return reply.status(500).send({ error: 'Banco de dados não disponível' });
      }

      try {
        // Busca tokens do usuário
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user?.gmailTokens) {
          // Se não tem Gmail conectado, apenas atualiza no banco local
          await db
            .update(classifiedEmails)
            .set({ isRead: true })
            .where(
              and(
                eq(classifiedEmails.emailId, emailId),
                eq(classifiedEmails.userId, userId)
              )
            );

          return { success: true, message: 'Email marcado como lido (local)' };
        }

        // Importa o GmailClient e marca no Gmail
        const { GmailClient } = await import('@agent-hub/email-agent');
        const globalConfig = await loadGlobalConfig();

        process.env.GMAIL_CLIENT_ID = globalConfig.gmail.clientId;
        process.env.GMAIL_CLIENT_SECRET = globalConfig.gmail.clientSecret;

        const gmailClient = new GmailClient();
        // Usa tokens do banco de dados
        await gmailClient.initializeWithTokens(user.gmailTokens as Record<string, unknown>);

        await gmailClient.markAsRead(emailId);

        // Atualiza no banco também
        await db
          .update(classifiedEmails)
          .set({ isRead: true })
          .where(
            and(
              eq(classifiedEmails.emailId, emailId),
              eq(classifiedEmails.userId, userId)
            )
          );

        return { success: true, message: 'Email marcado como lido' };
      } catch (error) {
        console.error('[EmailRoutes] Erro ao marcar como lido:', error);
        return reply.status(500).send({
          error: error instanceof Error ? error.message : 'Erro ao marcar email',
        });
      }
    }
  );

  // Marca emails como lidos por prioridade
  app.post<{ Body: { priority: string } }>(
    '/mark-read',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const userId = request.user!.id;
      const { priority } = request.body || {};

      if (!priority) {
        return reply.status(400).send({ error: 'Prioridade é obrigatória' });
      }

      const db = getDb();
      if (!db) {
        return reply.status(500).send({ error: 'Banco de dados não disponível' });
      }

      try {
        // Busca emails da prioridade que NÃO estão marcados como lidos
        const emails = await db
          .select({ emailId: classifiedEmails.emailId })
          .from(classifiedEmails)
          .where(
            sql`${classifiedEmails.userId} = ${userId} AND ${classifiedEmails.priority} = ${priority} AND ${classifiedEmails.isRead} = false`
          );

        if (emails.length === 0) {
          return { success: true, message: 'Nenhum email para marcar', count: 0 };
        }

        // Busca tokens do usuário para acessar Gmail
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user?.gmailTokens) {
          return reply.status(400).send({ error: 'Gmail não conectado' });
        }

        // Importa o GmailClient
        const { GmailClient } = await import('@agent-hub/email-agent');
        const globalConfig = await loadGlobalConfig();

        // Configura variáveis de ambiente
        process.env.GMAIL_CLIENT_ID = globalConfig.gmail.clientId;
        process.env.GMAIL_CLIENT_SECRET = globalConfig.gmail.clientSecret;

        const gmailClient = new GmailClient();
        // Usa tokens do banco de dados
        await gmailClient.initializeWithTokens(user.gmailTokens as Record<string, unknown>);

        let markedCount = 0;
        const errors: string[] = [];

        for (const email of emails) {
          try {
            await gmailClient.markAsRead(email.emailId);

            // Atualiza no banco também
            await db
              .update(classifiedEmails)
              .set({ isRead: true })
              .where(
                and(
                  eq(classifiedEmails.emailId, email.emailId),
                  eq(classifiedEmails.userId, userId)
                )
              );

            markedCount++;
          } catch (error) {
            const errMsg = `${email.emailId}: ${error instanceof Error ? error.message : 'Erro'}`;
            errors.push(errMsg);
          }
        }

        return {
          success: true,
          message: `${markedCount} emails marcados como lidos`,
          count: markedCount,
          total: emails.length,
          errors: errors.length > 0 ? errors : undefined,
        };
      } catch (error) {
        console.error('[EmailRoutes] Erro ao marcar como lidos:', error);
        return reply
          .status(500)
          .send({ error: error instanceof Error ? error.message : 'Erro ao marcar emails' });
      }
    }
  );

  // Arquiva emails por prioridade
  app.post<{ Body: { priority: string } }>(
    '/archive',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const userId = request.user!.id;
      const { priority } = request.body || {};

      if (!priority) {
        return reply.status(400).send({ error: 'Prioridade é obrigatória' });
      }

      const db = getDb();
      if (!db) {
        return reply.status(500).send({ error: 'Banco de dados não disponível' });
      }

      try {
        // Busca emails da prioridade
        const emails = await db
          .select({ emailId: classifiedEmails.emailId })
          .from(classifiedEmails)
          .where(
            and(eq(classifiedEmails.userId, userId), eq(classifiedEmails.priority, priority))
          );

        if (emails.length === 0) {
          return { success: true, message: 'Nenhum email para arquivar', count: 0 };
        }

        // Busca tokens do usuário
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user?.gmailTokens) {
          return reply.status(400).send({ error: 'Gmail não conectado' });
        }

        // Importa o GmailClient
        const { GmailClient } = await import('@agent-hub/email-agent');
        const globalConfig = await loadGlobalConfig();

        process.env.GMAIL_CLIENT_ID = globalConfig.gmail.clientId;
        process.env.GMAIL_CLIENT_SECRET = globalConfig.gmail.clientSecret;

        const gmailClient = new GmailClient();
        // Usa tokens do banco de dados
        await gmailClient.initializeWithTokens(user.gmailTokens as Record<string, unknown>);

        let archivedCount = 0;

        for (const email of emails) {
          try {
            await gmailClient.archive(email.emailId);
            archivedCount++;

            // Atualiza no banco
            await db
              .update(classifiedEmails)
              .set({ isArchived: true, isRead: true })
              .where(
                and(
                  eq(classifiedEmails.emailId, email.emailId),
                  eq(classifiedEmails.userId, userId)
                )
              );
          } catch (error) {
            console.error(`Erro ao arquivar ${email.emailId}:`, error);
          }
        }

        return {
          success: true,
          message: `${archivedCount} emails arquivados`,
          count: archivedCount,
        };
      } catch (error) {
        console.error('[EmailRoutes] Erro ao arquivar:', error);
        return reply.status(500).send({
          error: error instanceof Error ? error.message : 'Erro ao arquivar emails',
        });
      }
    }
  );

  // Responder a um email
  app.post<{
    Body: {
      emailId: string;
      to: string;
      subject: string;
      body: string;
    };
  }>('/reply', { preHandler: [authMiddleware] }, async (request, reply) => {
    const userId = request.user!.id;

    try {
      const { emailId, to, subject, body } = request.body;

      if (!to || !subject || !body) {
        return reply.status(400).send({
          error: 'Campos obrigatórios: to, subject, body',
        });
      }

      const db = getDb();
      if (!db) {
        return reply.status(500).send({ error: 'Banco de dados não disponível' });
      }

      // Busca tokens do usuário
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user?.gmailTokens) {
        return reply.status(400).send({ error: 'Gmail não conectado' });
      }

      // Importa o GmailClient
      const { GmailClient } = await import('@agent-hub/email-agent');
      const globalConfig = await loadGlobalConfig();

      process.env.GMAIL_CLIENT_ID = globalConfig.gmail.clientId;
      process.env.GMAIL_CLIENT_SECRET = globalConfig.gmail.clientSecret;

      const gmailClient = new GmailClient();
      // Usa tokens do banco de dados
      await gmailClient.initializeWithTokens(user.gmailTokens as Record<string, unknown>);

      // Envia o email
      await gmailClient.sendEmail({
        to,
        subject,
        body,
        threadId: emailId,
      });

      // Marca como lido
      try {
        await gmailClient.markAsRead(emailId);
        await db
          .update(classifiedEmails)
          .set({ isRead: true })
          .where(
            and(eq(classifiedEmails.emailId, emailId), eq(classifiedEmails.userId, userId))
          );
      } catch {
        // Ignora erros ao marcar como lido
      }

      return {
        success: true,
        message: 'Email enviado e marcado como lido',
      };
    } catch (error) {
      console.error('[EmailRoutes] Erro ao enviar email:', error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Erro ao enviar email',
      });
    }
  });
};

// Exporta funções helper para uso em outros lugares
export { saveEmailsToDatabase, saveLegalAnalysesToDatabase, saveFinancialItemsToDatabase, saveActionItemsToDatabase, saveCommercialItemsToDatabase };
