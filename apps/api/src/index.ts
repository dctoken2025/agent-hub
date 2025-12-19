import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Carrega .env da raiz do projeto
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { getScheduler, Notifier } from '@agent-hub/core';
import { EmailAgent, type EmailAgentConfig } from '@agent-hub/email-agent';
import { LegalAgent, type LegalAgentConfig } from '@agent-hub/legal-agent';
import { StablecoinAgent, type StablecoinAgentConfig } from '@agent-hub/stablecoin-agent';
import { initDatabase, getDb, agentLogs, stablecoins, stablecoinEvents, stablecoinAnomalies, supplySnapshots } from './db/index.js';
import { eq } from 'drizzle-orm';
import { agentRoutes } from './routes/agents.js';
import { emailRoutes } from './routes/emails.js';
import { authRoutes } from './routes/auth.js';
import { configRoutes, loadConfig } from './routes/config.js';
import { legalRoutes } from './routes/legal.js';
import { stablecoinRoutes } from './routes/stablecoins.js';

// Inicializa banco de dados
initDatabase();

const PORT = parseInt(process.env.API_PORT || '3001');

import * as fs from 'fs';

async function initializeEmailAgent() {
  try {
    // Carrega configurações do banco
    const config = await loadConfig();
    
    // Verifica se Gmail está configurado e autenticado
    if (!config.gmail.clientId || !config.gmail.clientSecret) {
      console.log('⚠️  Email Agent: Gmail não configurado');
      return null;
    }

    if (!config.user.email) {
      console.log('⚠️  Email Agent: Email do usuário não configurado');
      return null;
    }

    // Escreve tokens do banco para arquivo para o GmailClient usar
    // Usa o mesmo caminho que o GmailClient vai procurar
    if (config.gmail.tokens) {
      // Escreve em vários lugares para garantir que será encontrado
      const tokenPaths = [
        path.join(process.cwd(), 'gmail-tokens.json'),
        path.join(__dirname, '../../../gmail-tokens.json'),
        '/Users/danielcoquieri/agent-hub/gmail-tokens.json',
      ];
      for (const tokenPath of tokenPaths) {
        try {
          fs.writeFileSync(tokenPath, JSON.stringify(config.gmail.tokens, null, 2));
          console.log('📝 Tokens do Gmail escritos em:', tokenPath);
        } catch (err) {
          console.log('⚠️  Não foi possível escrever tokens em:', tokenPath);
        }
      }
    } else {
      console.log('⚠️  Email Agent: Gmail não autorizado (tokens não encontrados)');
      return null;
    }

    // Define variáveis de ambiente para o GmailClient
    process.env.GMAIL_CLIENT_ID = config.gmail.clientId;
    process.env.GMAIL_CLIENT_SECRET = config.gmail.clientSecret;
    process.env.GMAIL_REDIRECT_URI = config.gmail.redirectUri || 'http://localhost:3001/api/auth/gmail/callback';

    // Define API Key da Anthropic para o AIClient
    if (config.anthropic.apiKey) {
      process.env.ANTHROPIC_API_KEY = config.anthropic.apiKey;
      console.log('🤖 Anthropic API Key configurada');
    } else {
      console.log('⚠️  Anthropic API Key não configurada - classificação usará fallback');
    }

    const emailConfig: EmailAgentConfig = {
      userEmail: config.user.email,
      vipSenders: config.user.vipSenders,
      ignoreSenders: config.user.ignoreSenders,
      labelsToProcess: ['INBOX'],
      maxEmailsPerRun: 1500,
      unreadOnly: true,
    };

    const notifier = config.notifications.slackWebhookUrl
      ? new Notifier({ slack: { webhookUrl: config.notifications.slackWebhookUrl } })
      : undefined;

    const emailAgent = new EmailAgent(
      {
        id: 'email-agent',
        name: 'Email Agent',
        description: 'Agente de classificação e triagem de emails',
        enabled: true,
        schedule: {
          type: 'interval',
          value: config.emailAgent?.intervalMinutes || config.settings.emailCheckInterval,
        },
      },
      emailConfig,
      notifier
    );

    // Aplica regras personalizadas se existirem
    if (config.emailAgent?.customRules?.length > 0) {
      emailAgent.setCustomRules(config.emailAgent.customRules);
      console.log(`📋 ${config.emailAgent.customRules.length} regras personalizadas carregadas`);
    }

    const scheduler = getScheduler();
    scheduler.register(emailAgent);

    console.log('📧 Email Agent registrado');
    console.log(`   📬 Email: ${config.user.email}`);
    console.log(`   ⏱️  Intervalo: ${config.emailAgent?.intervalMinutes || config.settings.emailCheckInterval} minutos`);
    console.log(`   ⭐ VIPs: ${config.user.vipSenders.length} configurados`);

    return emailAgent;
  } catch (error) {
    console.error('❌ Erro ao inicializar Email Agent:', error);
    return null;
  }
}

