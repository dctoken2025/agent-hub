import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { getDb, appConfig, isDatabaseConnected } from '../db/index.js';

interface AppConfigData {
  anthropic: {
    apiKey: string;
  };
  gmail: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    tokens?: {
      access_token: string;
      refresh_token?: string;
      scope?: string;
      token_type?: string;
      expiry_date?: number;
    };
  };
  alchemy: {
    apiKey: string;
  };
  user: {
    email: string;
    vipSenders: string[];
    ignoreSenders: string[];
  };
  notifications: {
    slackWebhookUrl?: string;
    telegramBotToken?: string;
    telegramChatId?: string;
  };
  settings: {
    emailCheckInterval: number;
    stablecoinCheckInterval: number;
  };
  stablecoin: {
    thresholds: {
      largeMint: number;
      largeBurn: number;
      largeTransfer: number;
      supplyChangePercent: number;
    };
  };
}

// Carrega config do banco ou das env vars
async function loadConfig(): Promise<AppConfigData> {
  const defaults: AppConfigData = {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    },
    gmail: {
      clientId: process.env.GMAIL_CLIENT_ID || '',
      clientSecret: process.env.GMAIL_CLIENT_SECRET || '',
      redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:3001/api/auth/gmail/callback',
    },
    alchemy: {
      apiKey: process.env.ALCHEMY_API_KEY || '',
    },
    user: {
      email: process.env.USER_EMAIL || '',
      vipSenders: (process.env.VIP_SENDERS || '').split(',').filter(Boolean),
      ignoreSenders: (process.env.IGNORE_SENDERS || 'newsletter,marketing,noreply').split(',').filter(Boolean),
    },
    notifications: {
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
      telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
      telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
    },
    settings: {
      emailCheckInterval: parseInt(process.env.EMAIL_CHECK_INTERVAL || '5'),
      stablecoinCheckInterval: parseInt(process.env.STABLECOIN_CHECK_INTERVAL || '60'),
    },
    stablecoin: {
      thresholds: {
        largeMint: 10000000,
        largeBurn: 10000000,
        largeTransfer: 50000000,
        supplyChangePercent: 1,
      },
    },
  };

  const db = getDb();
  if (!db || !isDatabaseConnected()) {
    return defaults;
  }

  try {
    const configs = await db.select().from(appConfig);
    const configMap = new Map(configs.map(c => [c.key, c.value]));

    return {
      anthropic: {
        apiKey: configMap.get('anthropic.apiKey') || defaults.anthropic.apiKey,
      },
      gmail: {
        clientId: configMap.get('gmail.clientId') || defaults.gmail.clientId,
        clientSecret: configMap.get('gmail.clientSecret') || defaults.gmail.clientSecret,
        redirectUri: configMap.get('gmail.redirectUri') || defaults.gmail.redirectUri,
        tokens: configMap.get('gmail.tokens') 
          ? JSON.parse(configMap.get('gmail.tokens')!) 
          : undefined,
      },
      alchemy: {
        apiKey: configMap.get('alchemy.apiKey') || defaults.alchemy.apiKey,
      },
      user: {
        email: configMap.get('user.email') || defaults.user.email,
        vipSenders: configMap.get('user.vipSenders') 
          ? JSON.parse(configMap.get('user.vipSenders')!) 
          : defaults.user.vipSenders,
        ignoreSenders: configMap.get('user.ignoreSenders') 
          ? JSON.parse(configMap.get('user.ignoreSenders')!) 
          : defaults.user.ignoreSenders,
      },
      notifications: {
        slackWebhookUrl: configMap.get('notifications.slackWebhookUrl') || defaults.notifications.slackWebhookUrl,
        telegramBotToken: configMap.get('notifications.telegramBotToken') || defaults.notifications.telegramBotToken,
        telegramChatId: configMap.get('notifications.telegramChatId') || defaults.notifications.telegramChatId,
      },
      settings: {
        emailCheckInterval: configMap.get('settings.emailCheckInterval') 
          ? parseInt(configMap.get('settings.emailCheckInterval')!) 
          : defaults.settings.emailCheckInterval,
        stablecoinCheckInterval: configMap.get('settings.stablecoinCheckInterval') 
          ? parseInt(configMap.get('settings.stablecoinCheckInterval')!) 
          : defaults.settings.stablecoinCheckInterval,
      },
      stablecoin: {
        thresholds: configMap.get('stablecoin.thresholds') 
          ? JSON.parse(configMap.get('stablecoin.thresholds')!) 
          : defaults.stablecoin.thresholds,
      },
    };
  } catch (error) {
    console.error('[Config] Erro ao carregar do banco:', error);
    return defaults;
  }
}

