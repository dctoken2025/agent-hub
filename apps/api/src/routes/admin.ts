import type { FastifyPluginAsync } from 'fastify';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { getDb, users, userConfigs, agentLogs, classifiedEmails, legalAnalyses, financialItems, aiUsageLogs } from '../db/index.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

export const adminRoutes: FastifyPluginAsync = async (app) => {
  // Todas as rotas requerem autenticação de admin
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', adminMiddleware);

  // ===========================================
  // Listar todos os usuários
  // ===========================================
  app.get('/users', async (_request, reply) => {
    const db = getDb();
    if (!db) {
      return reply.status(500).send({ error: 'Banco de dados não disponível' });
    }

    try {
      // Busca todos os usuários
      const allUsers = await db.select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        accountStatus: users.accountStatus,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        trialEndsAt: users.trialEndsAt,
        hasGmailConnected: sql<boolean>`gmail_tokens IS NOT NULL`,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

      // Para cada usuário, busca estatísticas básicas
      const usersWithStats = await Promise.all(
        allUsers.map(async (user) => {
          // Contagem de emails processados
          const [emailCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(classifiedEmails)
            .where(eq(classifiedEmails.userId, user.id));

          // Contagem de análises jurídicas
          const [legalCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(legalAnalyses)
            .where(eq(legalAnalyses.userId, user.id));

          // Contagem de itens financeiros
          const [financialCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(financialItems)
            .where(eq(financialItems.userId, user.id));

          // Contagem de execuções de agentes
          const [agentRunCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(agentLogs)
            .where(eq(agentLogs.userId, user.id));

          // Última atividade
          const [lastActivity] = await db
            .select({ createdAt: agentLogs.createdAt })
            .from(agentLogs)
            .where(eq(agentLogs.userId, user.id))
            .orderBy(desc(agentLogs.createdAt))
            .limit(1);

          // Status dos agentes
          const [userConfig] = await db
            .select({ agentsActive: userConfigs.agentsActive })
            .from(userConfigs)
            .where(eq(userConfigs.userId, user.id));

          // Calcula dias restantes do trial
          let trialDaysRemaining: number | null = null;
          let isTrialExpired = false;
          
          if (user.trialEndsAt && user.role !== 'admin') {
            const now = new Date();
            const diffTime = user.trialEndsAt.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            trialDaysRemaining = Math.max(0, diffDays);
            isTrialExpired = diffDays <= 0;
          }

          return {
            ...user,
            trialDaysRemaining,
            isTrialExpired,
            stats: {
              emailsProcessed: emailCount?.count || 0,
              legalAnalyses: legalCount?.count || 0,
              financialItems: financialCount?.count || 0,
              agentRuns: agentRunCount?.count || 0,
              lastActivity: lastActivity?.createdAt || null,
              agentsActive: userConfig?.agentsActive || false,
            },
          };
        })
      );

      return { 
        users: usersWithStats,
        total: usersWithStats.length,
      };
    } catch (error) {
      console.error('[Admin] Erro ao listar usuários:', error);
      return reply.status(500).send({ error: 'Erro ao listar usuários' });
    }
  });

  // ===========================================
  // Detalhes e estatísticas de um usuário
  // ===========================================
  app.get<{ Params: { id: string } }>('/users/:id', async (request, reply) => {
    const db = getDb();
    if (!db) {
      return reply.status(500).send({ error: 'Banco de dados não disponível' });
    }

    const { id } = request.params;

    try {
      // Busca o usuário
      const [user] = await db.select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        accountStatus: users.accountStatus,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        hasGmailConnected: sql<boolean>`gmail_tokens IS NOT NULL`,
      })
      .from(users)
      .where(eq(users.id, id));

      if (!user) {
        return reply.status(404).send({ error: 'Usuário não encontrado' });
      }

      // Busca config do usuário
      const [userConfig] = await db
        .select()
        .from(userConfigs)
        .where(eq(userConfigs.userId, id));

      // Estatísticas detalhadas
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Emails por prioridade
      const emailsByPriority = await db
        .select({
          priority: classifiedEmails.priority,
          count: sql<number>`count(*)::int`,
        })
        .from(classifiedEmails)
        .where(eq(classifiedEmails.userId, id))
        .groupBy(classifiedEmails.priority);

      // Análises jurídicas por risco
      const legalByRisk = await db
        .select({
          overallRisk: legalAnalyses.overallRisk,
          count: sql<number>`count(*)::int`,
        })
        .from(legalAnalyses)
        .where(eq(legalAnalyses.userId, id))
        .groupBy(legalAnalyses.overallRisk);

      // Financeiro por status
      const financialByStatus = await db
        .select({
          status: financialItems.status,
          count: sql<number>`count(*)::int`,
          total: sql<number>`COALESCE(sum(amount), 0)::int`,
        })
        .from(financialItems)
        .where(eq(financialItems.userId, id))
        .groupBy(financialItems.status);

      // Uso de AI nos últimos 30 dias
      const [aiUsage] = await db
        .select({
          totalCalls: sql<number>`count(*)::int`,
          totalInputTokens: sql<number>`COALESCE(sum(input_tokens), 0)::int`,
          totalOutputTokens: sql<number>`COALESCE(sum(output_tokens), 0)::int`,
          totalCost: sql<number>`COALESCE(sum(estimated_cost), 0)::int`,
        })
        .from(aiUsageLogs)
        .where(
          and(
            eq(aiUsageLogs.userId, id),
            gte(aiUsageLogs.createdAt, thirtyDaysAgo)
          )
        );

      // Execuções de agentes
      const agentExecutions = await db
        .select({
          agentId: agentLogs.agentId,
          total: sql<number>`count(*)::int`,
          successful: sql<number>`count(*) FILTER (WHERE success = true)::int`,
          failed: sql<number>`count(*) FILTER (WHERE success = false)::int`,
        })
        .from(agentLogs)
        .where(eq(agentLogs.userId, id))
        .groupBy(agentLogs.agentId);

      return {
        user,
        config: userConfig,
        stats: {
          emails: emailsByPriority,
          legal: legalByRisk,
          financial: financialByStatus,
          aiUsage: {
            ...aiUsage,
            // Converte de microdólares para dólares
            totalCostUsd: (aiUsage?.totalCost || 0) / 1_000_000,
          },
          agentExecutions,
        },
      };
    } catch (error) {
      console.error('[Admin] Erro ao buscar usuário:', error);
      return reply.status(500).send({ error: 'Erro ao buscar usuário' });
    }
  });

  // ===========================================
  // Alterar status da conta do usuário
  // ===========================================
  app.put<{
    Params: { id: string };
    Body: { status: 'pending' | 'active' | 'suspended' };
  }>('/users/:id/status', async (request, reply) => {
    const db = getDb();
    if (!db) {
      return reply.status(500).send({ error: 'Banco de dados não disponível' });
    }

    const { id } = request.params;
    const { status } = request.body;

    if (!['pending', 'active', 'suspended'].includes(status)) {
      return reply.status(400).send({ 
        error: 'Status inválido. Use: pending, active ou suspended' 
      });
    }

    try {
      // Verifica se o usuário existe
      const [user] = await db.select().from(users).where(eq(users.id, id));
      if (!user) {
        return reply.status(404).send({ error: 'Usuário não encontrado' });
      }

      // Não permite alterar o próprio status
      if (id === request.user!.id) {
        return reply.status(400).send({ 
          error: 'Você não pode alterar o status da sua própria conta' 
        });
      }

      // Prepara dados de atualização
      const updateData: Record<string, unknown> = {
        accountStatus: status,
        isActive: status === 'active',
        updatedAt: new Date(),
      };

      // Se ativando e usuário não tem trial definido, inicia trial de 7 dias
      if (status === 'active' && !user.trialEndsAt) {
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 7);
        updateData.trialEndsAt = trialEndsAt;
        console.log(`[Admin] Iniciando trial de 7 dias para ${user.email} (até ${trialEndsAt.toISOString()})`);
      }

      // Atualiza o status
      await db.update(users)
        .set(updateData)
        .where(eq(users.id, id));

      // Se suspender, para os agentes do usuário
      if (status === 'suspended' || status === 'pending') {
        const { getAgentManager } = await import('../services/agent-manager.js');
        const agentManager = getAgentManager();
        await agentManager.stopForUser(id);
        await agentManager.setAgentsActiveState(id, false);
      }

      console.log(`[Admin] Status do usuário ${user.email} alterado para: ${status}`);

      return { 
        success: true, 
        message: `Status alterado para ${status}`,
        user: {
          id,
          email: user.email,
          accountStatus: status,
        },
      };
    } catch (error) {
      console.error('[Admin] Erro ao alterar status:', error);
      return reply.status(500).send({ error: 'Erro ao alterar status' });
    }
  });

  // ===========================================
  // Liberar trial do usuário (acesso permanente)
  // ===========================================
  app.post<{
    Params: { id: string };
  }>('/users/:id/unlock', async (request, reply) => {
    const db = getDb();
    if (!db) {
      return reply.status(500).send({ error: 'Banco de dados não disponível' });
    }

    const { id } = request.params;

    try {
      // Verifica se o usuário existe
      const [user] = await db.select().from(users).where(eq(users.id, id));
      if (!user) {
        return reply.status(404).send({ error: 'Usuário não encontrado' });
      }

      // Remove o limite de trial e ativa a conta
      await db.update(users)
        .set({ 
          trialEndsAt: null,
          accountStatus: 'active',
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id));

      console.log(`[Admin] Usuário ${user.email} liberado permanentemente (trial removido)`);

      return { 
        success: true, 
        message: 'Usuário liberado permanentemente',
        user: {
          id,
          email: user.email,
          accountStatus: 'active',
          trialEndsAt: null,
        },
      };
    } catch (error) {
      console.error('[Admin] Erro ao liberar usuário:', error);
      return reply.status(500).send({ error: 'Erro ao liberar usuário' });
    }
  });

  // ===========================================
  // Estatísticas gerais do sistema
  // ===========================================
  app.get('/stats', async (_request, reply) => {
    const db = getDb();
    if (!db) {
      return reply.status(500).send({ error: 'Banco de dados não disponível' });
    }

    try {
      // Total de usuários por status
      const usersByStatus = await db
        .select({
          status: users.accountStatus,
          count: sql<number>`count(*)::int`,
        })
        .from(users)
        .groupBy(users.accountStatus);

      // Total de emails processados
      const [totalEmails] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(classifiedEmails);

      // Total de análises jurídicas
      const [totalLegal] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(legalAnalyses);

      // Total de itens financeiros
      const [totalFinancial] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(financialItems);

      // Uso de AI total (últimos 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [aiUsage] = await db
        .select({
          totalCalls: sql<number>`count(*)::int`,
          totalCost: sql<number>`COALESCE(sum(estimated_cost), 0)::int`,
        })
        .from(aiUsageLogs)
        .where(gte(aiUsageLogs.createdAt, thirtyDaysAgo));

      return {
        users: {
          byStatus: usersByStatus.reduce((acc, row) => {
            acc[row.status || 'pending'] = row.count;
            return acc;
          }, {} as Record<string, number>),
          total: usersByStatus.reduce((acc, row) => acc + row.count, 0),
        },
        totals: {
          emails: totalEmails?.count || 0,
          legalAnalyses: totalLegal?.count || 0,
          financialItems: totalFinancial?.count || 0,
        },
        aiUsage: {
          callsLast30Days: aiUsage?.totalCalls || 0,
          costLast30DaysUsd: (aiUsage?.totalCost || 0) / 1_000_000,
        },
      };
    } catch (error) {
      console.error('[Admin] Erro ao buscar estatísticas:', error);
      return reply.status(500).send({ error: 'Erro ao buscar estatísticas' });
    }
  });
};

