import type { FastifyPluginAsync } from 'fastify';
import { getDb, agentLogs, legalAnalyses, users } from '../db/index.js';
import { eq, desc, sql, and } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { loadUserConfig } from './config.js';
import { getAgentManager } from '../services/agent-manager.js';

// Helper para verificar se o usuário pode ativar agentes
async function checkAccountActive(userId: string): Promise<{ canActivate: boolean; message?: string; code?: string }> {
  const db = getDb();
  if (!db) {
    return { canActivate: false, message: 'Banco de dados não disponível' };
  }

  const [user] = await db.select({
    accountStatus: users.accountStatus,
    email: users.email,
    trialEndsAt: users.trialEndsAt,
    role: users.role,
  })
  .from(users)
  .where(eq(users.id, userId));

  if (!user) {
    return { canActivate: false, message: 'Usuário não encontrado' };
  }

  // Admin sempre pode usar
  if (user.role === 'admin') {
    return { canActivate: true };
  }

  // Verifica status da conta
  if (user.accountStatus !== 'active') {
    const statusMessages: Record<string, string> = {
      pending: 'Sua conta está aguardando aprovação do administrador. Entre em contato para liberar o acesso aos agentes.',
      suspended: 'Sua conta foi suspensa. Entre em contato com o administrador.',
      trial_expired: 'Seu período de teste expirou. Entre em contato para continuar usando os agentes.',
    };
    return { 
      canActivate: false, 
      message: statusMessages[user.accountStatus] || 'Conta não está ativa',
      code: 'ACCOUNT_NOT_ACTIVE',
    };
  }

  // Verifica se o trial expirou
  if (user.trialEndsAt) {
    const now = new Date();
    if (now > user.trialEndsAt) {
      // Atualiza status para trial_expired
      await db.update(users)
        .set({ accountStatus: 'trial_expired' })
        .where(eq(users.id, userId));
      
      return { 
        canActivate: false, 
        message: 'Seu período de teste de 7 dias expirou. Entre em contato para continuar usando os agentes.',
        code: 'TRIAL_EXPIRED',
      };
    }
  }

  return { canActivate: true };
}

