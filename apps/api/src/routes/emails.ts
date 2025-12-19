import type { FastifyPluginAsync } from 'fastify';
import { getScheduler } from '@agent-hub/core';
import type { EmailAgent, EmailAgentResult } from '@agent-hub/email-agent';

// Cache simples para resultados recentes
let lastResult: EmailAgentResult | null = null;

export const emailRoutes: FastifyPluginAsync = async (app) => {
  const scheduler = getScheduler();

  // Lista emails classificados (último resultado)
  app.get('/', async () => {
    return {
      emails: lastResult?.emails || [],
      summary: lastResult ? {
        processedCount: lastResult.processedCount,
        classifications: lastResult.classifications,
      } : null,
    };
  });

  // Busca emails e classifica
  app.post('/fetch', async (request, reply) => {
    const agentInfo = scheduler.getAgent('email-agent');
    if (!agentInfo) {
      return reply.status(404).send({ error: 'Email Agent não encontrado' });
    }

    try {
      // Força execução do agente
      await scheduler.runOnce('email-agent');
      
      // Aguarda um pouco para o resultado
      await new Promise(resolve => setTimeout(resolve, 1000));
      
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
    if (!lastResult) {
      return {
        totalProcessed: 0,
        byPriority: {},
        lastRun: null,
      };
    }

    return {
      totalProcessed: lastResult.processedCount,
      byPriority: lastResult.classifications,
      lastRun: new Date().toISOString(),
    };
  });

  // Emails urgentes
  app.get('/urgent', async () => {
    const urgent = lastResult?.emails.filter(
      e => e.classification.priority === 'urgent'
    ) || [];
    
    return { emails: urgent };
  });

  // Emails que precisam de resposta
  app.get('/needs-response', async () => {
    const needsResponse = lastResult?.emails.filter(
      e => e.classification.requiresAction && 
           ['respond_now', 'respond_later'].includes(e.classification.action)
    ) || [];
    
    return { emails: needsResponse };
  });

  // Webhook para receber resultados do agente (interno)
  app.post('/results', async (request) => {
    lastResult = request.body as EmailAgentResult;
    return { success: true };
  });
};
