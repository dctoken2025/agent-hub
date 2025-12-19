import type { FastifyPluginAsync } from 'fastify';
import { getScheduler } from '@agent-hub/core';

export const agentRoutes: FastifyPluginAsync = async (app) => {
  const scheduler = getScheduler();

  // Lista todos os agentes
  app.get('/', async () => {
    const agents = scheduler.getAgents();
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
};
