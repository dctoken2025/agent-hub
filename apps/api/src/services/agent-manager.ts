/**
 * AgentManager - Gerenciador de Agentes Multi-tenant
 * 
 * Responsável por criar, gerenciar e parar agentes para cada usuário.
 * Cada usuário tem suas próprias instâncias de agentes com suas configurações.
 */

import { 
  AgentScheduler, 
  Notifier, 
  type Agent,
  configureAIClient,
  setUsageSaveFunction,
  type UsageRecord
} from '@agent-hub/core';
import { EmailAgent, type EmailAgentConfig, type EmailAgentResult } from '@agent-hub/email-agent';
import { LegalAgent, type LegalAgentConfig } from '@agent-hub/legal-agent';
import { FinancialAgent, type FinancialAgentConfig } from '@agent-hub/financial-agent';
import { TaskAgent } from '@agent-hub/task-agent';
import { StablecoinAgent, type StablecoinAgentConfig } from '@agent-hub/stablecoin-agent';
import { getDb, users, userConfigs, agentLogs, stablecoins, stablecoinEvents, stablecoinAnomalies, supplySnapshots, aiUsageLogs } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { loadUserConfig, loadGlobalConfig } from '../routes/config.js';
import { saveEmailsToDatabase, saveLegalAnalysesToDatabase, saveFinancialItemsToDatabase, saveActionItemsToDatabase } from '../routes/emails.js';
import { createAgentLogger } from './activity-logger.js';

// Configura função de salvamento de uso de AI
async function saveUsageRecords(records: UsageRecord[]): Promise<void> {
  const db = getDb();
  if (!db || records.length === 0) return;

  try {
    for (const record of records) {
      await db.insert(aiUsageLogs).values({
        userId: record.userId || null,
        provider: record.provider,
        model: record.model,
        agentId: record.agentId || null,
        operation: record.operation || null,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        estimatedCost: record.estimatedCost,
        durationMs: record.durationMs,
        success: record.success,
        errorMessage: record.errorMessage || null,
        createdAt: record.createdAt,
      });
    }
    console.log(`[AgentManager] ${records.length} registro(s) de uso de AI salvos`);
  } catch (error) {
    console.error('[AgentManager] Erro ao salvar uso de AI:', error);
  }
}

// Inicializa o tracker de uso
setUsageSaveFunction(saveUsageRecords);

interface UserAgentSet {
  userId: string;
  scheduler: AgentScheduler;
  emailAgent?: EmailAgent;
  legalAgent?: LegalAgent;
  financialAgent?: FinancialAgent;
  taskAgent?: TaskAgent;
  stablecoinAgent?: StablecoinAgent;
}

export class AgentManager {
  private userAgents: Map<string, UserAgentSet> = new Map();

