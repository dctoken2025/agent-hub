/**
 * AgentManager - Gerenciador de Agentes Multi-tenant
 * 
 * Responsável por criar, gerenciar e parar agentes para cada usuário.
 * Cada usuário tem suas próprias instâncias de agentes com suas configurações.
 */

import { AgentScheduler, Notifier, type Agent } from '@agent-hub/core';
import { EmailAgent, type EmailAgentConfig, type EmailAgentResult } from '@agent-hub/email-agent';
import { LegalAgent, type LegalAgentConfig } from '@agent-hub/legal-agent';
import { FinancialAgent, type FinancialAgentConfig } from '@agent-hub/financial-agent';
import { StablecoinAgent, type StablecoinAgentConfig } from '@agent-hub/stablecoin-agent';
import { getDb, users, userConfigs, agentLogs, stablecoins, stablecoinEvents, stablecoinAnomalies, supplySnapshots } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { loadUserConfig, loadGlobalConfig } from '../routes/config.js';
import { saveEmailsToDatabase, saveLegalAnalysesToDatabase, saveFinancialItemsToDatabase } from '../routes/emails.js';

interface UserAgentSet {
  userId: string;
  scheduler: AgentScheduler;
  emailAgent?: EmailAgent;
  legalAgent?: LegalAgent;
  financialAgent?: FinancialAgent;
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
          maxEmailsPerRun: userConfig.emailAgent.maxEmailsPerRun,
          unreadOnly: userConfig.emailAgent.unreadOnly,
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

        console.log(`[AgentManager] ✅ Financial Agent iniciado para usuário ${userId}`);
      } catch (error) {
        console.error(`[AgentManager] ❌ Erro ao inicializar Financial Agent:`, error);
      }
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
    agent.on('completed', async (event: { result: unknown; duration: number }) => {
      const db = getDb();
      if (!db) return;

      try {
        const agentResult = event.result as {
          success?: boolean;
          data?: EmailAgentResult;
        } | null;

        const data = agentResult?.data;

        // Se for o Email Agent, salva os dados no banco
        if (data && agent.getInfo().config.id.includes('email-agent')) {
          // Salva emails classificados
          if (data.emails && data.emails.length > 0) {
            await saveEmailsToDatabase(data.emails, userId);
          }
          
          // Salva análises jurídicas
          if (data.legalAnalyses && data.legalAnalyses.length > 0) {
            await saveLegalAnalysesToDatabase(data.legalAnalyses, userId);
          }
          
          // Salva itens financeiros
          if (data.financialItems && data.financialItems.length > 0) {
            await saveFinancialItemsToDatabase(data.financialItems, userId);
          }
        }

        await db.insert(agentLogs).values({
          userId,
          agentId: agent.getInfo().config.id,
          agentName: agent.getInfo().config.name,
          eventType: 'completed',
          success: true,
          duration: event.duration,
          processedCount: data?.processedCount || 0,
          details: {
            classifications: data?.classifications,
            contractsDetected: data?.contractsDetected,
            financialItemsDetected: data?.financialItemsDetected,
          },
        });
      } catch (error) {
        console.error(`[AgentManager] Erro ao registrar log:`, error);
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

    const agentId = `${agentType}-agent-${userId}`;
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

    const agentId = `${agentType}-agent-${userId}`;
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
