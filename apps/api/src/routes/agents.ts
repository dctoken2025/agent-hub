import type { FastifyPluginAsync } from 'fastify';
import { getScheduler } from '@agent-hub/core';
import { getDb, agentLogs } from '../db/index.js';
import { eq, desc, sql } from 'drizzle-orm';

export const agentRoutes: FastifyPluginAsync = async (app) => {
  const scheduler = getScheduler();

  // Lista todos os agentes com métricas do banco
  app.get('/', async () => {
    const agents = scheduler.getAgents();
    const db = getDb();
    
    // Se tiver banco, busca métricas persistidas
    if (db) {
      try {
        const agentsWithStats = await Promise.all(
          agents.map(async (agent) => {
            let dbRunCount = 0;
            let dbLastRun: Date | null = null;

            // Para o Legal Agent, usa o número de análises jurídicas como proxy
            if (agent.config.id === 'legal-agent') {
              const { legalAnalyses } = await import('../db/index.js');
              
              const countResult = await db.select({
                count: sql<number>`count(*)::int`,
              }).from(legalAnalyses);
              
              const lastRunResult = await db.select({
                analyzedAt: legalAnalyses.analyzedAt,
              })
                .from(legalAnalyses)
                .orderBy(desc(legalAnalyses.analyzedAt))
                .limit(1);

              dbRunCount = countResult[0]?.count || 0;
              dbLastRun = lastRunResult[0]?.analyzedAt || null;
            } else {
              // Para outros agentes, usa agent_logs
              const countResult = await db.select({
                count: sql<number>`count(*)::int`,
              })
                .from(agentLogs)
                .where(eq(agentLogs.agentId, agent.config.id));
              
              const lastRunResult = await db.select({
                createdAt: agentLogs.createdAt,
              })
                .from(agentLogs)
                .where(eq(agentLogs.agentId, agent.config.id))
                .orderBy(desc(agentLogs.createdAt))
                .limit(1);

              dbRunCount = countResult[0]?.count || 0;
              dbLastRun = lastRunResult[0]?.createdAt || null;
            }

            return {
              ...agent,
              // Usa o maior entre memória e banco (pois podem estar dessincronizados)
              runCount: Math.max(agent.runCount, dbRunCount),
              lastRun: dbLastRun || agent.lastRun,
            };
          })
        );
        
        return { agents: agentsWithStats };
      } catch (error) {
        console.error('[AgentRoutes] Erro ao buscar métricas:', error);
      }
    }
    
    return { agents };
  });

  // Detalhes de um agente
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const agent = scheduler.getAgent(request.params.id);
    if (!agent) {
      return reply.status(404).send({ error: 'Agente não encontrado' });
    }
    return agent;
  });

  // Inicia um agente
  app.post<{ Params: { id: string } }>('/:id/start', async (request, reply) => {
    try {
      await scheduler.start(request.params.id);
      return { success: true, message: 'Agente iniciado' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      return reply.status(400).send({ error: message });
    }
  });

  // Para um agente
  app.post<{ Params: { id: string } }>('/:id/stop', async (request, reply) => {
    try {
      await scheduler.stop(request.params.id);
      return { success: true, message: 'Agente parado' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      return reply.status(400).send({ error: message });
    }
  });

  // Executa agente uma vez
  app.post<{ Params: { id: string } }>('/:id/run', async (request, reply) => {
    try {
      await scheduler.runOnce(request.params.id);
      return { success: true, message: 'Execução iniciada' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      return reply.status(400).send({ error: message });
    }
  });

  // Inicia todos os agentes
  app.post('/start-all', async () => {
    await scheduler.startAll();
    return { success: true, message: 'Todos os agentes iniciados' };
  });

  // Para todos os agentes
  app.post('/stop-all', async () => {
    await scheduler.stopAll();
    return { success: true, message: 'Todos os agentes parados' };
  });

  // Logs dos agentes
  app.get('/logs', async (request) => {
    const db = getDb();
    if (!db) {
      return { logs: [], total: 0 };
    }

    try {
      const query = request.query as { agentId?: string; limit?: string };
      const limit = parseInt(query.limit || '100');

      let queryBuilder = db.select().from(agentLogs);

      if (query.agentId) {
        queryBuilder = queryBuilder.where(eq(agentLogs.agentId, query.agentId)) as typeof queryBuilder;
      }

      const logs = await queryBuilder
        .orderBy(desc(agentLogs.createdAt))
        .limit(limit);

      return { logs, total: logs.length };
    } catch (error) {
      console.error('[AgentRoutes] Erro ao buscar logs:', error);
      return { logs: [], total: 0 };
    }
  });

  // Métricas gerais para o dashboard
  app.get('/metrics', async () => {
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
      // Total de execuções
      const totalResult = await db.select({
        count: sql<number>`count(*)::int`,
      }).from(agentLogs);

      // Execuções com sucesso
      const successResult = await db.select({
        count: sql<number>`count(*)::int`,
      })
        .from(agentLogs)
        .where(eq(agentLogs.success, true));

      // Total de emails processados
      const emailsResult = await db.select({
        total: sql<number>`COALESCE(sum(processed_count), 0)::int`,
      }).from(agentLogs);

      // Última execução
      const lastResult = await db.select({
        createdAt: agentLogs.createdAt,
        agentName: agentLogs.agentName,
      })
        .from(agentLogs)
        .orderBy(desc(agentLogs.createdAt))
        .limit(1);

      return {
        totalExecutions: totalResult[0]?.count || 0,
        successfulExecutions: successResult[0]?.count || 0,
        failedExecutions: (totalResult[0]?.count || 0) - (successResult[0]?.count || 0),
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
