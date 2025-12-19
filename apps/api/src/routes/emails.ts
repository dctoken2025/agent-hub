import type { FastifyPluginAsync } from 'fastify';
import { getScheduler } from '@agent-hub/core';
import { getDb, classifiedEmails, agentLogs, legalAnalyses } from '../db/index.js';
import { eq, desc, sql } from 'drizzle-orm';
import type { EmailAgentResult, ClassifiedEmail, ContractAnalysis } from '@agent-hub/email-agent';

// Cache simples para resultados recentes
let lastResult: EmailAgentResult | null = null;

// Registra listener para eventos do agente de email
const scheduler = getScheduler();
scheduler.onEvent(async (event) => {
  if (event.agentId === 'email-agent' && event.type === 'completed') {
    const result = event.details?.result as { data?: EmailAgentResult };
    if (result?.data) {
      lastResult = result.data;
      console.log('[EmailRoutes] Resultado atualizado:', {
        processedCount: lastResult.processedCount,
        classifications: lastResult.classifications,
      });

      // Salva emails no banco de dados
      await saveEmailsToDatabase(lastResult.emails);
      
      // Salva análises jurídicas se existirem
      if (lastResult.legalAnalyses && lastResult.legalAnalyses.length > 0) {
        await saveLegalAnalysesToDatabase(lastResult.legalAnalyses);
      }
      
      // Salva log de execução
      await saveAgentLog('email-agent', 'Email Agent', true, lastResult);
    }
  }
  
  // Log de qualquer evento de agente
  if (event.type === 'failed') {
    await saveAgentLog(event.agentId, event.agentId, false, null, event.details?.error as string);
  }
});

// Salva log de execução do agente
async function saveAgentLog(
  agentId: string, 
  agentName: string, 
  success: boolean, 
  result?: EmailAgentResult | null,
  errorMessage?: string
): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    await db.insert(agentLogs).values({
      agentId,
      agentName,
      eventType: success ? 'completed' : 'failed',
      success,
      duration: result?.processedCount ? result.processedCount * 100 : 0, // estimativa
      processedCount: result?.processedCount || 0,
      details: result ? {
        classifications: result.classifications,
        contractsDetected: result.contractsDetected || 0,
      } : null,
      errorMessage,
      createdAt: new Date(),
    });
    console.log(`[EmailRoutes] Log do agente ${agentId} salvo`);
  } catch (error) {
    console.error('[EmailRoutes] Erro ao salvar log:', error);
  }
}