// Salva uma config no banco
async function saveConfigValue(key: string, value: string, isSecret = false): Promise<void> {
  const db = getDb();
  if (!db) {
    console.warn('[Config] Banco não disponível, salvando apenas em env');
    return;
  }

  try {
    // Upsert
    const existing = await db.select().from(appConfig).where(eq(appConfig.key, key));
    
    if (existing.length > 0) {
      await db.update(appConfig)
        .set({ value, isSecret, updatedAt: new Date() })
        .where(eq(appConfig.key, key));
    } else {
      await db.insert(appConfig).values({ key, value, isSecret });
    }

    // Também atualiza env var em runtime para uso imediato
    const envKey = key.replace('.', '_').toUpperCase();
    process.env[envKey] = value;
  } catch (error) {
    console.error('[Config] Erro ao salvar:', error);
    throw error;
  }
}

// Mascara valores sensíveis
function maskSensitiveData(config: AppConfigData): AppConfigData {
  return {
    ...config,
    anthropic: {
      apiKey: config.anthropic.apiKey ? '***' + config.anthropic.apiKey.slice(-8) : '',
    },
    gmail: {
      ...config.gmail,
      clientSecret: config.gmail.clientSecret ? '***' + config.gmail.clientSecret.slice(-4) : '',
    },
    alchemy: {
      apiKey: config.alchemy.apiKey ? '***' + config.alchemy.apiKey.slice(-8) : '',
    },
    notifications: {
      ...config.notifications,
      slackWebhookUrl: config.notifications.slackWebhookUrl ? '***configurado***' : '',
      telegramBotToken: config.notifications.telegramBotToken ? '***configurado***' : '',
    },
  };
}

