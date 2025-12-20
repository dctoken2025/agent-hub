import type { FastifyPluginAsync } from 'fastify';
import { getDb, aiUsageLogs, users } from '../db/index.js';
import { eq, desc, sql, gte } from 'drizzle-orm';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { loadGlobalConfig, saveGlobalConfigValue } from './config.js';
import { formatCost, AVAILABLE_MODELS } from '@agent-hub/core';

export const aiUsageRoutes: FastifyPluginAsync = async (app) => {
  
  // ===========================================
  // ESTATÍSTICAS DE USO (só admin)
  // ===========================================
  
  // Obtém estatísticas de uso dos últimos 7 dias
  app.get('/stats', { preHandler: [authMiddleware, adminMiddleware] }, async (request) => {
    const db = getDb();
    if (!db) {
      return { 
        error: 'Database not available',
        stats: null 
      };
    }

    const query = request.query as { days?: string };
    const days = parseInt(query.days || '7');
    const since = new Date();
    since.setDate(since.getDate() - days);

    try {
      // Totais gerais
      const totals = await db
        .select({
          totalCalls: sql<number>`count(*)::int`,
          totalInputTokens: sql<number>`coalesce(sum(${aiUsageLogs.inputTokens}), 0)::int`,
          totalOutputTokens: sql<number>`coalesce(sum(${aiUsageLogs.outputTokens}), 0)::int`,
          totalCost: sql<number>`coalesce(sum(${aiUsageLogs.estimatedCost}), 0)::int`,
          avgDuration: sql<number>`coalesce(avg(${aiUsageLogs.durationMs}), 0)::int`,
          successCount: sql<number>`count(case when ${aiUsageLogs.success} = true then 1 end)::int`,
          errorCount: sql<number>`count(case when ${aiUsageLogs.success} = false then 1 end)::int`,
        })
        .from(aiUsageLogs)
        .where(gte(aiUsageLogs.createdAt, since));

      const stats = totals[0] || {
        totalCalls: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        avgDuration: 0,
        successCount: 0,
        errorCount: 0,
      };

      // Por provider
      const byProvider = await db
        .select({
          provider: aiUsageLogs.provider,
          calls: sql<number>`count(*)::int`,
          inputTokens: sql<number>`coalesce(sum(${aiUsageLogs.inputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${aiUsageLogs.outputTokens}), 0)::int`,
          cost: sql<number>`coalesce(sum(${aiUsageLogs.estimatedCost}), 0)::int`,
        })
        .from(aiUsageLogs)
        .where(gte(aiUsageLogs.createdAt, since))
        .groupBy(aiUsageLogs.provider);

      // Por usuário
      const byUser = await db
        .select({
          userId: aiUsageLogs.userId,
          userEmail: users.email,
          calls: sql<number>`count(*)::int`,
          inputTokens: sql<number>`coalesce(sum(${aiUsageLogs.inputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${aiUsageLogs.outputTokens}), 0)::int`,
          cost: sql<number>`coalesce(sum(${aiUsageLogs.estimatedCost}), 0)::int`,
        })
        .from(aiUsageLogs)
        .leftJoin(users, eq(aiUsageLogs.userId, users.id))
        .where(gte(aiUsageLogs.createdAt, since))
        .groupBy(aiUsageLogs.userId, users.email)
        .orderBy(sql`sum(${aiUsageLogs.estimatedCost}) desc`);

      // Por agente
      const byAgent = await db
        .select({
          agentId: aiUsageLogs.agentId,
          calls: sql<number>`count(*)::int`,
          inputTokens: sql<number>`coalesce(sum(${aiUsageLogs.inputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${aiUsageLogs.outputTokens}), 0)::int`,
          cost: sql<number>`coalesce(sum(${aiUsageLogs.estimatedCost}), 0)::int`,
        })
        .from(aiUsageLogs)
        .where(gte(aiUsageLogs.createdAt, since))
        .groupBy(aiUsageLogs.agentId)
        .orderBy(sql`sum(${aiUsageLogs.estimatedCost}) desc`);

      // Por dia (para gráfico)
      const byDay = await db
        .select({
          date: sql<string>`to_char(${aiUsageLogs.createdAt}, 'YYYY-MM-DD')`,
          calls: sql<number>`count(*)::int`,
          cost: sql<number>`coalesce(sum(${aiUsageLogs.estimatedCost}), 0)::int`,
        })
        .from(aiUsageLogs)
        .where(gte(aiUsageLogs.createdAt, since))
        .groupBy(sql`to_char(${aiUsageLogs.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${aiUsageLogs.createdAt}, 'YYYY-MM-DD')`);

      return {
        period: { days, since: since.toISOString() },
        stats: {
          ...stats,
          totalTokens: stats.totalInputTokens + stats.totalOutputTokens,
          costFormatted: formatCost(stats.totalCost),
          successRate: stats.totalCalls > 0 
            ? Math.round((stats.successCount / stats.totalCalls) * 100) 
            : 100,
        },
        byProvider: byProvider.map(p => ({
          ...p,
          costFormatted: formatCost(p.cost),
          percentage: stats.totalCost > 0 
            ? Math.round((p.cost / stats.totalCost) * 100) 
            : 0,
        })),
        byUser: byUser.map(u => ({
          ...u,
          costFormatted: formatCost(u.cost),
          percentage: stats.totalCost > 0 
            ? Math.round((u.cost / stats.totalCost) * 100) 
            : 0,
        })),
        byAgent: byAgent.map(a => ({
          ...a,
          agentName: getAgentName(a.agentId),
          costFormatted: formatCost(a.cost),
          percentage: stats.totalCost > 0 
            ? Math.round((a.cost / stats.totalCost) * 100) 
            : 0,
        })),
        byDay,
      };
    } catch (error) {
      console.error('[AIUsage] Erro ao buscar estatísticas:', error);
      return { error: 'Erro ao buscar estatísticas', stats: null };
    }
  });

  // Obtém logs recentes
  app.get('/logs', { preHandler: [authMiddleware, adminMiddleware] }, async (request) => {
    const db = getDb();
    if (!db) {
      return { logs: [], total: 0 };
    }

    const query = request.query as { limit?: string; offset?: string };
    const limit = parseInt(query.limit || '100');
    const offset = parseInt(query.offset || '0');

    try {
      const logs = await db
        .select({
          id: aiUsageLogs.id,
          userId: aiUsageLogs.userId,
          userEmail: users.email,
          provider: aiUsageLogs.provider,
          model: aiUsageLogs.model,
          agentId: aiUsageLogs.agentId,
          operation: aiUsageLogs.operation,
          inputTokens: aiUsageLogs.inputTokens,
          outputTokens: aiUsageLogs.outputTokens,
          estimatedCost: aiUsageLogs.estimatedCost,
          durationMs: aiUsageLogs.durationMs,
          success: aiUsageLogs.success,
          errorMessage: aiUsageLogs.errorMessage,
          createdAt: aiUsageLogs.createdAt,
        })
        .from(aiUsageLogs)
        .leftJoin(users, eq(aiUsageLogs.userId, users.id))
        .orderBy(desc(aiUsageLogs.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        logs: logs.map(log => ({
          ...log,
          costFormatted: formatCost(log.estimatedCost || 0),
          agentName: getAgentName(log.agentId),
        })),
        total: logs.length,
      };
    } catch (error) {
      console.error('[AIUsage] Erro ao buscar logs:', error);
      return { logs: [], total: 0 };
    }
  });

  // ===========================================
  // ANTHROPIC ADMIN API
  // ===========================================
  
  // Obtém gastos reais da Anthropic via Admin API
  app.get('/anthropic', { preHandler: [authMiddleware, adminMiddleware] }, async () => {
    const globalCfg = await loadGlobalConfig();
    const adminApiKey = globalCfg.ai.anthropicAdminApiKey;

    if (!adminApiKey) {
      return { 
        error: 'Admin API Key da Anthropic não configurada',
        data: null,
        configUrl: 'https://console.anthropic.com/settings/admin-keys',
      };
    }

    try {
      // Busca relatório de custo dos últimos 7 dias
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const response = await fetch(
        `https://api.anthropic.com/v1/organizations/cost_report?` + 
        `starting_at=${startDate.toISOString().split('T')[0]}&` +
        `ending_at=${endDate.toISOString().split('T')[0]}&` +
        `group_by=model`,
        {
          method: 'GET',
          headers: {
            'x-api-key': adminApiKey,
            'anthropic-version': '2023-06-01',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json() as { error?: { message?: string } };
        return { 
          error: errorData.error?.message || `Erro ${response.status}`,
          data: null,
        };
      }

      const data = await response.json();
      return { 
        data,
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      };
    } catch (error) {
      console.error('[AIUsage] Erro ao consultar Anthropic Admin API:', error);
      return { 
        error: error instanceof Error ? error.message : 'Erro de conexão',
        data: null,
      };
    }
  });

  // ===========================================
  // CONFIGURAÇÃO DE AI
  // ===========================================
  
  // Obtém configuração atual de AI
  app.get('/config', { preHandler: [authMiddleware, adminMiddleware] }, async () => {
    const globalCfg = await loadGlobalConfig();
    
    return {
      provider: globalCfg.ai.provider,
      anthropic: {
        apiKey: globalCfg.ai.anthropicApiKey ? '••••••••' + globalCfg.ai.anthropicApiKey.slice(-4) : '',
        adminApiKey: globalCfg.ai.anthropicAdminApiKey ? '••••••••' + globalCfg.ai.anthropicAdminApiKey.slice(-4) : '',
        model: globalCfg.ai.anthropicModel,
        isConfigured: !!globalCfg.ai.anthropicApiKey,
        hasAdminKey: !!globalCfg.ai.anthropicAdminApiKey,
      },
      openai: {
        apiKey: globalCfg.ai.openaiApiKey ? '••••••••' + globalCfg.ai.openaiApiKey.slice(-4) : '',
        model: globalCfg.ai.openaiModel,
        isConfigured: !!globalCfg.ai.openaiApiKey,
      },
      fallbackEnabled: globalCfg.ai.fallbackEnabled,
      availableModels: AVAILABLE_MODELS,
    };
  });

  // Salva configuração de AI
  app.put('/config', { preHandler: [authMiddleware, adminMiddleware] }, async (request) => {
    const body = request.body as {
      provider?: string;
      anthropicApiKey?: string;
      anthropicAdminApiKey?: string;
      anthropicModel?: string;
      openaiApiKey?: string;
      openaiModel?: string;
      fallbackEnabled?: boolean;
    };

    try {
      if (body.provider) {
        await saveGlobalConfigValue('ai.provider', body.provider);
      }
      if (body.anthropicApiKey) {
        await saveGlobalConfigValue('ai.anthropicApiKey', body.anthropicApiKey, true);
        // Também salva no campo legado para compatibilidade
        await saveGlobalConfigValue('anthropic.apiKey', body.anthropicApiKey, true);
      }
      if (body.anthropicAdminApiKey) {
        await saveGlobalConfigValue('ai.anthropicAdminApiKey', body.anthropicAdminApiKey, true);
      }
      if (body.anthropicModel) {
        await saveGlobalConfigValue('ai.anthropicModel', body.anthropicModel);
      }
      if (body.openaiApiKey) {
        await saveGlobalConfigValue('ai.openaiApiKey', body.openaiApiKey, true);
      }
      if (body.openaiModel) {
        await saveGlobalConfigValue('ai.openaiModel', body.openaiModel);
      }
      if (body.fallbackEnabled !== undefined) {
        await saveGlobalConfigValue('ai.fallbackEnabled', body.fallbackEnabled.toString());
      }

      return { success: true, message: 'Configuração de AI salva com sucesso' };
    } catch (error) {
      console.error('[AIUsage] Erro ao salvar configuração:', error);
      return { success: false, error: 'Erro ao salvar configuração' };
    }
  });

  // Testa conexão com provider
  app.post('/test/:provider', { preHandler: [authMiddleware, adminMiddleware] }, async (request) => {
    const { provider } = request.params as { provider: string };
    const globalCfg = await loadGlobalConfig();

    if (provider === 'anthropic') {
      const apiKey = globalCfg.ai.anthropicApiKey;
      if (!apiKey) {
        return { success: false, error: 'API Key da Anthropic não configurada' };
      }

      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: globalCfg.ai.anthropicModel || 'claude-sonnet-4-20250514',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        });

        if (response.ok) {
          return { success: true, message: 'Conexão com Anthropic OK!' };
        } else {
          const errorData = await response.json() as { error?: { message?: string } };
          return { success: false, error: errorData.error?.message || 'Erro desconhecido' };
        }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Erro de conexão' };
      }
    } else if (provider === 'openai') {
      const apiKey = globalCfg.ai.openaiApiKey;
      if (!apiKey) {
        return { success: false, error: 'API Key da OpenAI não configurada' };
      }

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: globalCfg.ai.openaiModel || 'gpt-4o',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        });

        if (response.ok) {
          return { success: true, message: 'Conexão com OpenAI OK!' };
        } else {
          const errorData = await response.json() as { error?: { message?: string } };
          return { success: false, error: errorData.error?.message || 'Erro desconhecido' };
        }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Erro de conexão' };
      }
    }

    return { success: false, error: 'Provider não suportado' };
  });
};

// Helper para obter nome amigável do agente
function getAgentName(agentId: string | null): string {
  if (!agentId) return 'Desconhecido';
  
  // Remove sufixo de userId (ex: email-agent-uuid -> Email Agent)
  const baseId = agentId.split('-').slice(0, -1).join('-') || agentId;
  
  const names: Record<string, string> = {
    'email-agent': 'Email Agent',
    'legal-agent': 'Legal Agent',
    'financial-agent': 'Financial Agent',
    'stablecoin-agent': 'Stablecoin Agent',
  };
  
  return names[baseId] || agentId;
}