export const agentRoutes: FastifyPluginAsync = async (app) => {
  // Lista todos os agentes do usuário atual
  app.get('/', { preHandler: [authMiddleware] }, async (request) => {
    const userId = request.user!.id;
    const db = getDb();
    const agentManager = getAgentManager();

    // Carrega configurações do usuário
    const userConfig = await loadUserConfig(userId);

    // Obtém agentes do usuário via AgentManager
    const runningAgents = agentManager.getUserAgents(userId);

    // Monta lista de agentes com status
    const agents = [];

    // Email Agent
    const emailAgentRunning = runningAgents.find((a) => a.config.id.includes('email'));
    if (userConfig.emailAgent.enabled) {
      let dbRunCount = 0;
      let dbLastRun: Date | null = null;

      if (db) {
        try {
          const countResult = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(agentLogs)
            .where(
              and(
                eq(agentLogs.userId, userId),
                eq(agentLogs.agentId, `email-agent-${userId}`)
              )
            );

          const lastRunResult = await db
            .select({ createdAt: agentLogs.createdAt })
            .from(agentLogs)
            .where(
              and(
                eq(agentLogs.userId, userId),
                eq(agentLogs.agentId, `email-agent-${userId}`)
              )
            )
            .orderBy(desc(agentLogs.createdAt))
            .limit(1);

          dbRunCount = countResult[0]?.count || 0;
          dbLastRun = lastRunResult[0]?.createdAt || null;
        } catch {
          // Ignora erros de contagem
        }
      }

      agents.push({
        config: {
          id: 'email-agent',
          name: 'Email Agent',
          description: 'Agente de classificação e triagem de emails',
          enabled: userConfig.emailAgent.enabled,
          schedule: {
            type: 'interval',
            value: userConfig.emailAgent.intervalMinutes,
          },
        },
        status: emailAgentRunning ? 'running' : 'stopped',
        runCount: dbRunCount, // Sempre usa o valor persistido do banco
        lastRun: dbLastRun,
      });
    }

    // Legal Agent
    const legalAgentRunning = runningAgents.find((a) => a.config.id.includes('legal'));
    if (userConfig.legalAgent.enabled) {
      let dbRunCount = 0;
      let dbLastRun: Date | null = null;

      if (db) {
        try {
          const countResult = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(legalAnalyses)
            .where(eq(legalAnalyses.userId, userId));

          const lastRunResult = await db
            .select({ analyzedAt: legalAnalyses.analyzedAt })
            .from(legalAnalyses)
            .where(eq(legalAnalyses.userId, userId))
            .orderBy(desc(legalAnalyses.analyzedAt))
            .limit(1);

          dbRunCount = countResult[0]?.count || 0;
          dbLastRun = lastRunResult[0]?.analyzedAt || null;
        } catch {
          // Ignora erros
        }
      }

      agents.push({
        config: {
          id: 'legal-agent',
          name: 'Legal Agent',
          description: 'Agente de análise de contratos e documentos legais',
          enabled: userConfig.legalAgent.enabled,
          schedule: {
            type: 'manual',
          },
        },
        status: legalAgentRunning ? 'running' : 'stopped',
        runCount: dbRunCount, // Sempre usa o valor persistido do banco
        lastRun: dbLastRun,
      });
    }

    // Financial Agent
    const financialAgentRunning = runningAgents.find((a) =>
      a.config.id.includes('financial')
    );
    if (userConfig.financialAgent.enabled) {
      let dbRunCount = 0;
      let dbLastRun: Date | null = null;

      if (db) {
        try {
          const { financialItems } = await import('../db/schema.js');
          const countResult = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(financialItems)
            .where(eq(financialItems.userId, userId));

          const lastRunResult = await db
            .select({ analyzedAt: financialItems.analyzedAt })
            .from(financialItems)
            .where(eq(financialItems.userId, userId))
            .orderBy(desc(financialItems.analyzedAt))
            .limit(1);

          dbRunCount = countResult[0]?.count || 0;
          dbLastRun = lastRunResult[0]?.analyzedAt || null;
        } catch {
          // Ignora erros
        }
      }

      agents.push({
        config: {
          id: 'financial-agent',
          name: 'Financial Agent',
          description: 'Agente de análise de cobranças, boletos e pagamentos',
          enabled: userConfig.financialAgent.enabled,
          schedule: {
            type: 'manual',
          },
        },
        status: financialAgentRunning ? 'running' : 'stopped',
        runCount: dbRunCount, // Sempre usa o valor persistido do banco
        lastRun: dbLastRun,
      });
    }

    // Stablecoin Agent
    const stablecoinAgentRunning = runningAgents.find((a) =>
      a.config.id.includes('stablecoin')
    );
    if (userConfig.stablecoinAgent.enabled) {
      let dbRunCount = 0;
      let dbLastRun: Date | null = null;

      if (db) {
        try {
          const countResult = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(agentLogs)
            .where(
              and(
                eq(agentLogs.userId, userId),
                eq(agentLogs.agentId, `stablecoin-agent-${userId}`)
              )
            );

          const lastRunResult = await db
            .select({ createdAt: agentLogs.createdAt })
            .from(agentLogs)
            .where(
              and(
                eq(agentLogs.userId, userId),
                eq(agentLogs.agentId, `stablecoin-agent-${userId}`)
              )
            )
            .orderBy(desc(agentLogs.createdAt))
            .limit(1);

          dbRunCount = countResult[0]?.count || 0;
          dbLastRun = lastRunResult[0]?.createdAt || null;
        } catch {
          // Ignora erros
        }
      }

      agents.push({
        config: {
          id: 'stablecoin-agent',
          name: 'Stablecoin Agent',
          description: 'Agente de monitoramento de stablecoins na blockchain',
          enabled: userConfig.stablecoinAgent.enabled,
          schedule: {
            type: 'interval',
            value: userConfig.stablecoinAgent.checkInterval || 60,
          },
        },
        status: stablecoinAgentRunning ? 'running' : 'stopped',
        runCount: dbRunCount, // Sempre usa o valor persistido do banco
        lastRun: dbLastRun,
      });
    }

    // Task Agent - sempre ativo quando Email Agent está ativo (é chamado internamente)
    // Conta execuções do banco
    let taskAgentRunCount = 0;
    let taskAgentLastRun: string | null = null;
    
    if (db) {
      try {
        const runCountResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(agentLogs)
          .where(
            and(
              eq(agentLogs.userId, userId),
              eq(agentLogs.agentId, `task-agent-${userId}`)
            )
          );

        const lastRunResult = await db
          .select({ createdAt: agentLogs.createdAt })
          .from(agentLogs)
          .where(
            and(
              eq(agentLogs.userId, userId),
              eq(agentLogs.agentId, `task-agent-${userId}`)
            )
          )
          .orderBy(desc(agentLogs.createdAt))
          .limit(1);

        taskAgentRunCount = Number(runCountResult[0]?.count) || 0;
        taskAgentLastRun = lastRunResult[0]?.createdAt?.toISOString() || null;
      } catch {
        // Ignora erros
      }
    }

    agents.push({
      config: {
        id: 'task-agent',
        name: 'Task Agent',
        description: 'Extrai tarefas e action items de emails importantes',
        enabled: userConfig.emailAgent.enabled, // Ativo quando Email Agent está ativo
        schedule: {
          type: 'manual',
        },
      },
      status: emailAgentRunning ? 'running' : 'stopped', // Roda junto com Email Agent
      runCount: taskAgentRunCount,
      lastRun: taskAgentLastRun,
    });

    return { agents };
  });

  // Detalhes de um agente específico
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const userId = request.user!.id;
      const agentManager = getAgentManager();
      const agentId = `${request.params.id}-${userId}`;

      const agent = agentManager.getAgentInfo(userId, agentId);
      if (!agent) {
        return reply.status(404).send({ error: 'Agente não encontrado' });
      }

      return agent;
    }
  );

  // Inicia um agente
  app.post<{ Params: { id: string } }>(
    '/:id/start',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;

        // Verifica se a conta está ativa
        const accountCheck = await checkAccountActive(userId);
        if (!accountCheck.canActivate) {
          return reply.status(403).send({ 
            error: accountCheck.message,
            code: 'ACCOUNT_NOT_ACTIVE'
          });
        }

        const agentManager = getAgentManager();
        await agentManager.startAgent(userId, request.params.id);

        return { success: true, message: 'Agente iniciado' };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        return reply.status(400).send({ error: message });
      }
    }
  );

  // Para um agente
  app.post<{ Params: { id: string } }>(
    '/:id/stop',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const agentManager = getAgentManager();

        await agentManager.stopAgent(userId, request.params.id);

        return { success: true, message: 'Agente parado' };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        return reply.status(400).send({ error: message });
      }
    }
  );

  // Executa agente uma vez
  app.post<{ Params: { id: string } }>(
    '/:id/run',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;

        // Verifica se a conta está ativa
        const accountCheck = await checkAccountActive(userId);
        if (!accountCheck.canActivate) {
          return reply.status(403).send({ 
            error: accountCheck.message,
            code: 'ACCOUNT_NOT_ACTIVE'
          });
        }

        const agentManager = getAgentManager();
        const agentId = request.params.id;

        // Executa de forma assíncrona para não bloquear a request
        agentManager.runAgentOnce(userId, agentId).catch((err) => {
          console.error(`[Agents] Erro ao executar ${agentId} para ${userId}:`, err);
        });

        return { success: true, message: 'Execução iniciada em background...' };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        return reply.status(400).send({ error: message });
      }
    }
  );

  // Inicia todos os agentes do usuário
  app.post('/start-all', { preHandler: [authMiddleware] }, async (request, reply) => {
    const userId = request.user!.id;

    // Verifica se a conta está ativa
    const accountCheck = await checkAccountActive(userId);
    if (!accountCheck.canActivate) {
      return reply.status(403).send({ 
        error: accountCheck.message,
        code: 'ACCOUNT_NOT_ACTIVE'
      });
    }

    const agentManager = getAgentManager();

    // Salva estado de "ativo" no banco para auto-start após reinício
    await agentManager.setAgentsActiveState(userId, true);

    // Inicia de forma assíncrona para não bloquear a request
    // A primeira execução acontece em background
    agentManager.initializeForUser(userId).catch((err) => {
      console.error(`[Agents] Erro ao inicializar agentes para ${userId}:`, err);
    });

    return { success: true, message: 'Agentes sendo iniciados em background...' };
  });

  // Para todos os agentes do usuário
  app.post('/stop-all', { preHandler: [authMiddleware] }, async (request) => {
    const userId = request.user!.id;
    const agentManager = getAgentManager();

    // Salva estado de "inativo" no banco
    await agentManager.setAgentsActiveState(userId, false);

    await agentManager.stopForUser(userId);

    return { success: true, message: 'Todos os agentes parados' };
  });

  // Logs dos agentes do usuário (resumo)
  app.get('/logs', { preHandler: [authMiddleware] }, async (request) => {
    const userId = request.user!.id;
    const db = getDb();
    
    if (!db) {
      return { logs: [], total: 0 };
    }

    try {
      const query = request.query as { agentId?: string; limit?: string };
      const limit = parseInt(query.limit || '100');

      const conditions = [eq(agentLogs.userId, userId)];
      
      if (query.agentId) {
        conditions.push(eq(agentLogs.agentId, query.agentId));
      }

      const queryBuilder = db
        .select()
        .from(agentLogs)
        .where(and(...conditions));

      const logs = await queryBuilder.orderBy(desc(agentLogs.createdAt)).limit(limit);

      return { logs, total: logs.length };
    } catch (error) {
      console.error('[AgentRoutes] Erro ao buscar logs:', error);
      return { logs: [], total: 0 };
    }
  });

  // Logs de atividade detalhados (tempo real)
  app.get('/activity', { preHandler: [authMiddleware] }, async (request) => {
    const userId = request.user!.id;
    const { getActivityLogs } = await import('../services/activity-logger.js');
    
    try {
      const query = request.query as { agentId?: string; limit?: string; since?: string };
      const limit = parseInt(query.limit || '200');
      const since = query.since ? new Date(query.since) : undefined;

      const logs = await getActivityLogs(userId, { 
        agentId: query.agentId, 
        limit,
        since 
      });

      return { logs, total: logs.length };
    } catch (error) {
      console.error('[AgentRoutes] Erro ao buscar activity logs:', error);
      return { logs: [], total: 0 };
    }
  });

  // Métricas gerais do usuário
  app.get('/metrics', { preHandler: [authMiddleware] }, async (request) => {
    const userId = request.user!.id;
    const db = getDb();

    if (!db) {
      return {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        emailsProcessed: 0,
        lastExecution: null,
      };
    }

    try {
      // Total de execuções do usuário
      const totalResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(agentLogs)
        .where(eq(agentLogs.userId, userId));

      // Execuções com sucesso
      const successResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(agentLogs)
        .where(and(eq(agentLogs.userId, userId), eq(agentLogs.success, true)));

      // Total de emails processados
      const emailsResult = await db
        .select({ total: sql<number>`COALESCE(sum(processed_count), 0)::int` })
        .from(agentLogs)
        .where(eq(agentLogs.userId, userId));

      // Última execução
      const lastResult = await db
        .select({
          createdAt: agentLogs.createdAt,
          agentName: agentLogs.agentName,
        })
        .from(agentLogs)
        .where(eq(agentLogs.userId, userId))
        .orderBy(desc(agentLogs.createdAt))
        .limit(1);

      return {
        totalExecutions: totalResult[0]?.count || 0,
        successfulExecutions: successResult[0]?.count || 0,
        failedExecutions:
          (totalResult[0]?.count || 0) - (successResult[0]?.count || 0),
        emailsProcessed: emailsResult[0]?.total || 0,
        lastExecution: lastResult[0] || null,
      };
    } catch (error) {
      console.error('[AgentRoutes] Erro ao buscar métricas:', error);
      return {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        emailsProcessed: 0,
        lastExecution: null,
      };
    }
  });
};