export const configRoutes: FastifyPluginAsync = async (app) => {
  // Obtém configuração atual (mascarada)
  app.get('/', async () => {
    const config = await loadConfig();
    return {
      config: maskSensitiveData(config),
      isConfigured: {
        anthropic: !!config.anthropic.apiKey,
        gmail: !!config.gmail.clientId && !!config.gmail.clientSecret,
        alchemy: !!config.alchemy.apiKey,
        userEmail: !!config.user.email,
        slack: !!config.notifications.slackWebhookUrl,
        telegram: !!config.notifications.telegramBotToken,
      },
      databaseConnected: isDatabaseConnected(),
    };
  });

  // Salva configuração do Anthropic
  app.post<{ Body: { apiKey?: string } }>('/anthropic', async (request) => {
    const apiKey = request.body?.apiKey;
    if (!apiKey) {
      return { success: false, error: 'API Key é obrigatória' };
    }
    
    await saveConfigValue('anthropic.apiKey', apiKey, true);
    process.env.ANTHROPIC_API_KEY = apiKey;
    return { success: true, message: 'API Key do Anthropic salva com sucesso' };
  });

  // Salva configuração do Gmail
  app.post<{ Body: { clientId?: string; clientSecret?: string; redirectUri?: string } }>(
    '/gmail',
    async (request) => {
      const { clientId, clientSecret, redirectUri } = request.body || {};
      
      if (clientId) {
        await saveConfigValue('gmail.clientId', clientId);
        process.env.GMAIL_CLIENT_ID = clientId;
      }
      if (clientSecret) {
        await saveConfigValue('gmail.clientSecret', clientSecret, true);
        process.env.GMAIL_CLIENT_SECRET = clientSecret;
      }
      if (redirectUri) {
        await saveConfigValue('gmail.redirectUri', redirectUri);
      }
      
      return { success: true, message: 'Configuração do Gmail salva com sucesso' };
    }
  );

  // Salva configuração do usuário
  app.post<{ Body: { email?: string; vipSenders?: string[]; ignoreSenders?: string[] } }>(
    '/user',
    async (request) => {
      const { email, vipSenders, ignoreSenders } = request.body || {};
      
      if (email) {
        await saveConfigValue('user.email', email);
        process.env.USER_EMAIL = email;
      }
      if (vipSenders) {
        await saveConfigValue('user.vipSenders', JSON.stringify(vipSenders));
      }
      if (ignoreSenders) {
        await saveConfigValue('user.ignoreSenders', JSON.stringify(ignoreSenders));
      }
      
      return { success: true, message: 'Configuração do usuário salva com sucesso' };
    }
  );

  // Salva configuração de notificações
  app.post<{ Body: { slackWebhookUrl?: string; telegramBotToken?: string; telegramChatId?: string } }>(
    '/notifications',
    async (request) => {
      const { slackWebhookUrl, telegramBotToken, telegramChatId } = request.body || {};
      
      if (slackWebhookUrl !== undefined) {
        await saveConfigValue('notifications.slackWebhookUrl', slackWebhookUrl, true);
      }
      if (telegramBotToken !== undefined) {
        await saveConfigValue('notifications.telegramBotToken', telegramBotToken, true);
      }
      if (telegramChatId !== undefined) {
        await saveConfigValue('notifications.telegramChatId', telegramChatId);
      }
      
      return { success: true, message: 'Configuração de notificações salva com sucesso' };
    }
  );

  // Testa conexão com Anthropic
  app.post('/test/anthropic', async () => {
    const config = await loadConfig();
    
    if (!config.anthropic.apiKey) {
      return { success: false, error: 'API Key não configurada' };
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.anthropic.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
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
  });

  // Testa conexão com banco de dados
  app.post('/test/database', async () => {
    const db = getDb();
    if (!db) {
      return { success: false, error: 'DATABASE_URL não configurada' };
    }

    try {
      await db.execute('SELECT 1');
      return { success: true, message: 'Conexão com PostgreSQL OK!' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro de conexão' };
    }
  });

  // ===========================================
  // Configurações Alchemy (Stablecoin Agent)
  // ===========================================

  // Salva configuração da Alchemy
  app.post<{ Body: { apiKey?: string } }>('/alchemy', async (request) => {
    const apiKey = request.body?.apiKey;
    if (!apiKey) {
      return { success: false, error: 'API Key é obrigatória' };
    }
    
    await saveConfigValue('alchemy.apiKey', apiKey, true);
    process.env.ALCHEMY_API_KEY = apiKey;
    return { success: true, message: 'API Key da Alchemy salva com sucesso' };
  });

  // Salva configuração do Stablecoin Agent
  app.post<{ Body: { checkInterval?: number; thresholds?: { largeMint?: number; largeBurn?: number; largeTransfer?: number; supplyChangePercent?: number } } }>(
    '/stablecoin',
    async (request) => {
      const { checkInterval, thresholds } = request.body || {};
      
      if (checkInterval !== undefined) {
        await saveConfigValue('settings.stablecoinCheckInterval', String(checkInterval));
      }
      
      if (thresholds) {
        const config = await loadConfig();
        const newThresholds = { ...config.stablecoin.thresholds, ...thresholds };
        await saveConfigValue('stablecoin.thresholds', JSON.stringify(newThresholds));
      }
      
      return { success: true, message: 'Configuração do Stablecoin Agent salva com sucesso' };
    }
  );

  // Testa conexão com Alchemy
  app.post('/test/alchemy', async () => {
    const config = await loadConfig();
    
    if (!config.alchemy.apiKey) {
      return { success: false, error: 'API Key não configurada' };
    }

    try {
      // Testa chamando o endpoint de bloco atual
      const response = await fetch(
        `https://eth-mainnet.g.alchemy.com/v2/${config.alchemy.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json() as { result?: string; error?: { message?: string } };
        if (data.result) {
          const blockNumber = parseInt(data.result, 16);
          return { success: true, message: `Conexão com Alchemy OK! Bloco atual: ${blockNumber}` };
        } else if (data.error) {
          return { success: false, error: data.error.message || 'Erro na API' };
        }
      }
      
      return { success: false, error: 'Erro ao conectar com Alchemy' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro de conexão' };
    }
  });
};

export { loadConfig };