// Função para salvar emails no banco
async function saveEmailsToDatabase(emails: ClassifiedEmail[]): Promise<void> {
  const db = getDb();
  if (!db) {
    console.log('[EmailRoutes] Banco não disponível para salvar emails');
    return;
  }

  let savedCount = 0;
  let skippedCount = 0;

  for (const email of emails) {
    try {
      // Verifica se já existe
      const existing = await db.select()
        .from(classifiedEmails)
        .where(eq(classifiedEmails.emailId, email.id))
        .limit(1);

      if (existing.length > 0) {
        // Atualiza classificação
        await db.update(classifiedEmails)
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
          emailId: email.id,
          threadId: email.threadId,
          fromEmail: email.from.email,
          fromName: email.from.name,
          toEmails: JSON.stringify(email.to),
          ccEmails: JSON.stringify(email.cc),
          subject: email.subject,
          snippet: email.snippet,
          body: email.body.substring(0, 10000), // Limita tamanho
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

// Função para salvar análises jurídicas no banco
async function saveLegalAnalysesToDatabase(analyses: ContractAnalysis[]): Promise<void> {
  const db = getDb();
  if (!db) {
    console.log('[EmailRoutes] Banco não disponível para salvar análises jurídicas');
    return;
  }

  let savedCount = 0;
  let skippedCount = 0;

  for (const analysis of analyses) {
    try {
      // Verifica se já existe uma análise para este documento e email
      const existing = await db.select()
        .from(legalAnalyses)
        .where(eq(legalAnalyses.documentName, analysis.documentName))
        .limit(1);

      if (existing.length > 0) {
        // Já existe, pula para evitar duplicata
        console.log(`[EmailRoutes] ⏭️ Análise já existe: ${analysis.documentName} (ID: ${existing[0].id})`);
        skippedCount++;
        continue;
      }

      await db.insert(legalAnalyses).values({
        emailId: analysis.emailId || 'unknown',
        threadId: analysis.threadId || null, // Thread para agrupar análises relacionadas
        documentName: analysis.documentName,
        documentType: analysis.documentType,
        // parties pode ser array ou string, serializa para texto
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
        // Novos campos para ações e responsáveis
        requiredAction: analysis.requiredAction || 'review',
        actionDescription: analysis.actionDescription || '',
        responsibleParties: analysis.responsibleParties || [],
        actionDeadline: analysis.actionDeadline,
        isUrgent: analysis.isUrgent || false,
        nextSteps: analysis.nextSteps || [],
      });
      savedCount++;
      const actionEmoji = analysis.requiredAction === 'sign' ? '✍️' : 
                          analysis.requiredAction === 'approve' ? '✅' :
                          analysis.requiredAction === 'review' ? '👀' :
                          analysis.requiredAction === 'negotiate' ? '🤝' :
                          analysis.requiredAction === 'reject' ? '❌' : '📄';
      console.log(`[EmailRoutes] ${actionEmoji} Análise salva: ${analysis.documentName} | Risco: ${analysis.overallRisk} | Ação: ${analysis.requiredAction || 'N/A'}`);
    } catch (error) {
      console.error(`[EmailRoutes] Erro ao salvar análise ${analysis.documentName}:`, error);
    }
  }

  console.log(`[EmailRoutes] Total de análises jurídicas: ${savedCount} novas, ${skippedCount} já existentes (ignoradas)`);
}

export const emailRoutes: FastifyPluginAsync = async (app) => {

  // Lista todos os emails classificados do banco
  app.get('/', async (request) => {
    const db = getDb();
    if (!db) {
      return { emails: lastResult?.emails || [], fromCache: true };
    }

    try {
      const query = request.query as { priority?: string; limit?: string; offset?: string };
      const limit = parseInt(query.limit || '1000');
      const offset = parseInt(query.offset || '0');

      let queryBuilder = db.select().from(classifiedEmails);

      if (query.priority) {
        queryBuilder = queryBuilder.where(eq(classifiedEmails.priority, query.priority)) as typeof queryBuilder;
      }

      const dbEmails = await queryBuilder
        .orderBy(desc(classifiedEmails.emailDate))
        .limit(limit)
        .offset(offset);

      // Transforma para o formato esperado pelo frontend
      const emails = dbEmails.map(email => ({
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
      return { emails: lastResult?.emails || [], fromCache: true };
    }
  });

  // Busca emails e classifica
  app.post('/fetch', async (_request, reply) => {
    const agentInfo = scheduler.getAgent('email-agent');
    if (!agentInfo) {
      return reply.status(404).send({ error: 'Email Agent não encontrado' });
    }

    try {
      // Força execução do agente
      await scheduler.runOnce('email-agent');
      
      return {
        success: true,
        message: 'Emails sendo processados',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      return reply.status(500).send({ error: message });
    }
  });

  // Estatísticas de emails
  app.get('/stats', async () => {
    const db = getDb();
    
    if (!db) {
      if (!lastResult) {
        return { totalProcessed: 0, byPriority: {}, lastRun: null };
      }
      return {
        totalProcessed: lastResult.processedCount,
        byPriority: lastResult.classifications,
        lastRun: new Date().toISOString(),
      };
    }

    try {
      // Conta por prioridade
      const stats = await db.select({
        priority: classifiedEmails.priority,
        count: sql<number>`count(*)::int`,
      })
        .from(classifiedEmails)
        .groupBy(classifiedEmails.priority);

      const byPriority: Record<string, number> = {};
      let total = 0;
      for (const stat of stats) {
        byPriority[stat.priority] = stat.count;
        total += stat.count;
      }

      // Pega a data do último email classificado
      const lastEmail = await db.select({ classifiedAt: classifiedEmails.classifiedAt })
        .from(classifiedEmails)
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

  // Emails urgentes
  app.get('/urgent', async () => {
    const db = getDb();
    
    if (!db) {
      const urgent = lastResult?.emails.filter(
        e => e.classification.priority === 'urgent'
      ) || [];
      return { emails: urgent };
    }

    try {
      const urgent = await db.select()
        .from(classifiedEmails)
        .where(eq(classifiedEmails.priority, 'urgent'))
        .orderBy(desc(classifiedEmails.emailDate))
        .limit(50);

      return { emails: urgent };
    } catch (error) {
      console.error('[EmailRoutes] Erro ao buscar urgentes:', error);
      return { emails: [] };
    }
  });

  // Emails que precisam de resposta
  app.get('/needs-response', async () => {
    const db = getDb();
    
    if (!db) {
      const needsResponse = lastResult?.emails.filter(
        e => e.classification.requiresAction && 
             ['respond_now', 'respond_later'].includes(e.classification.action)
      ) || [];
      return { emails: needsResponse };
    }

    try {
      const needsResponse = await db.select()
        .from(classifiedEmails)
        .where(eq(classifiedEmails.requiresAction, true))
        .orderBy(desc(classifiedEmails.emailDate))
        .limit(50);

      return { emails: needsResponse };
    } catch (error) {
      console.error('[EmailRoutes] Erro ao buscar emails:', error);
      return { emails: [] };
    }
  });

  // Webhook para receber resultados do agente (interno)
  app.post('/results', async (request) => {
    lastResult = request.body as EmailAgentResult;
    return { success: true };
  });

  // Marca emails como lidos por prioridade
  app.post<{ Body: { priority: string } }>('/mark-read', async (request, reply) => {
    console.log('[EmailRoutes] POST /mark-read - Body:', JSON.stringify(request.body));
    
    const { priority } = request.body || {};
    
    if (!priority) {
      console.log('[EmailRoutes] Erro: Prioridade não fornecida');
      return reply.status(400).send({ error: 'Prioridade é obrigatória' });
    }

    console.log(`[EmailRoutes] Marcando emails como lidos - Prioridade: ${priority}`);

    const db = getDb();
    if (!db) {
      console.log('[EmailRoutes] Erro: Banco de dados não disponível');
      return reply.status(500).send({ error: 'Banco de dados não disponível' });
    }

    try {
      // Busca emails da prioridade que NÃO estão marcados como lidos
      console.log(`[EmailRoutes] Buscando emails não lidos com prioridade "${priority}"...`);
      const emails = await db.select({ emailId: classifiedEmails.emailId })
        .from(classifiedEmails)
        .where(sql`${classifiedEmails.priority} = ${priority} AND ${classifiedEmails.isRead} = false`);

      console.log(`[EmailRoutes] Encontrados ${emails.length} emails não lidos`);

      if (emails.length === 0) {
        return { success: true, message: 'Nenhum email para marcar', count: 0 };
      }

      // Importa o GmailClient dinamicamente para marcar como lido
      console.log('[EmailRoutes] Inicializando GmailClient...');
      const { GmailClient } = await import('@agent-hub/email-agent');
      const gmailClient = new GmailClient();
      await gmailClient.initialize();
      console.log('[EmailRoutes] GmailClient inicializado');

      let markedCount = 0;
      const errors: string[] = [];

      for (const email of emails) {
        try {
          console.log(`[EmailRoutes] Marcando email ${email.emailId} como lido no Gmail...`);
          await gmailClient.markAsRead(email.emailId);
          console.log(`[EmailRoutes] ✅ Gmail: email ${email.emailId} marcado como lido`);
          
          // Atualiza no banco também
          await db.update(classifiedEmails)
            .set({ isRead: true })
            .where(eq(classifiedEmails.emailId, email.emailId));
          console.log(`[EmailRoutes] ✅ Banco: email ${email.emailId} atualizado`);
          
          markedCount++;
        } catch (error) {
          const errMsg = `${email.emailId}: ${error instanceof Error ? error.message : 'Erro'}`;
          console.error(`[EmailRoutes] ❌ Erro ao marcar email: ${errMsg}`);
          errors.push(errMsg);
        }
      }

      console.log(`[EmailRoutes] ✅ Marcados como lidos: ${markedCount}/${emails.length} emails de prioridade "${priority}"`);

      return { 
        success: true, 
        message: `${markedCount} emails marcados como lidos`,
        count: markedCount,
        total: emails.length,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      console.error('[EmailRoutes] ❌ Erro ao marcar como lidos:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao marcar emails';
      return reply.status(500).send({ error: errorMessage });
    }
  });

  // Arquiva emails por prioridade
  app.post<{ Body: { priority: string } }>('/archive', async (request, reply) => {
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
      const emails = await db.select({ emailId: classifiedEmails.emailId })
        .from(classifiedEmails)
        .where(eq(classifiedEmails.priority, priority));

      if (emails.length === 0) {
        return { success: true, message: 'Nenhum email para arquivar', count: 0 };
      }

      // Importa o GmailClient
      const { GmailClient } = await import('@agent-hub/email-agent');
      const gmailClient = new GmailClient();
      await gmailClient.initialize();

      let archivedCount = 0;

      for (const email of emails) {
        try {
          await gmailClient.archive(email.emailId);
          archivedCount++;
          
          // Atualiza no banco
          await db.update(classifiedEmails)
            .set({ isArchived: true, isRead: true })
            .where(eq(classifiedEmails.emailId, email.emailId));
        } catch (error) {
          console.error(`Erro ao arquivar ${email.emailId}:`, error);
        }
      }

      console.log(`[EmailRoutes] Arquivados: ${archivedCount}/${emails.length} emails de prioridade "${priority}"`);

      return { 
        success: true, 
        message: `${archivedCount} emails arquivados`,
        count: archivedCount,
      };
    } catch (error) {
      console.error('[EmailRoutes] Erro ao arquivar:', error);
      return reply.status(500).send({ 
        error: error instanceof Error ? error.message : 'Erro ao arquivar emails' 
      });
    }
  });

  // Reprocessa emails com anexos usando o Legal Agent
  app.post<{ Body: { emailId?: string; limit?: number } }>('/reprocess-contracts', async (request, reply) => {
    const db = getDb();
    if (!db) {
      return reply.status(500).send({ error: 'Banco de dados não disponível' });
    }

    const { emailId, limit = 5 } = request.body || {};

    try {
      console.log('[EmailRoutes] 📜 Iniciando reprocessamento de contratos...');
      
      // Importa dependências
      const { GmailClient } = await import('@agent-hub/email-agent');
      const { LegalAgent } = await import('@agent-hub/legal-agent');
      
      const gmailClient = new GmailClient();
      await gmailClient.initialize();

      // Configura Legal Agent
      const legalConfig = {
        supportedMimeTypes: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
        ],
        maxDocumentSize: 10 * 1024 * 1024,
        contractKeywords: ['contrato', 'acordo', 'termo', 'aditivo', 'minuta'],
      };

      const legalAgent = new LegalAgent(
        { id: 'legal-agent-reprocess', name: 'Legal Agent Reprocess', description: '', enabled: true },
        legalConfig
      );

      // Busca emails com anexos
      let query;
      if (emailId) {
        query = db.select()
          .from(classifiedEmails)
          .where(eq(classifiedEmails.emailId, emailId));
      } else {
        query = db.select()
          .from(classifiedEmails)
          .where(eq(classifiedEmails.hasAttachments, true))
          .orderBy(desc(classifiedEmails.emailDate))
          .limit(limit);
      }

      const emailsToProcess = await query;
      console.log(`[EmailRoutes] 📧 Emails para reprocessar: ${emailsToProcess.length}`);

      const results: Array<{
        emailId: string;
        subject: string;
        attachmentsProcessed: number;
        analysesGenerated: number;
        errors: string[];
      }> = [];

      for (const email of emailsToProcess) {
        console.log(`[EmailRoutes] 🔄 Processando: ${email.subject}`);
        
        const emailResult = {
          emailId: email.emailId,
          subject: email.subject || '',
          attachmentsProcessed: 0,
          analysesGenerated: 0,
          errors: [] as string[],
        };

        try {
          // Busca detalhes do email no Gmail para pegar anexos
          const gmailEmail = await gmailClient.getEmailDetails(email.emailId);
          
          if (!gmailEmail || !gmailEmail.attachments || gmailEmail.attachments.length === 0) {
            emailResult.errors.push('Sem anexos encontrados no Gmail');
            results.push(emailResult);
            continue;
          }

          console.log(`[EmailRoutes] 📎 Anexos: ${gmailEmail.attachments.length}`);
          gmailEmail.attachments.forEach((att, i) => {
            console.log(`[EmailRoutes]    ${i + 1}. ${att.filename} (${att.mimeType})`);
          });

          // Baixa anexos
          const attachmentsWithContent = [];
          for (const att of gmailEmail.attachments) {
            try {
              if (!att.id) continue;
              
              console.log(`[EmailRoutes] 📥 Baixando: ${att.filename}...`);
              const content = await gmailClient.getAttachmentContent(email.emailId, att.id);
              console.log(`[EmailRoutes] ✅ Baixado: ${content.length} bytes`);
              
              attachmentsWithContent.push({
                ...att,
                content,
              });
              emailResult.attachmentsProcessed++;
            } catch (error) {
              const errMsg = `Erro ao baixar ${att.filename}: ${error instanceof Error ? error.message : 'erro'}`;
              console.error(`[EmailRoutes] ❌ ${errMsg}`);
              emailResult.errors.push(errMsg);
            }
          }

          if (attachmentsWithContent.length === 0) {
            emailResult.errors.push('Nenhum anexo baixado com sucesso');
            results.push(emailResult);
            continue;
          }

          // Envia para Legal Agent
          console.log(`[EmailRoutes] 📜 Enviando ${attachmentsWithContent.length} anexo(s) para Legal Agent...`);
          const legalResult = await legalAgent.runOnce({
            emailId: email.emailId,
            threadId: email.threadId || undefined, // Para agrupar análises relacionadas
            emailSubject: email.subject || '',
            emailBody: email.body || '',
            attachments: attachmentsWithContent,
          });

          if (legalResult.success && legalResult.data) {
            emailResult.analysesGenerated = legalResult.data.analyses.length;
            console.log(`[EmailRoutes] ✅ Análises geradas: ${emailResult.analysesGenerated}`);

            // Salva análises no banco
            if (legalResult.data.analyses.length > 0) {
              await saveLegalAnalysesToDatabase(legalResult.data.analyses);
            }
          } else {
            emailResult.errors.push(legalResult.error || 'Legal Agent retornou sem sucesso');
          }

        } catch (error) {
          const errMsg = error instanceof Error ? error.message : 'Erro desconhecido';
          emailResult.errors.push(errMsg);
          console.error(`[EmailRoutes] ❌ Erro: ${errMsg}`);
        }

        results.push(emailResult);
      }

      const totalAnalyses = results.reduce((sum, r) => sum + r.analysesGenerated, 0);
      console.log(`[EmailRoutes] ✅ Reprocessamento concluído: ${totalAnalyses} análises geradas`);

      return {
        success: true,
        emailsProcessed: results.length,
        totalAnalysesGenerated: totalAnalyses,
        results,
      };

    } catch (error) {
      console.error('[EmailRoutes] ❌ Erro no reprocessamento:', error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Erro ao reprocessar',
      });
    }
  });

  // Processa emails não lidos do Gmail
  app.post<{ Body: { limit?: number; processContracts?: boolean } }>('/process-unread', async (request, reply) => {
    const { limit = 50, processContracts = true } = request.body || {};

    try {
      console.log('[EmailRoutes] 📬 Iniciando processamento de emails não lidos...');
      console.log(`[EmailRoutes] Limite: ${limit}, Processar contratos: ${processContracts}`);
      
      // Importa dependências
      const { GmailClient, EmailClassifier } = await import('@agent-hub/email-agent');
      const { LegalAgent } = await import('@agent-hub/legal-agent');
      
      const gmailClient = new GmailClient();
      await gmailClient.initialize();

      // Obtém ou cria o label para marcar emails processados
      const PROCESSED_LABEL_NAME = 'AgentHub-Processado';
      const processedLabelId = await gmailClient.getOrCreateLabel(PROCESSED_LABEL_NAME);
      console.log(`[EmailRoutes] Label "${PROCESSED_LABEL_NAME}" configurado`);

      // Busca emails não lidos E que não tenham o label de processado
      console.log('[EmailRoutes] 🔍 Buscando emails não lidos (sem label de processado)...');
      let allUnreadEmails: any[] = [];
      let pageToken: string | undefined;
      const maxToFetch = Math.min(limit * 3, 300);
      
      while (allUnreadEmails.length < maxToFetch) {
        const { emails: pageEmails, nextPageToken } = await gmailClient.getEmails({
          maxResults: 100,
          query: `is:unread -label:${PROCESSED_LABEL_NAME}`,
          pageToken,
        });
        
        allUnreadEmails.push(...pageEmails);
        
        if (!nextPageToken || pageEmails.length === 0) break;
        pageToken = nextPageToken;
      }

      console.log(`[EmailRoutes] 📧 Encontrados ${allUnreadEmails.length} emails não lidos sem label de processado`);

      if (allUnreadEmails.length === 0) {
        return {
          success: true,
          message: 'Nenhum email não lido encontrado',
          processed: 0,
          classified: 0,
          contractsAnalyzed: 0,
        };
      }

      // Filtra emails que já existem no banco
      const db = getDb();
      let unreadEmails = allUnreadEmails;
      
      if (db) {
        const existingIds = await db.select({ emailId: classifiedEmails.emailId })
          .from(classifiedEmails);
        const existingSet = new Set(existingIds.map(e => e.emailId));
        
        unreadEmails = allUnreadEmails.filter(e => !existingSet.has(e.id));
        console.log(`[EmailRoutes] 📧 ${allUnreadEmails.length - unreadEmails.length} já existem no banco, ${unreadEmails.length} novos para processar`);
        
        // Limita ao número solicitado
        unreadEmails = unreadEmails.slice(0, limit);
      }

      if (unreadEmails.length === 0) {
        return {
          success: true,
          message: 'Todos os emails não lidos já foram processados',
          processed: 0,
          classified: 0,
          contractsAnalyzed: 0,
        };
      }

      // Configura o classificador
      const classifier = new EmailClassifier({
        vipSenders: [],
        ignoreSenders: [],
        userEmail: process.env.GMAIL_USER_EMAIL || '',
        labelsToProcess: ['INBOX'],
        maxEmailsPerRun: limit,
        unreadOnly: true,
      });

      // Configura Legal Agent
      const legalConfig = {
        supportedMimeTypes: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
        ],
        maxDocumentSize: 10 * 1024 * 1024,
        contractKeywords: ['contrato', 'acordo', 'termo', 'aditivo', 'minuta', 'proposta'],
      };

      const legalAgent = new LegalAgent(
        { id: 'legal-agent-unread', name: 'Legal Agent Unread', description: '', enabled: true },
        legalConfig
      );

      // db já foi obtido acima
      let classifiedCount = 0;
      let contractsAnalyzed = 0;
      const results: Array<{
        emailId: string;
        subject: string;
        priority: string;
        hasAttachments: boolean;
        contractAnalyzed: boolean;
        analysesGenerated: number;
      }> = [];

      for (const email of unreadEmails) {
        console.log(`\n[EmailRoutes] 📧 Processando: ${email.subject?.substring(0, 50)}...`);

        try {
          // Classifica o email
          const classification = await classifier.classify(email);
          classifiedCount++;

          console.log(`[EmailRoutes] 📊 Classificado: ${classification.priority} | ${classification.action}`);

          const result = {
            emailId: email.id,
            subject: email.subject || '',
            priority: classification.priority,
            hasAttachments: email.hasAttachments || false,
            contractAnalyzed: false,
            analysesGenerated: 0,
          };

          // Salva no banco
          if (db) {
            try {
              const existing = await db.select()
                .from(classifiedEmails)
                .where(eq(classifiedEmails.emailId, email.id))
                .limit(1);

              if (existing.length === 0) {
                await db.insert(classifiedEmails).values({
                  emailId: email.id,
                  threadId: email.threadId,
                  fromEmail: email.from.email,
                  fromName: email.from.name,
                  toEmails: JSON.stringify(email.to),
                  ccEmails: JSON.stringify(email.cc),
                  subject: email.subject,
                  snippet: email.snippet,
                  body: email.body?.substring(0, 10000) || '',
                  priority: classification.priority,
                  action: classification.action,
                  confidence: classification.confidence,
                  reasoning: classification.reasoning,
                  suggestedResponse: classification.suggestedResponse,
                  tags: JSON.stringify(classification.tags),
                  sentiment: classification.sentiment,
                  isDirectedToMe: classification.isDirectedToMe,
                  requiresAction: classification.requiresAction,
                  deadline: classification.deadline,
                  emailDate: new Date(email.date),
                  classifiedAt: new Date(),
                  hasAttachments: email.hasAttachments || false,
                  isRead: false,
                });
                console.log(`[EmailRoutes] 💾 Email salvo no banco`);
              }
            } catch (dbError) {
              console.error(`[EmailRoutes] ⚠️ Erro ao salvar no banco:`, dbError);
            }
          }

          // Processa contratos se tiver anexos
          if (processContracts && email.hasAttachments && email.attachments && email.attachments.length > 0) {
            console.log(`[EmailRoutes] 📎 Email tem ${email.attachments.length} anexo(s)`);

            try {
              // Baixa anexos
              const attachmentsWithContent = [];
              for (const att of email.attachments) {
                if (!att.id) continue;
                
                // Verifica se é PDF ou DOCX
                const supportedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
                if (!supportedTypes.some(t => att.mimeType.includes(t) || att.mimeType.includes('pdf') || att.mimeType.includes('word'))) {
                  console.log(`[EmailRoutes] ⏭️ Ignorando anexo não suportado: ${att.filename} (${att.mimeType})`);
                  continue;
                }

                try {
                  console.log(`[EmailRoutes] 📥 Baixando: ${att.filename}...`);
                  const content = await gmailClient.getAttachmentContent(email.id, att.id);
                  console.log(`[EmailRoutes] ✅ Baixado: ${content.length} bytes`);
                  
                  attachmentsWithContent.push({
                    ...att,
                    content,
                  });
                } catch (dlError) {
                  console.error(`[EmailRoutes] ❌ Erro ao baixar ${att.filename}:`, dlError);
                }
              }

              if (attachmentsWithContent.length > 0) {
                console.log(`[EmailRoutes] 📜 Analisando ${attachmentsWithContent.length} documento(s)...`);

                const legalResult = await legalAgent.runOnce({
                  emailId: email.id,
                  threadId: email.threadId || undefined, // Para agrupar análises relacionadas
                  emailSubject: email.subject || '',
                  emailBody: email.body || '',
                  attachments: attachmentsWithContent,
                });

                if (legalResult.success && legalResult.data && legalResult.data.analyses.length > 0) {
                  result.contractAnalyzed = true;
                  result.analysesGenerated = legalResult.data.analyses.length;
                  contractsAnalyzed += legalResult.data.analyses.length;
                  
                  // Salva análises
                  await saveLegalAnalysesToDatabase(legalResult.data.analyses);
                  console.log(`[EmailRoutes] ✅ ${legalResult.data.analyses.length} análise(s) gerada(s)`);
                }
              }
            } catch (legalError) {
              console.error(`[EmailRoutes] ⚠️ Erro ao analisar contratos:`, legalError);
            }
          }

          results.push(result);

          // Adiciona label "AgentHub-Processado" para não processar novamente
          // NÃO marca como lido - mantém o estado original no Gmail
          try {
            await gmailClient.markAsProcessed(email.id, processedLabelId);
          } catch (labelError) {
            console.error(`[EmailRoutes] ⚠️ Erro ao adicionar label ao email ${email.id}`);
          }

        } catch (error) {
          console.error(`[EmailRoutes] ❌ Erro ao processar email ${email.id}:`, error);
          results.push({
            emailId: email.id,
            subject: email.subject || '',
            priority: 'unknown',
            hasAttachments: email.hasAttachments || false,
            contractAnalyzed: false,
            analysesGenerated: 0,
          });
        }
      }

      console.log(`\n[EmailRoutes] ✅ Processamento concluído!`);
      console.log(`[EmailRoutes] 📧 Emails processados: ${unreadEmails.length}`);
      console.log(`[EmailRoutes] 📊 Classificados: ${classifiedCount}`);
      console.log(`[EmailRoutes] 📜 Análises de contratos: ${contractsAnalyzed}`);

      return {
        success: true,
        message: `${unreadEmails.length} emails não lidos processados`,
        processed: unreadEmails.length,
        classified: classifiedCount,
        contractsAnalyzed,
        results,
      };

    } catch (error) {
      console.error('[EmailRoutes] ❌ Erro ao processar emails não lidos:', error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Erro ao processar emails não lidos',
      });
    }
  });

  // Responder a um email
  app.post<{
    Body: {
      emailId: string;
      to: string;
      subject: string;
      body: string;
    };
  }>('/reply', async (request, reply) => {
    try {
      const { emailId, to, subject, body } = request.body;

      if (!to || !subject || !body) {
        return reply.status(400).send({
          error: 'Campos obrigatórios: to, subject, body',
        });
      }

      console.log(`[EmailRoutes] 📤 Enviando resposta para: ${to}`);
      console.log(`[EmailRoutes] 📝 Assunto: ${subject}`);

      // Importa o GmailClient dinamicamente
      const { GmailClient } = await import('@agent-hub/email-agent');
      const gmailClient = new GmailClient();
      await gmailClient.initialize();

      // Envia o email
      await gmailClient.sendEmail({
        to,
        subject,
        body,
        threadId: emailId, // Mantém na mesma thread
      });

      console.log(`[EmailRoutes] ✅ Email enviado com sucesso!`);

      // Marca como lido no Gmail
      try {
        console.log(`[EmailRoutes] 📖 Marcando email ${emailId} como lido no Gmail...`);
        await gmailClient.markAsRead(emailId);
        console.log(`[EmailRoutes] ✅ Gmail: email marcado como lido`);
      } catch (markError) {
        console.error(`[EmailRoutes] ⚠️ Não foi possível marcar como lido no Gmail:`, markError);
      }

      // Marca como lido no banco
      const db = getDb();
      if (db) {
        try {
          await db.update(classifiedEmails)
            .set({ isRead: true })
            .where(eq(classifiedEmails.emailId, emailId));
          console.log(`[EmailRoutes] ✅ Banco: email marcado como lido`);
        } catch (dbError) {
          console.error(`[EmailRoutes] ⚠️ Não foi possível atualizar no banco:`, dbError);
        }
      }

      return {
        success: true,
        message: 'Email enviado e marcado como lido',
      };

    } catch (error) {
      console.error('[EmailRoutes] ❌ Erro ao enviar email:', error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Erro ao enviar email',
      });
    }
  });

  // Sincroniza emails que estão marcados no Gmail mas não estão no banco
  app.post<{ Body: { limit?: number } }>('/sync-from-gmail', async (request, reply) => {
    const { limit = 100 } = request.body || {};

    try {
      console.log('[EmailRoutes] 🔄 Iniciando sincronização do Gmail...');
      console.log(`[EmailRoutes] Limite: ${limit} emails`);
      
      const { GmailClient, EmailClassifier } = await import('@agent-hub/email-agent');
      
      const gmailClient = new GmailClient();
      await gmailClient.initialize();

      const PROCESSED_LABEL_NAME = 'AgentHub-Processado';
      
      // Busca emails COM a label de processado (já foram processados no Gmail)
      console.log('[EmailRoutes] 🔍 Buscando emails com label AgentHub-Processado no Gmail...');
      let allProcessedEmails: any[] = [];
      let pageToken: string | undefined;
      
      while (allProcessedEmails.length < limit) {
        const { emails: pageEmails, nextPageToken } = await gmailClient.getEmails({
          maxResults: 100,
          query: `label:${PROCESSED_LABEL_NAME}`,
          pageToken,
        });
        
        allProcessedEmails.push(...pageEmails);
        console.log(`[EmailRoutes] Página carregada: ${pageEmails.length} emails (total: ${allProcessedEmails.length})`);
        
        if (!nextPageToken || pageEmails.length === 0) break;
        pageToken = nextPageToken;
      }

      console.log(`[EmailRoutes] 📧 Encontrados ${allProcessedEmails.length} emails com label no Gmail`);

      if (allProcessedEmails.length === 0) {
        return {
          success: true,
          message: 'Nenhum email com label AgentHub-Processado encontrado no Gmail',
          found: 0,
          synced: 0,
          alreadyInDb: 0,
        };
      }

      // Verifica quais NÃO existem no banco
      const db = getDb();
      if (!db) {
        return reply.status(500).send({ error: 'Banco de dados não disponível' });
      }

      const emailsToSync: any[] = [];
      let alreadyInDb = 0;

      for (const email of allProcessedEmails) {
        const existing = await db.select()
          .from(classifiedEmails)
          .where(eq(classifiedEmails.emailId, email.id))
          .limit(1);

        if (existing.length === 0) {
          emailsToSync.push(email);
        } else {
          alreadyInDb++;
        }
      }

      console.log(`[EmailRoutes] 📊 ${emailsToSync.length} emails para sincronizar, ${alreadyInDb} já no banco`);

      if (emailsToSync.length === 0) {
        return {
          success: true,
          message: 'Todos os emails do Gmail já estão no banco',
          found: allProcessedEmails.length,
          synced: 0,
          alreadyInDb,
        };
      }

      // Classifica e salva os emails que não estão no banco
      const config = await import('./config.js').then(m => m.loadConfig());
      const classifier = new EmailClassifier({
        userEmail: config.user?.email || '',
        vipSenders: config.user?.vipSenders || [],
        ignoreSenders: config.user?.ignoreSenders || [],
        labelsToProcess: ['INBOX'],
        maxEmailsPerRun: 100,
        unreadOnly: false,
      });

      let syncedCount = 0;

      for (const email of emailsToSync) {
        try {
          console.log(`[EmailRoutes] 📧 Sincronizando: ${email.subject?.substring(0, 50)}...`);
          
          const classification = await classifier.classify(email);
          
          await db.insert(classifiedEmails).values({
            emailId: email.id,
            threadId: email.threadId,
            fromEmail: email.from?.email || '',
            fromName: email.from?.name || '',
            toEmails: JSON.stringify(email.to || []),
            ccEmails: JSON.stringify(email.cc || []),
            subject: email.subject || '',
            snippet: email.snippet || '',
            body: (email.body || '').substring(0, 10000),
            priority: classification.priority,
            action: classification.action,
            confidence: classification.confidence,
            reasoning: classification.reasoning,
            suggestedResponse: classification.suggestedResponse,
            tags: JSON.stringify(classification.tags),
            sentiment: classification.sentiment,
            isDirectedToMe: classification.isDirectedToMe,
            requiresAction: classification.requiresAction,
            deadline: classification.deadline,
            emailDate: new Date(email.date),
            classifiedAt: new Date(),
            hasAttachments: email.hasAttachments || false,
            isRead: false,
          });
          
          syncedCount++;
        } catch (error) {
          console.error(`[EmailRoutes] ❌ Erro ao sincronizar ${email.id}:`, error);
        }
      }

      console.log(`[EmailRoutes] ✅ Sincronização concluída: ${syncedCount} emails sincronizados`);

      return {
        success: true,
        message: `${syncedCount} emails sincronizados do Gmail para o banco`,
        found: allProcessedEmails.length,
        synced: syncedCount,
        alreadyInDb,
      };

    } catch (error) {
      console.error('[EmailRoutes] ❌ Erro na sincronização:', error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Erro ao sincronizar',
      });
    }
  });
};
