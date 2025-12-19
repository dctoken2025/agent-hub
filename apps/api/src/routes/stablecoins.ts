import type { FastifyPluginAsync } from 'fastify';
import { getDb, stablecoins, stablecoinEvents, stablecoinAnomalies, supplySnapshots } from '../db/index.js';
import { eq, desc, sql, and, gte } from 'drizzle-orm';

export const stablecoinRoutes: FastifyPluginAsync = async (app) => {
  // ===========================================
  // Rotas de Stablecoins
  // ===========================================

  // Lista todas as stablecoins monitoradas
  app.get('/', async () => {
    const db = getDb();
    if (!db) {
      return { stablecoins: [], total: 0 };
    }

    try {
      const result = await db.select().from(stablecoins).orderBy(desc(stablecoins.createdAt));
      return { stablecoins: result, total: result.length };
    } catch (error) {
      console.error('[StablecoinRoutes] Erro ao listar stablecoins:', error);
      return { stablecoins: [], total: 0 };
    }
  });

  // Adiciona uma nova stablecoin para monitorar
  app.post<{ Body: { address: string; name: string; symbol: string; decimals: number; network: string } }>(
    '/',
    async (request, reply) => {
      const db = getDb();
      if (!db) {
        return reply.status(500).send({ error: 'Banco de dados não disponível' });
      }

      const { address, name, symbol, decimals, network } = request.body;

      if (!address || !name || !symbol || !network) {
        return reply.status(400).send({ error: 'Campos obrigatórios: address, name, symbol, network' });
      }

      // Extrai apenas o endereço se for uma URL completa
      let cleanAddress = address;
      if (address.includes('/')) {
        // Se for uma URL como https://basescan.org/token/0x5732...
        const parts = address.split('/');
        cleanAddress = parts[parts.length - 1];
      }
      
      // Valida que parece ser um endereço Ethereum
      if (!cleanAddress.startsWith('0x') || cleanAddress.length !== 42) {
        return reply.status(400).send({ error: 'Endereço inválido. Use o formato 0x... (42 caracteres)' });
      }

      try {
        // Verifica se já existe
        const existing = await db.select().from(stablecoins)
          .where(and(
            eq(stablecoins.address, cleanAddress.toLowerCase()),
            eq(stablecoins.network, network)
          ));

        if (existing.length > 0) {
          return reply.status(400).send({ error: 'Stablecoin já cadastrada' });
        }

        const [newStablecoin] = await db.insert(stablecoins).values({
          address: cleanAddress.toLowerCase(),
          name,
          symbol: symbol.toUpperCase(),
          decimals: decimals || 18,
          network,
          isActive: true,
        }).returning();

        console.log(`[StablecoinRoutes] Stablecoin adicionada: ${newStablecoin.symbol} (${newStablecoin.network})`);

        return { success: true, stablecoin: newStablecoin };
      } catch (error) {
        console.error('[StablecoinRoutes] Erro ao adicionar stablecoin:', error);
        return reply.status(500).send({ error: 'Erro ao adicionar stablecoin' });
      }
    }
  );

  // Remove uma stablecoin
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const db = getDb();
    if (!db) {
      return reply.status(500).send({ error: 'Banco de dados não disponível' });
    }

    const id = parseInt(request.params.id);

    try {
      const [deleted] = await db.delete(stablecoins)
        .where(eq(stablecoins.id, id))
        .returning();

      if (!deleted) {
        return reply.status(404).send({ error: 'Stablecoin não encontrada' });
      }

      console.log(`[StablecoinRoutes] Stablecoin removida: ${deleted.symbol}`);

      return { success: true, message: 'Stablecoin removida' };
    } catch (error) {
      console.error('[StablecoinRoutes] Erro ao remover stablecoin:', error);
      return reply.status(500).send({ error: 'Erro ao remover stablecoin' });
    }
  });

  // ===========================================
  // Rotas de Eventos
  // ===========================================

  // Lista eventos recentes
  app.get('/events', async (request) => {
    const db = getDb();
    if (!db) {
      return { events: [], total: 0 };
    }

    const query = request.query as { stablecoinId?: string; limit?: string; eventType?: string };
    const limit = parseInt(query.limit || '100');

    try {
      let queryBuilder = db.select({
        event: stablecoinEvents,
        stablecoin: stablecoins,
      })
        .from(stablecoinEvents)
        .leftJoin(stablecoins, eq(stablecoinEvents.stablecoinId, stablecoins.id))
        .orderBy(desc(stablecoinEvents.timestamp))
        .limit(limit);

      if (query.stablecoinId) {
        queryBuilder = queryBuilder.where(
          eq(stablecoinEvents.stablecoinId, parseInt(query.stablecoinId))
        ) as typeof queryBuilder;
      }

      if (query.eventType) {
        queryBuilder = queryBuilder.where(
          eq(stablecoinEvents.eventType, query.eventType)
        ) as typeof queryBuilder;
      }

      const result = await queryBuilder;
      
      return { 
        events: result.map(r => ({
          ...r.event,
          stablecoin: r.stablecoin,
        })), 
        total: result.length 
      };
    } catch (error) {
      console.error('[StablecoinRoutes] Erro ao listar eventos:', error);
      return { events: [], total: 0 };
    }
  });

  // ===========================================
  // Rotas de Anomalias
  // ===========================================

  // Lista anomalias
  app.get('/anomalies', async (request) => {
    const db = getDb();
    if (!db) {
      return { anomalies: [], total: 0 };
    }

    const query = request.query as { 
      acknowledged?: string; 
      severity?: string;
      limit?: string;
    };
    const limit = parseInt(query.limit || '50');

    try {
      let queryBuilder = db.select({
        anomaly: stablecoinAnomalies,
        stablecoin: stablecoins,
      })
        .from(stablecoinAnomalies)
        .leftJoin(stablecoins, eq(stablecoinAnomalies.stablecoinId, stablecoins.id))
        .orderBy(desc(stablecoinAnomalies.createdAt))
        .limit(limit);

      if (query.acknowledged === 'false') {
        queryBuilder = queryBuilder.where(
          eq(stablecoinAnomalies.isAcknowledged, false)
        ) as typeof queryBuilder;
      }

      if (query.severity) {
        queryBuilder = queryBuilder.where(
          eq(stablecoinAnomalies.severity, query.severity)
        ) as typeof queryBuilder;
      }

      const result = await queryBuilder;
      
      return { 
        anomalies: result.map(r => ({
          ...r.anomaly,
          stablecoin: r.stablecoin,
        })), 
        total: result.length 
      };
    } catch (error) {
      console.error('[StablecoinRoutes] Erro ao listar anomalias:', error);
      return { anomalies: [], total: 0 };
    }
  });

  // Reconhece uma anomalia
  app.post<{ Params: { id: string } }>('/anomalies/:id/acknowledge', async (request, reply) => {
    const db = getDb();
    if (!db) {
      return reply.status(500).send({ error: 'Banco de dados não disponível' });
    }

    const id = parseInt(request.params.id);

    try {
      const [updated] = await db.update(stablecoinAnomalies)
        .set({ 
          isAcknowledged: true, 
          acknowledgedAt: new Date() 
        })
        .where(eq(stablecoinAnomalies.id, id))
        .returning();

      if (!updated) {
        return reply.status(404).send({ error: 'Anomalia não encontrada' });
      }

      return { success: true, anomaly: updated };
    } catch (error) {
      console.error('[StablecoinRoutes] Erro ao reconhecer anomalia:', error);
      return reply.status(500).send({ error: 'Erro ao reconhecer anomalia' });
    }
  });

  // ===========================================
  // Rotas de Supply
  // ===========================================

  // Histórico de supply de uma stablecoin
  app.get<{ Params: { id: string } }>('/:id/supply', async (request) => {
    const db = getDb();
    if (!db) {
      return { snapshots: [], total: 0 };
    }

    const stablecoinId = parseInt(request.params.id);
    const query = request.query as { limit?: string; days?: string };
    const limit = parseInt(query.limit || '168'); // 7 dias * 24 horas
    const days = parseInt(query.days || '7');

    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const result = await db.select()
        .from(supplySnapshots)
        .where(and(
          eq(supplySnapshots.stablecoinId, stablecoinId),
          gte(supplySnapshots.timestamp, since)
        ))
        .orderBy(desc(supplySnapshots.timestamp))
        .limit(limit);

      return { snapshots: result, total: result.length };
    } catch (error) {
      console.error('[StablecoinRoutes] Erro ao buscar histórico de supply:', error);
      return { snapshots: [], total: 0 };
    }
  });

  // ===========================================
  // Rotas de Estatísticas
  // ===========================================

  // Estatísticas gerais
  app.get('/stats', async () => {
    const db = getDb();
    if (!db) {
      return {
        stablecoinsMonitored: 0,
        events24h: 0,
        pendingAnomalies: 0,
        lastCheck: null,
      };
    }

    try {
      // Total de stablecoins ativas
      const stablecoinsResult = await db.select({
        count: sql<number>`count(*)::int`,
      })
        .from(stablecoins)
        .where(eq(stablecoins.isActive, true));

      // Eventos nas últimas 24 horas
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);
      
      const eventsResult = await db.select({
        count: sql<number>`count(*)::int`,
      })
        .from(stablecoinEvents)
        .where(gte(stablecoinEvents.timestamp, yesterday));

      // Anomalias não reconhecidas
      const anomaliesResult = await db.select({
        count: sql<number>`count(*)::int`,
      })
        .from(stablecoinAnomalies)
        .where(eq(stablecoinAnomalies.isAcknowledged, false));

      // Última verificação
      const lastCheckResult = await db.select({
        lastCheckedAt: stablecoins.lastCheckedAt,
      })
        .from(stablecoins)
        .orderBy(desc(stablecoins.lastCheckedAt))
        .limit(1);

      return {
        stablecoinsMonitored: stablecoinsResult[0]?.count || 0,
        events24h: eventsResult[0]?.count || 0,
        pendingAnomalies: anomaliesResult[0]?.count || 0,
        lastCheck: lastCheckResult[0]?.lastCheckedAt || null,
      };
    } catch (error) {
      console.error('[StablecoinRoutes] Erro ao buscar estatísticas:', error);
      return {
        stablecoinsMonitored: 0,
        events24h: 0,
        pendingAnomalies: 0,
        lastCheck: null,
      };
    }
  });
};