  /**
   * Inicializa agentes para um usuário específico.
   * Chamado quando usuário faz login ou quando configs mudam.
   */
  async initializeForUser(userId: string): Promise<void> {
    // Para agentes existentes desse usuário primeiro
    await this.stopForUser(userId);

    console.log(`[AgentManager] Inicializando agentes para usuário ${userId}`);

    // Carrega configs
    const userConfig = await loadUserConfig(userId);
    const globalConfig = await loadGlobalConfig();

    // Configura o AIClient com as credenciais do globalConfig
    configureAIClient({
      provider: (globalConfig.ai?.provider as 'anthropic' | 'openai') || 'anthropic',
      anthropicApiKey: globalConfig.ai?.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
      anthropicModel: globalConfig.ai?.anthropicModel,
      openaiApiKey: globalConfig.ai?.openaiApiKey || process.env.OPENAI_API_KEY,
      openaiModel: globalConfig.ai?.openaiModel,
      fallbackEnabled: globalConfig.ai?.fallbackEnabled ?? true,
    });

    // Busca dados do usuário (tokens Gmail)
    const db = getDb();
    if (!db) {
      console.error('[AgentManager] Banco de dados não disponível');
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      console.error(`[AgentManager] Usuário ${userId} não encontrado`);
      return;
    }

    // Cria scheduler dedicado para este usuário
    const scheduler = new AgentScheduler();
    const agentSet: UserAgentSet = { userId, scheduler };

    // Configura notifier se configurado
    const notifier = userConfig.notifications.slackWebhookUrl
      ? new Notifier({ slack: { webhookUrl: userConfig.notifications.slackWebhookUrl } })
      : undefined;

    // ===========================================
    // Inicializa Email Agent
    // ===========================================
    if (userConfig.emailAgent.enabled && user.gmailTokens && globalConfig.gmail.clientId) {
      try {
        // Define variáveis de ambiente para o GmailClient
        process.env.GMAIL_CLIENT_ID = globalConfig.gmail.clientId;
        process.env.GMAIL_CLIENT_SECRET = globalConfig.gmail.clientSecret;
        process.env.GMAIL_REDIRECT_URI = globalConfig.gmail.redirectUri;

        const emailConfig: EmailAgentConfig = {
          userEmail: user.email,
          vipSenders: userConfig.vipSenders,
          ignoreSenders: userConfig.ignoreSenders,
          labelsToProcess: ['INBOX'],
          maxEmailsPerRun: userConfig.emailAgent.maxEmailsPerRun || 100,
          unreadOnly: userConfig.emailAgent.unreadOnly ?? true,
          startDate: userConfig.emailAgent.startDate,
          lastProcessedAt: userConfig.emailAgent.lastProcessedAt,
          // Passa tokens do usuário
          gmailTokens: user.gmailTokens as Record<string, unknown>,
        };

        const emailAgent = new EmailAgent(
          {
            id: `email-agent-${userId}`,
            name: 'Email Agent',
            description: 'Agente de classificação e triagem de emails',
            enabled: true,
            schedule: {
              type: 'interval',
              value: userConfig.emailAgent.intervalMinutes,
            },
          },
          emailConfig,
          notifier
        );

        // Aplica regras personalizadas
        if (userConfig.emailAgent.customRules?.length > 0) {
          emailAgent.setCustomRules(userConfig.emailAgent.customRules);
        }

        // Registra eventos para logging
        this.setupAgentLogging(emailAgent, userId);

        scheduler.register(emailAgent);
        agentSet.emailAgent = emailAgent;

        console.log(`[AgentManager] ✅ Email Agent iniciado para ${user.email}`);
      } catch (error) {
        console.error(`[AgentManager] ❌ Erro ao inicializar Email Agent:`, error);
      }
    } else {
      if (!userConfig.emailAgent.enabled) {
        console.log(`[AgentManager] ⏸️ Email Agent desabilitado para usuário ${userId}`);
      } else if (!user.gmailTokens) {
        console.log(`[AgentManager] ⚠️ Email Agent: Gmail não conectado para usuário ${userId}`);
      } else if (!globalConfig.gmail.clientId) {
        console.log(`[AgentManager] ⚠️ Email Agent: Gmail não configurado pelo admin`);
      }
    }

    // ===========================================
    // Inicializa Legal Agent
    // ===========================================
    if (userConfig.legalAgent.enabled && globalConfig.anthropic.apiKey) {
      try {
        // Define API Key da Anthropic
        process.env.ANTHROPIC_API_KEY = globalConfig.anthropic.apiKey;

        const legalConfig: LegalAgentConfig = {
          supportedMimeTypes: [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
          ],
          maxDocumentSize: userConfig.legalAgent.maxDocumentSizeMB * 1024 * 1024,
          contractKeywords: userConfig.legalAgent.contractKeywords,
        };

        const legalAgent = new LegalAgent(
          {
            id: `legal-agent-${userId}`,
            name: 'Legal Agent',
            description: 'Agente de análise de contratos e documentos legais',
            enabled: true,
            schedule: {
              type: 'manual',
            },
          },
          legalConfig,
          notifier
        );

        // Registra eventos para logging
        this.setupAgentLogging(legalAgent, userId);

        scheduler.register(legalAgent);
        agentSet.legalAgent = legalAgent;

        console.log(`[AgentManager] ✅ Legal Agent iniciado para usuário ${userId}`);
      } catch (error) {
        console.error(`[AgentManager] ❌ Erro ao inicializar Legal Agent:`, error);
      }
    }

    // ===========================================
    // Inicializa Financial Agent
    // ===========================================
    if (userConfig.financialAgent.enabled && globalConfig.anthropic.apiKey) {
      try {
        // Define API Key da Anthropic
        process.env.ANTHROPIC_API_KEY = globalConfig.anthropic.apiKey;

        const financialConfig: FinancialAgentConfig = {
          financialKeywords: userConfig.financialAgent.financialKeywords,
          supportedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg'],
          maxAttachmentSize: 5 * 1024 * 1024, // 5MB
          urgentDaysBeforeDue: userConfig.financialAgent.urgentDaysBeforeDue,
          approvalThreshold: userConfig.financialAgent.approvalThreshold,
        };

        const financialAgent = new FinancialAgent(
          {
            id: `financial-agent-${userId}`,
            name: 'Financial Agent',
            description: 'Agente de análise de cobranças e pagamentos',
            enabled: true,
            schedule: {
              type: 'manual',
            },
          },
          financialConfig,
          notifier
        );

        // Registra eventos para logging
        this.setupAgentLogging(financialAgent, userId);

        scheduler.register(financialAgent);
        agentSet.financialAgent = financialAgent;

        // Injeta no Email Agent para que use a mesma instância com logging
        if (agentSet.emailAgent) {
          agentSet.emailAgent.setFinancialAgent(financialAgent);
        }

        console.log(`[AgentManager] ✅ Financial Agent iniciado para usuário ${userId}`);
      } catch (error) {
        console.error(`[AgentManager] ❌ Erro ao inicializar Financial Agent:`, error);
      }
    }

    // Injeta Legal Agent no Email Agent também
    if (agentSet.legalAgent && agentSet.emailAgent) {
      agentSet.emailAgent.setLegalAgent(agentSet.legalAgent);
    }

    // ===========================================
    // Inicializa Task Agent
    // ===========================================
    try {
      const taskAgent = new TaskAgent(
        {
          id: `task-agent-${userId}`,
          name: 'Task Agent',
          description: 'Agente de extração de tarefas e action items',
          enabled: true,
          schedule: {
            type: 'manual',
          },
        },
        {
          // Configuração padrão - pode ser customizada futuramente
          generateSuggestedReply: true,
          urgentDaysThreshold: 3,
        }
      );

      // Registra eventos para logging
      this.setupAgentLogging(taskAgent, userId);

      agentSet.taskAgent = taskAgent;

      // Injeta no Email Agent
      if (agentSet.emailAgent) {
        agentSet.emailAgent.setTaskAgent(taskAgent);
      }

      console.log(`[AgentManager] ✅ Task Agent iniciado para usuário ${userId}`);
    } catch (error) {
      console.error(`[AgentManager] Erro ao inicializar Task Agent:`, error);
    }

    // ===========================================
    // Inicializa Stablecoin Agent
    // ===========================================
    if (userConfig.stablecoinAgent.enabled && globalConfig.alchemy.apiKey) {
      try {
        // Busca stablecoins do usuário
        const userStablecoins = await db
          .select()
          .from(stablecoins)
          .where(eq(stablecoins.userId, userId));

        if (userStablecoins.length > 0) {
          const stablecoinConfigs = userStablecoins.map((s) => ({
            id: s.id,
            address: s.address,
            name: s.name,
            symbol: s.symbol,
            decimals: s.decimals,
            network: s.network as 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'base',
          }));

          const agentConfig: StablecoinAgentConfig = {
            alchemyApiKey: globalConfig.alchemy.apiKey,
            networks: ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism'],
            thresholds: userConfig.stablecoinAgent.thresholds,
          };

          const stablecoinAgent = new StablecoinAgent(
            {
              id: `stablecoin-agent-${userId}`,
              name: 'Stablecoin Agent',
              description: 'Agente de monitoramento de stablecoins',
              enabled: true,
              schedule: {
                type: 'interval',
                value: userConfig.stablecoinAgent.checkInterval,
              },
            },
            agentConfig,
            notifier
          );

          stablecoinAgent.setStablecoins(stablecoinConfigs);

          // Callbacks para persistir dados
          stablecoinAgent.onEventDetected = async (event) => {
            try {
              const stablecoin = userStablecoins.find(
                (s) => s.address.toLowerCase() === event.stablecoin.address.toLowerCase()
              );
              if (!stablecoin) return;

              await db.insert(stablecoinEvents).values({
                userId,
                stablecoinId: stablecoin.id,
                txHash: event.txHash,
                blockNumber: event.blockNumber,
                logIndex: event.logIndex,
                eventType: event.eventType,
                fromAddress: event.from,
                toAddress: event.to,
                amount: event.amount.toString(),
                amountFormatted: event.amountFormatted,
                isAnomaly: false,
                timestamp: event.timestamp,
              });
            } catch (err) {
              console.error(`[AgentManager] Erro ao salvar evento:`, err);
            }
          };

          stablecoinAgent.onAnomalyDetected = async (alert) => {
            try {
              const stablecoin = alert.event
                ? userStablecoins.find(
                    (s) =>
                      s.address.toLowerCase() === alert.event!.stablecoin.address.toLowerCase()
                  )
                : null;

              await db.insert(stablecoinAnomalies).values({
                userId,
                stablecoinId: stablecoin?.id || null,
                eventId: null,
                alertType: alert.type,
                severity: alert.severity,
                title: alert.title,
                description: alert.description,
                metadata: alert.metadata,
                isAcknowledged: false,
              });
            } catch (err) {
              console.error(`[AgentManager] Erro ao salvar anomalia:`, err);
            }
          };

          stablecoinAgent.onSupplySnapshot = async (snapshot) => {
            try {
              const stablecoin = userStablecoins.find((s) => s.id === snapshot.stablecoinId);
              if (!stablecoin) return;

              await db.insert(supplySnapshots).values({
                userId,
                stablecoinId: stablecoin.id,
                supply: snapshot.supply.toString(),
                supplyFormatted: snapshot.supplyFormatted,
                blockNumber: snapshot.blockNumber,
                changePercent: snapshot.changePercent?.toString(),
              });

              await db
                .update(stablecoins)
                .set({ lastSupply: snapshot.supply.toString(), lastCheckedAt: new Date() })
                .where(eq(stablecoins.id, stablecoin.id));
            } catch (err) {
              console.error(`[AgentManager] Erro ao salvar snapshot:`, err);
            }
          };

          // Registra eventos para logging
          this.setupAgentLogging(stablecoinAgent, userId);

          scheduler.register(stablecoinAgent);
          agentSet.stablecoinAgent = stablecoinAgent;

          console.log(
            `[AgentManager] ✅ Stablecoin Agent iniciado para usuário ${userId} (${stablecoinConfigs.length} tokens)`
          );
        } else {
          console.log(
            `[AgentManager] ⚠️ Stablecoin Agent: Nenhuma stablecoin cadastrada para usuário ${userId}`
          );
        }
      } catch (error) {
        console.error(`[AgentManager] ❌ Erro ao inicializar Stablecoin Agent:`, error);
      }
    }

    // Guarda referência
    this.userAgents.set(userId, agentSet);

    // Inicia todos os agentes registrados
    await scheduler.startAll();

    console.log(`[AgentManager] ✅ Agentes iniciados para usuário ${userId}`);
  }