async function initializeLegalAgent() {
  try {
    // Carrega configurações do banco
    const config = await loadConfig();
    
    // Legal Agent precisa de API key da Anthropic
    if (!config.anthropic.apiKey) {
      console.log('⚠️  Legal Agent: Anthropic API Key não configurada');
      return null;
    }

    const legalConfig: LegalAgentConfig = {
      supportedMimeTypes: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
      ],
      maxDocumentSize: 10 * 1024 * 1024, // 10MB
      contractKeywords: [
        'contrato', 'acordo', 'termo', 'aditivo', 'procuração',
        'minuta', 'proposta', 'contract', 'agreement', 'amendment',
      ],
    };

    const notifier = config.notifications.slackWebhookUrl
      ? new Notifier({ slack: { webhookUrl: config.notifications.slackWebhookUrl } })
      : undefined;

    const legalAgent = new LegalAgent(
      {
        id: 'legal-agent',
        name: 'Legal Agent',
        description: 'Agente de análise de contratos e documentos legais',
        enabled: true,
        // Legal Agent é acionado pelo Email Agent, não por schedule
        schedule: {
          type: 'manual',
        },
      },
      legalConfig,
      notifier
    );

    const scheduler = getScheduler();
    scheduler.register(legalAgent);

    // Registra logs do Legal Agent quando executado
    legalAgent.on('completed', async (event: { result: unknown; duration: number }) => {
      const db = getDb();
      if (!db) return;
      
      try {
        await db.insert(agentLogs).values({
          agentId: 'legal-agent',
          agentName: 'Legal Agent',
          eventType: 'completed',
          success: true,
          duration: event.duration,
          details: event.result as Record<string, unknown>,
        });
        console.log('[LegalAgent] Log de execução registrado');
      } catch (error) {
        console.error('[LegalAgent] Erro ao registrar log:', error);
      }
    });

    console.log('📜 Legal Agent registrado');
    console.log('   📄 Formatos: PDF, DOCX, DOC');
    console.log('   🔗 Integrado ao Email Agent');

    return legalAgent;
  } catch (error) {
    console.error('❌ Erro ao inicializar Legal Agent:', error);
    return null;
  }
}