  /**
   * Configura logging de eventos do agente.
   */
  private setupAgentLogging(agent: Agent, userId: string): void {
    const agentId = agent.getInfo().config.id;
    const agentName = agent.getInfo().config.name;
    const logger = createAgentLogger(userId, agentId, agentName);

    // Log quando agente inicia
    agent.on('started', () => {
      logger.success('Agente iniciado', '🚀');
    });

    // Log quando agente é pausado
    agent.on('paused', () => {
      logger.info('Agente pausado', '⏸️');
    });

    agent.on('completed', async (event: { result: unknown; duration: number }) => {
      const db = getDb();
      if (!db) return;

      try {
        const agentResult = event.result as {
          success?: boolean;
          data?: unknown;
        } | null;

        const data = agentResult?.data as Record<string, unknown> | undefined;
        
        let processedCount = 0;
        let details: Record<string, unknown> = {};

        // Extrai informações específicas de cada tipo de agente e loga detalhes
        if (agentId.includes('email-agent')) {
          const emailData = data as EmailAgentResult | undefined;
          processedCount = emailData?.processedCount || 0;
          details = {
            classifications: emailData?.classifications,
            contractsDetected: emailData?.contractsDetected,
            financialItemsDetected: emailData?.financialItemsDetected,
          };

          // Log detalhado
          if (processedCount > 0) {
            logger.success(`${processedCount} email(s) processado(s)`, '📧');
            if (emailData?.classifications) {
              const c = emailData.classifications;
              logger.detail(`🔴 ${c.urgent} urgentes • 📌 ${c.attention} atenção • 📋 ${c.informative} informativos • 📁 ${c.low} baixa`);
            }
            if (emailData?.contractsDetected && emailData.contractsDetected > 0) {
              logger.detail(`📄 ${emailData.contractsDetected} contrato(s) detectado(s)`);
            }
            if (emailData?.financialItemsDetected && emailData.financialItemsDetected > 0) {
              logger.detail(`💰 ${emailData.financialItemsDetected} item(ns) financeiro(s) detectado(s)`);
            }
          } else {
            logger.info('Nenhum email novo para processar', '📭');
          }

          // Salva dados no banco
          if (emailData?.emails && emailData.emails.length > 0) {
            await saveEmailsToDatabase(emailData.emails, userId);
          }
          if (emailData?.legalAnalyses && emailData.legalAnalyses.length > 0) {
            await saveLegalAnalysesToDatabase(emailData.legalAnalyses, userId);
          }
          if (emailData?.financialItems && emailData.financialItems.length > 0) {
            await saveFinancialItemsToDatabase(emailData.financialItems, userId);
          }
          if (emailData?.actionItems && emailData.actionItems.length > 0) {
            await saveActionItemsToDatabase(emailData.actionItems, userId);
          }
        } else if (agentId.includes('legal-agent')) {
          const legalData = data as { 
            analysesCount?: number; 
            documents?: Array<{ filename?: string; riskLevel?: string; requiresAttention?: boolean }>;
            summary?: string;
          } | undefined;
          processedCount = legalData?.analysesCount || (legalData?.documents?.length || 0);
          details = { analysesCount: processedCount, summary: legalData?.summary };

          if (processedCount > 0) {
            logger.success(`${processedCount} documento(s) analisado(s)`, '📋');
            legalData?.documents?.forEach((doc) => {
              const riskEmoji = doc.riskLevel === 'high' ? '🔴' : doc.riskLevel === 'medium' ? '🟡' : '🟢';
              logger.detail(`${riskEmoji} ${doc.filename || 'Documento'} - Risco: ${doc.riskLevel || 'N/A'}`);
            });
          } else {
            logger.info('Nenhum documento para analisar neste ciclo', '📭');
          }
        } else if (agentId.includes('financial-agent')) {
          const financialData = data as { 
            itemsFound?: number; 
            items?: Array<{ creditor?: string; amount?: number; dueDate?: string; status?: string }>;
            totalAmount?: number; 
            hasUrgentItems?: boolean; 
            hasOverdueItems?: boolean;
          } | undefined;
          processedCount = financialData?.itemsFound || (financialData?.items?.length || 0);
          details = {
            itemsFound: processedCount,
            totalAmount: financialData?.totalAmount,
            hasUrgentItems: financialData?.hasUrgentItems,
            hasOverdueItems: financialData?.hasOverdueItems,
          };

          if (processedCount > 0) {
            logger.success(`${processedCount} cobrança(s) identificada(s)`, '💰');
            if (financialData?.totalAmount) {
              const total = (financialData.totalAmount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
              logger.detail(`💵 Total: ${total}`);
            }
            if (financialData?.hasOverdueItems) {
              logger.warning('Há itens vencidos!', '🔴');
            }
            if (financialData?.hasUrgentItems) {
              logger.warning('Há itens urgentes!', '⚠️');
            }
            financialData?.items?.forEach((item) => {
              const amount = item.amount ? (item.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'N/A';
              logger.detail(`${item.creditor}: ${amount}`);
            });
          } else {
            logger.info('Nenhuma cobrança identificada neste email', '📭');
          }
        } else if (agentId.includes('stablecoin-agent')) {
          const stablecoinData = data as { eventsDetected?: number; anomalies?: unknown[] } | undefined;
          processedCount = stablecoinData?.eventsDetected || (stablecoinData?.anomalies?.length || 0);
          details = { eventsDetected: processedCount };

          if (processedCount > 0) {
            logger.success(`${processedCount} evento(s) detectado(s)`, '🪙');
          } else {
            logger.info('Nenhuma atividade significativa', '📊');
          }
        }

        // Log de conclusão com duração
        const durationSec = (event.duration / 1000).toFixed(2);
        logger.info(`Execução concluída em ${durationSec}s`, '✅');

        await db.insert(agentLogs).values({
          userId,
          agentId,
          agentName,
          eventType: 'completed',
          success: true,
          duration: event.duration,
          processedCount,
          details,
        });

      } catch (error) {
        console.error(`[AgentManager] Erro ao registrar log:`, error);
        logger.error(`Erro ao processar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    });

    agent.on('failed', async (event: { error: unknown }) => {
      const db = getDb();
      if (!db) return;

      try {
        await db.insert(agentLogs).values({
          userId,
          agentId: agent.getInfo().config.id,
          agentName: agent.getInfo().config.name,
          eventType: 'failed',
          success: false,
          errorMessage: event.error instanceof Error ? event.error.message : String(event.error),
        });
      } catch (error) {
        console.error(`[AgentManager] Erro ao registrar log de falha:`, error);
      }
    });
  }

  /**
   * Para todos os agentes de um usuário.
   */
  async stopForUser(userId: string): Promise<void> {
    const agentSet = this.userAgents.get(userId);
    if (agentSet) {
      await agentSet.scheduler.stopAll();
      this.userAgents.delete(userId);
      console.log(`[AgentManager] Agentes parados para usuário ${userId}`);
    }
  }

  /**
   * Inicia um agente específico do usuário.
   */
  async startAgent(userId: string, agentType: string): Promise<void> {
    const agentSet = this.userAgents.get(userId);
    if (!agentSet) {
      // Inicializa agentes do usuário primeiro
      await this.initializeForUser(userId);
      return;
    }

    const agentId = `${agentType}-agent-${userId}`;
    await agentSet.scheduler.start(agentId);
  }

  /**
   * Para um agente específico do usuário.
   */
  async stopAgent(userId: string, agentType: string): Promise<void> {
    const agentSet = this.userAgents.get(userId);
    if (!agentSet) {
      throw new Error('Agentes não inicializados para este usuário');
    }

    // O agentType já inclui "-agent" (ex: "email-agent"), então o ID é apenas agentType-userId
    const agentId = `${agentType}-${userId}`;
    await agentSet.scheduler.stop(agentId);
  }

  /**
   * Executa um agente uma vez manualmente.
   */
  async runAgentOnce(userId: string, agentType: string, input?: unknown): Promise<void> {
    let agentSet = this.userAgents.get(userId);
    if (!agentSet) {
      // Inicializa agentes do usuário primeiro
      await this.initializeForUser(userId);
      agentSet = this.userAgents.get(userId);
    }

    if (!agentSet) {
      throw new Error('Não foi possível inicializar agentes');
    }

    // O agentType já inclui "-agent" (ex: "email-agent"), então o ID é apenas agentType-userId
    const agentId = `${agentType}-${userId}`;
    await agentSet.scheduler.runOnce(agentId, input);
  }

  /**
   * Retorna informações dos agentes de um usuário.
   */
  getUserAgents(userId: string): Array<ReturnType<Agent['getInfo']>> {
    const agentSet = this.userAgents.get(userId);
    if (!agentSet) return [];
    return agentSet.scheduler.getAgents();
  }

  /**
   * Retorna informações de um agente específico.
   */
  getAgentInfo(userId: string, agentId: string): ReturnType<Agent['getInfo']> | null {
    const agentSet = this.userAgents.get(userId);
    if (!agentSet) return null;
    return agentSet.scheduler.getAgent(agentId);
  }

  /**
   * Atualiza configurações de um agente e reinicia.
   */
  async updateAgentConfig(userId: string, _agentType?: string): Promise<void> {
    // Reinicializa agentes com novas configs
    await this.initializeForUser(userId);
  }

  /**
   * Lista todos os usuários com agentes ativos.
   */
  getActiveUsers(): string[] {
    return Array.from(this.userAgents.keys());
  }

  /**
   * Para todos os agentes de todos os usuários.
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.userAgents.keys()).map((userId) =>
      this.stopForUser(userId)
    );
    await Promise.all(stopPromises);
    console.log('[AgentManager] Todos os agentes parados');
  }

  /**
   * Salva o estado de ativação dos agentes no banco.
   */
  async setAgentsActiveState(userId: string, active: boolean): Promise<void> {
    const db = getDb();
    if (!db) return;

    try {
      await db
        .update(userConfigs)
        .set({ agentsActive: active, updatedAt: new Date() })
        .where(eq(userConfigs.userId, userId));
      console.log(`[AgentManager] Estado dos agentes salvo: ${userId} -> ${active ? 'ativo' : 'inativo'}`);
    } catch (error) {
      console.error('[AgentManager] Erro ao salvar estado dos agentes:', error);
    }
  }

  /**
   * Auto-inicia agentes de todos os usuários que tinham agentes ativos.
   * Chamado quando o servidor inicia.
   */
  async autoStartAgents(): Promise<void> {
    const db = getDb();
    if (!db) {
      console.log('[AgentManager] Banco não disponível para auto-start');
      return;
    }

    try {
      // Busca todos os usuários com agentes ativos
      const activeConfigs = await db
        .select({ userId: userConfigs.userId })
        .from(userConfigs)
        .where(eq(userConfigs.agentsActive, true));

      if (activeConfigs.length === 0) {
        console.log('[AgentManager] 🔄 Nenhum usuário com agentes ativos para auto-iniciar');
        return;
      }

      console.log(`[AgentManager] 🚀 Auto-iniciando agentes para ${activeConfigs.length} usuário(s)...`);

      for (const config of activeConfigs) {
        try {
          console.log(`[AgentManager] 🔄 Iniciando agentes para ${config.userId}...`);
          await this.initializeForUser(config.userId);
          console.log(`[AgentManager] ✅ Agentes iniciados para ${config.userId}`);
        } catch (error) {
          console.error(`[AgentManager] ❌ Erro ao auto-iniciar agentes para ${config.userId}:`, error);
        }
      }

      console.log('[AgentManager] ✅ Auto-start concluído');
    } catch (error) {
      console.error('[AgentManager] ❌ Erro no auto-start:', error);
    }
  }
}

// Singleton
let agentManager: AgentManager | null = null;

export function getAgentManager(): AgentManager {
  if (!agentManager) {
    agentManager = new AgentManager();
  }
  return agentManager;
}