async function initializeStablecoinAgent() {
  try {
    const config = await loadConfig();
    
    if (!config.alchemy?.apiKey) {
      console.log('⚠️  Stablecoin Agent: Alchemy API Key não configurada');
      return null;
    }

    const db = getDb();
    if (!db) {
      console.log('⚠️  Stablecoin Agent: Banco de dados não disponível');
      return null;
    }

    const activeStablecoins = await db.select().from(stablecoins).where(eq(stablecoins.isActive, true));
    
    const stablecoinConfigs = activeStablecoins.map(s => ({
      id: s.id,
      address: s.address,
      name: s.name,
      symbol: s.symbol,
      decimals: s.decimals,
      network: s.network as 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'base',
    }));

    const agentConfig: StablecoinAgentConfig = {
      alchemyApiKey: config.alchemy.apiKey,
      networks: ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism'],
      thresholds: config.stablecoin?.thresholds || {
        largeMint: 10000000,
        largeBurn: 10000000,
        largeTransfer: 5000000,
        supplyChangePercent: 1,
        frequencyPerHour: 100,
      },
    };

    const notifier = config.notifications.slackWebhookUrl
      ? new Notifier({ slack: { webhookUrl: config.notifications.slackWebhookUrl } })
      : undefined;

    const stablecoinAgent = new StablecoinAgent(
      {
        id: 'stablecoin-agent',
        name: 'Stablecoin Agent',
        description: 'Agente de monitoramento de stablecoins na blockchain',
        enabled: true,
        schedule: {
          type: 'interval',
          value: config.stablecoin?.checkInterval || 60,
        },
      },
      agentConfig,
      notifier
    );

    // Define as stablecoins a serem monitoradas
    stablecoinAgent.setStablecoins(stablecoinConfigs);

    // Callbacks para persistir dados no banco
    stablecoinAgent.onEventDetected = async (event) => {
      try {
        const stablecoin = activeStablecoins.find(
          s => s.address.toLowerCase() === event.stablecoin.address.toLowerCase()
        );
        if (!stablecoin) return;

        await db.insert(stablecoinEvents).values({
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
        console.error('[StablecoinAgent] Erro ao salvar evento:', err);
      }
    };

    stablecoinAgent.onAnomalyDetected = async (alert) => {
      try {
        // Tenta encontrar o stablecoin pelo evento associado
        const stablecoin = alert.event 
          ? activeStablecoins.find(s => s.address.toLowerCase() === alert.event!.stablecoin.address.toLowerCase())
          : null;
        
        await db.insert(stablecoinAnomalies).values({
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
        console.error('[StablecoinAgent] Erro ao salvar anomalia:', err);
      }
    };

    stablecoinAgent.onSupplySnapshot = async (snapshot) => {
      try {
        // Usa o stablecoinId diretamente do snapshot
        const stablecoin = activeStablecoins.find(s => s.id === snapshot.stablecoinId);
        if (!stablecoin) return;

        await db.insert(supplySnapshots).values({
          stablecoinId: stablecoin.id,
          supply: snapshot.supply.toString(),
          supplyFormatted: snapshot.supplyFormatted,
          blockNumber: snapshot.blockNumber,
          changePercent: snapshot.changePercent?.toString(),
        });

        await db.update(stablecoins)
          .set({ lastSupply: snapshot.supply.toString(), lastCheckedAt: new Date() })
          .where(eq(stablecoins.id, stablecoin.id));
      } catch (err) {
        console.error('[StablecoinAgent] Erro ao salvar snapshot:', err);
      }
    };

    const scheduler = getScheduler();
    scheduler.register(stablecoinAgent);

    console.log('💰 Stablecoin Agent registrado');
    console.log(`   🔗 Alchemy API configurada`);
    console.log(`   📊 Stablecoins monitoradas: ${stablecoinConfigs.length}`);
    console.log(`   ⏱️  Intervalo: ${config.stablecoin?.checkInterval || 60} minutos`);

    return stablecoinAgent;
  } catch (error) {
    console.error('❌ Erro ao inicializar Stablecoin Agent:', error);
    return null;
  }
}

async function main() {
  const app = Fastify({
    logger: true,
  });

  // CORS para o dashboard
  await app.register(cors, {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  });

  // Registra rotas
  await app.register(agentRoutes, { prefix: '/api/agents' });
  await app.register(emailRoutes, { prefix: '/api/emails' });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(configRoutes, { prefix: '/api/config' });
  await app.register(legalRoutes, { prefix: '/api/legal' });
  await app.register(stablecoinRoutes, { prefix: '/api/stablecoins' });

  // Health check
  app.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Inicia servidor
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 API rodando em http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:5173`);
    
    // Inicializa agentes após servidor estar pronto
    await initializeEmailAgent();
    await initializeLegalAgent();
    await initializeStablecoinAgent();
    
    // Inicia todos os agentes automaticamente
    const scheduler = getScheduler();
    console.log('\n🚀 Iniciando execução automática dos agentes...');
    await scheduler.startAll();
    console.log('✅ Todos os agentes foram iniciados!\n');
    
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
