import { eq } from 'drizzle-orm';
import { getDb, globalConfig, userConfigs, users, isDatabaseConnected } from '../db/index.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
// ===========================================
// Helpers
// ===========================================
// Carrega configurações globais
export async function loadGlobalConfig() {
    const defaults = {
        anthropic: { apiKey: process.env.ANTHROPIC_API_KEY || '' },
        gmail: {
            clientId: process.env.GMAIL_CLIENT_ID || '',
            clientSecret: process.env.GMAIL_CLIENT_SECRET || '',
            redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:3001/api/auth/gmail/callback',
        },
        alchemy: { apiKey: process.env.ALCHEMY_API_KEY || '' },
        ai: {
            provider: 'anthropic',
            anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
            anthropicModel: 'claude-sonnet-4-20250514',
            anthropicAdminApiKey: '',
            openaiApiKey: process.env.OPENAI_API_KEY || '',
            openaiModel: 'gpt-4o',
            openaiAdminApiKey: '',
            fallbackEnabled: true,
        },
    };
    const db = getDb();
    if (!db || !isDatabaseConnected()) {
        return defaults;
    }
    try {
        const configs = await db.select().from(globalConfig);
        const configMap = new Map(configs.map(c => [c.key, c.value]));
        return {
            anthropic: {
                apiKey: configMap.get('anthropic.apiKey') || defaults.anthropic.apiKey,
            },
            gmail: {
                clientId: configMap.get('gmail.clientId') || defaults.gmail.clientId,
                clientSecret: configMap.get('gmail.clientSecret') || defaults.gmail.clientSecret,
                redirectUri: configMap.get('gmail.redirectUri') || defaults.gmail.redirectUri,
            },
            alchemy: {
                apiKey: configMap.get('alchemy.apiKey') || defaults.alchemy.apiKey,
            },
            ai: {
                provider: configMap.get('ai.provider') || defaults.ai.provider,
                anthropicApiKey: configMap.get('ai.anthropicApiKey') || configMap.get('anthropic.apiKey') || defaults.ai.anthropicApiKey,
                anthropicModel: configMap.get('ai.anthropicModel') || defaults.ai.anthropicModel,
                anthropicAdminApiKey: configMap.get('ai.anthropicAdminApiKey') || defaults.ai.anthropicAdminApiKey,
                openaiApiKey: configMap.get('ai.openaiApiKey') || defaults.ai.openaiApiKey,
                openaiModel: configMap.get('ai.openaiModel') || defaults.ai.openaiModel,
                openaiAdminApiKey: configMap.get('ai.openaiAdminApiKey') || defaults.ai.openaiAdminApiKey,
                fallbackEnabled: configMap.get('ai.fallbackEnabled') !== 'false',
            },
        };
    }
    catch (error) {
        console.error('[Config] Erro ao carregar config global:', error);
        return defaults;
    }
}
// Carrega configurações de um usuário específico
export async function loadUserConfig(userId) {
    const defaults = {
        vipSenders: [],
        ignoreSenders: ['newsletter', 'marketing', 'noreply'],
        emailAgent: {
            enabled: true,
            intervalMinutes: 10,
            maxEmailsPerRun: 50,
            processContracts: true,
            unreadOnly: true,
            customRules: [],
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 dias atrás (padrão)
        },
        legalAgent: {
            enabled: true,
            autoAnalyze: true,
            maxDocumentSizeMB: 10,
            contractKeywords: [
                'contrato', 'acordo', 'termo', 'aditivo', 'minuta', 'proposta',
                'procuração', 'estatuto', 'ata', 'cessão', 'licença',
                'empréstimo', 'mútuo', 'garantia', 'fiança', 'hipoteca',
                'prestação de serviços', 'parceria', 'confidencialidade', 'nda',
                'memorando', 'letter of intent', 'loi', 'term sheet'
            ],
            highRiskKeywords: [
                'multa', 'penalidade', 'indenização', 'perdas e danos',
                'exclusividade', 'não-competição', 'non-compete', 'não concorrência',
                'confidencialidade perpétua', 'prazo indeterminado',
                'rescisão imediata', 'vencimento antecipado', 'cross-default',
                'responsabilidade ilimitada', 'solidariamente responsável',
                'renúncia', 'irrevogável', 'irretratável',
                'foro de', 'arbitragem', 'cláusula penal',
                'renovação automática', 'reajuste', 'correção monetária'
            ],
        },
        stablecoinAgent: {
            enabled: false,
            checkInterval: 60,
            thresholds: {
                largeMint: 10000000,
                largeBurn: 10000000,
                largeTransfer: 50000000,
                supplyChangePercent: 1,
                frequencyPerHour: 100,
            },
        },
        financialAgent: {
            enabled: true,
            autoAnalyze: true,
            urgentDaysBeforeDue: 3,
            approvalThreshold: 500000,
            financialKeywords: [
                'boleto', 'fatura', 'invoice', 'cobrança', 'pagamento',
                'vencimento', 'vence em', 'pagar até', 'payment due',
                'nota fiscal', 'nf-e', 'nfe', 'danfe', 'recibo',
                'valor', 'parcela', 'mensalidade', 'anuidade',
                'total a pagar', 'amount due',
                'banco', 'pix', 'transferência',
                'efetuar pagamento', 'segue boleto', 'anexo boleto',
            ],
        },
        notifications: {},
    };
    const db = getDb();
    if (!db)
        return defaults;
    try {
        const [config] = await db.select()
            .from(userConfigs)
            .where(eq(userConfigs.userId, userId))
            .limit(1);
        if (!config)
            return defaults;
        // Mescla configurações do banco com defaults para garantir que todos os campos existam
        const emailAgentFromDb = config.emailAgentConfig;
        const legalAgentFromDb = config.legalAgentConfig;
        const stablecoinAgentFromDb = config.stablecoinAgentConfig;
        const financialAgentFromDb = config.financialAgentConfig;
        return {
            vipSenders: config.vipSenders || defaults.vipSenders,
            ignoreSenders: config.ignoreSenders || defaults.ignoreSenders,
            emailAgent: {
                ...defaults.emailAgent,
                ...emailAgentFromDb,
            },
            legalAgent: {
                ...defaults.legalAgent,
                ...legalAgentFromDb,
            },
            stablecoinAgent: {
                ...defaults.stablecoinAgent,
                ...stablecoinAgentFromDb,
            },
            financialAgent: {
                ...defaults.financialAgent,
                ...financialAgentFromDb,
            },
            notifications: config.notificationConfig || defaults.notifications,
        };
    }
    catch (error) {
        console.error('[Config] Erro ao carregar config do usuário:', error);
        return defaults;
    }
}
// Salva uma config global (só admin)
export async function saveGlobalConfigValue(key, value, isSecret = false) {
    const db = getDb();
    if (!db) {
        console.warn('[Config] Banco não disponível');
        return;
    }
    try {
        const existing = await db.select().from(globalConfig).where(eq(globalConfig.key, key));
        if (existing.length > 0) {
            await db.update(globalConfig)
                .set({ value, isSecret, updatedAt: new Date() })
                .where(eq(globalConfig.key, key));
        }
        else {
            await db.insert(globalConfig).values({ key, value, isSecret });
        }
    }
    catch (error) {
        console.error('[Config] Erro ao salvar config global:', error);
        throw error;
    }
}
// Salva config de usuário
export async function saveUserConfigValue(userId, updates) {
    const db = getDb();
    if (!db)
        return;
    try {
        const existing = await db.select()
            .from(userConfigs)
            .where(eq(userConfigs.userId, userId))
            .limit(1);
        if (existing.length > 0) {
            await db.update(userConfigs)
                .set({ ...updates, updatedAt: new Date() })
                .where(eq(userConfigs.userId, userId));
        }
        else {
            await db.insert(userConfigs).values({
                userId,
                ...updates,
            });
        }
    }
    catch (error) {
        console.error('[Config] Erro ao salvar config do usuário:', error);
        throw error;
    }
}
// ===========================================
// Função loadConfig para compatibilidade
// ===========================================
export async function loadConfig(userId) {
    const global = await loadGlobalConfig();
    // Se não tem userId, retorna formato antigo para compatibilidade
    if (!userId) {
        return {
            anthropic: global.anthropic,
            gmail: {
                ...global.gmail,
                tokens: undefined, // Tokens agora são por usuário
            },
            alchemy: global.alchemy,
            user: {
                email: '',
                vipSenders: [],
                ignoreSenders: [],
            },
            notifications: {},
            settings: {
                emailCheckInterval: 10,
                stablecoinCheckInterval: 60,
            },
            stablecoin: {
                checkInterval: 60,
                thresholds: {
                    largeMint: 10000000,
                    largeBurn: 10000000,
                    largeTransfer: 50000000,
                    supplyChangePercent: 1,
                    frequencyPerHour: 100,
                },
            },
            emailAgent: {
                enabled: true,
                intervalMinutes: 10,
                maxEmailsPerRun: 50,
                processContracts: true,
                unreadOnly: true,
                customRules: [],
            },
            legalAgent: {
                enabled: true,
                autoAnalyze: true,
                maxDocumentSizeMB: 10,
                contractKeywords: [
                    'contrato', 'acordo', 'termo', 'aditivo', 'minuta', 'proposta',
                    'procuração', 'estatuto', 'ata', 'cessão', 'licença',
                    'empréstimo', 'mútuo', 'garantia', 'fiança', 'hipoteca',
                    'prestação de serviços', 'parceria', 'confidencialidade', 'nda',
                    'memorando', 'letter of intent', 'loi', 'term sheet'
                ],
                highRiskKeywords: [
                    'multa', 'penalidade', 'indenização', 'perdas e danos',
                    'exclusividade', 'não-competição', 'non-compete', 'não concorrência',
                    'confidencialidade perpétua', 'prazo indeterminado',
                    'rescisão imediata', 'vencimento antecipado', 'cross-default',
                    'responsabilidade ilimitada', 'solidariamente responsável',
                    'renúncia', 'irrevogável', 'irretratável',
                    'foro de', 'arbitragem', 'cláusula penal',
                    'renovação automática', 'reajuste', 'correção monetária'
                ],
            },
        };
    }
    const userConfig = await loadUserConfig(userId);
    // Busca user para pegar email e tokens
    const db = getDb();
    let userEmail = '';
    let gmailTokens = undefined;
    if (db) {
        const [user] = await db.select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
        if (user) {
            userEmail = user.email;
            gmailTokens = user.gmailTokens;
        }
    }
    return {
        anthropic: global.anthropic,
        gmail: {
            ...global.gmail,
            tokens: gmailTokens,
        },
        alchemy: global.alchemy,
        user: {
            email: userEmail,
            vipSenders: userConfig.vipSenders,
            ignoreSenders: userConfig.ignoreSenders,
        },
        notifications: userConfig.notifications,
        settings: {
            emailCheckInterval: userConfig.emailAgent.intervalMinutes,
            stablecoinCheckInterval: userConfig.stablecoinAgent.checkInterval,
        },
        stablecoin: {
            checkInterval: userConfig.stablecoinAgent.checkInterval,
            thresholds: userConfig.stablecoinAgent.thresholds,
        },
        emailAgent: userConfig.emailAgent,
        legalAgent: userConfig.legalAgent,
    };
}
// ===========================================
// Rotas de Configuração
// ===========================================
export const configRoutes = async (app) => {
    // ===========================================
    // ROTAS GLOBAIS (SÓ ADMIN)
    // ===========================================
    // Obtém configurações globais (admin)
    app.get('/global', { preHandler: [authMiddleware, adminMiddleware] }, async () => {
        const config = await loadGlobalConfig();
        return {
            config: {
                anthropic: {
                    apiKey: config.anthropic.apiKey ? '***' + config.anthropic.apiKey.slice(-8) : '',
                },
                gmail: {
                    clientId: config.gmail.clientId || '',
                    clientSecret: config.gmail.clientSecret ? '***' + config.gmail.clientSecret.slice(-4) : '',
                    redirectUri: config.gmail.redirectUri,
                },
                alchemy: {
                    apiKey: config.alchemy.apiKey ? '***' + config.alchemy.apiKey.slice(-8) : '',
                },
            },
            isConfigured: {
                anthropic: !!config.anthropic.apiKey,
                gmail: !!(config.gmail.clientId && config.gmail.clientSecret),
                alchemy: !!config.alchemy.apiKey,
            },
        };
    });
    // Salva configuração do Anthropic (admin)
    app.post('/global/anthropic', { preHandler: [authMiddleware, adminMiddleware] }, async (request) => {
        const apiKey = request.body?.apiKey;
        if (!apiKey) {
            return { success: false, error: 'API Key é obrigatória' };
        }
        await saveGlobalConfigValue('anthropic.apiKey', apiKey, true);
        process.env.ANTHROPIC_API_KEY = apiKey;
        return { success: true, message: 'API Key do Anthropic salva com sucesso' };
    });
    // Salva configuração do Gmail (admin)
    app.post('/global/gmail', { preHandler: [authMiddleware, adminMiddleware] }, async (request) => {
        const { clientId, clientSecret, redirectUri } = request.body || {};
        if (clientId) {
            await saveGlobalConfigValue('gmail.clientId', clientId);
        }
        if (clientSecret) {
            await saveGlobalConfigValue('gmail.clientSecret', clientSecret, true);
        }
        if (redirectUri) {
            await saveGlobalConfigValue('gmail.redirectUri', redirectUri);
        }
        return { success: true, message: 'Configuração do Gmail salva com sucesso' };
    });
    // Salva configuração do Alchemy (admin)
    app.post('/global/alchemy', { preHandler: [authMiddleware, adminMiddleware] }, async (request) => {
        const apiKey = request.body?.apiKey;
        if (!apiKey) {
            return { success: false, error: 'API Key é obrigatória' };
        }
        await saveGlobalConfigValue('alchemy.apiKey', apiKey, true);
        process.env.ALCHEMY_API_KEY = apiKey;
        return { success: true, message: 'API Key da Alchemy salva com sucesso' };
    });
    // Testa conexão com Anthropic (admin)
    app.post('/global/test/anthropic', { preHandler: [authMiddleware, adminMiddleware] }, async () => {
        const config = await loadGlobalConfig();
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
            }
            else {
                const errorData = await response.json();
                return { success: false, error: errorData.error?.message || 'Erro desconhecido' };
            }
        }
        catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Erro de conexão' };
        }
    });
    // Testa conexão com Alchemy (admin)
    app.post('/global/test/alchemy', { preHandler: [authMiddleware, adminMiddleware] }, async () => {
        const config = await loadGlobalConfig();
        if (!config.alchemy.apiKey) {
            return { success: false, error: 'API Key não configurada' };
        }
        try {
            const response = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${config.alchemy.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_blockNumber',
                    params: [],
                    id: 1,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                if (data.result) {
                    const blockNumber = parseInt(data.result, 16);
                    return { success: true, message: `Conexão com Alchemy OK! Bloco atual: ${blockNumber}` };
                }
                else if (data.error) {
                    return { success: false, error: data.error.message || 'Erro na API' };
                }
            }
            return { success: false, error: 'Erro ao conectar com Alchemy' };
        }
        catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Erro de conexão' };
        }
    });
    // ===========================================
    // ROTAS DO USUÁRIO
    // ===========================================
    // Obtém configurações do usuário atual (formato compatível com Settings.tsx)
    app.get('/', { preHandler: [authMiddleware] }, async (request) => {
        const userId = request.user.id;
        const userConfig = await loadUserConfig(userId);
        const globalCfg = await loadGlobalConfig();
        // Busca dados do usuário
        const db = getDb();
        let userEmail = '';
        let hasGmailConnected = false;
        if (db) {
            const [user] = await db.select()
                .from(users)
                .where(eq(users.id, userId))
                .limit(1);
            userEmail = user?.email || '';
            hasGmailConnected = !!user?.gmailTokens;
        }
        // Formato compatível com Settings.tsx
        return {
            config: {
                anthropic: { apiKey: globalCfg.anthropic.apiKey ? '••••••••' : '' },
                gmail: {
                    clientId: globalCfg.gmail.clientId ? '••••••••' : '',
                    clientSecret: globalCfg.gmail.clientSecret ? '••••••••' : '',
                    redirectUri: globalCfg.gmail.redirectUri,
                },
                alchemy: { apiKey: globalCfg.alchemy.apiKey ? '••••••••' : '' },
                user: {
                    email: userEmail,
                    vipSenders: userConfig.vipSenders,
                    ignoreSenders: userConfig.ignoreSenders,
                },
                notifications: userConfig.notifications || { slackWebhookUrl: '', telegramBotToken: '', telegramChatId: '' },
                settings: {
                    emailCheckInterval: userConfig.emailAgent.intervalMinutes,
                    stablecoinCheckInterval: userConfig.stablecoinAgent.checkInterval,
                },
                stablecoin: {
                    thresholds: userConfig.stablecoinAgent.thresholds,
                },
            },
            isConfigured: {
                anthropic: !!globalCfg.anthropic.apiKey,
                gmail: !!(globalCfg.gmail.clientId && globalCfg.gmail.clientSecret),
                alchemy: !!globalCfg.alchemy.apiKey,
                userEmail: !!userEmail,
                slack: !!userConfig.notifications?.slackWebhookUrl,
                telegram: !!(userConfig.notifications?.telegramBotToken && userConfig.notifications?.telegramChatId),
                gmailConnected: hasGmailConnected,
            },
            databaseConnected: isDatabaseConnected(),
        };
    });
    // Salva preferências de email do usuário
    app.post('/user/preferences', { preHandler: [authMiddleware] }, async (request) => {
        const userId = request.user.id;
        const { vipSenders, ignoreSenders } = request.body || {};
        const updates = {};
        if (vipSenders) {
            updates.vipSenders = vipSenders;
        }
        if (ignoreSenders) {
            updates.ignoreSenders = ignoreSenders;
        }
        await saveUserConfigValue(userId, updates);
        return { success: true, message: 'Preferências salvas com sucesso' };
    });
    // Salva configuração de notificações do usuário
    app.post('/user/notifications', { preHandler: [authMiddleware] }, async (request) => {
        const userId = request.user.id;
        const currentConfig = await loadUserConfig(userId);
        const notificationConfig = {
            ...currentConfig.notifications,
            ...request.body,
        };
        await saveUserConfigValue(userId, { notificationConfig });
        return { success: true, message: 'Configuração de notificações salva' };
    });
    // ===========================================
    // CONFIGURAÇÕES DOS AGENTES (por usuário)
    // ===========================================
    // Obtém configurações de todos os agentes
    app.get('/agents', { preHandler: [authMiddleware] }, async (request) => {
        const userId = request.user.id;
        const config = await loadUserConfig(userId);
        return {
            emailAgent: config.emailAgent,
            legalAgent: config.legalAgent,
            stablecoinAgent: config.stablecoinAgent,
            financialAgent: config.financialAgent,
        };
    });
    // Atualiza configuração do Email Agent
    app.put('/agents/email', { preHandler: [authMiddleware] }, async (request, reply) => {
        try {
            const userId = request.user.id;
            const currentConfig = await loadUserConfig(userId);
            // Validação: startDate não pode ser maior que 7 dias atrás
            if (request.body.startDate) {
                const startDate = new Date(request.body.startDate);
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                if (startDate < sevenDaysAgo) {
                    return reply.status(400).send({
                        success: false,
                        error: 'A data base não pode ser maior que 7 dias atrás. Isso evita sobrecarga no processamento.',
                    });
                }
            }
            const updated = {
                ...currentConfig.emailAgent,
                ...request.body,
            };
            await saveUserConfigValue(userId, { emailAgentConfig: updated });
            console.log(`[Config] Email Agent atualizado para usuário ${userId}:`, {
                interval: updated.intervalMinutes,
                rules: updated.customRules?.length || 0,
            });
            return {
                success: true,
                message: 'Configuração salva',
                config: updated,
            };
        }
        catch (error) {
            console.error('[Config] Erro ao salvar Email Agent:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao salvar',
            });
        }
    });
    // Atualiza configuração do Legal Agent
    app.put('/agents/legal', { preHandler: [authMiddleware] }, async (request, reply) => {
        try {
            const userId = request.user.id;
            const currentConfig = await loadUserConfig(userId);
            const updated = {
                ...currentConfig.legalAgent,
                ...request.body,
            };
            await saveUserConfigValue(userId, { legalAgentConfig: updated });
            return {
                success: true,
                message: 'Configuração do Legal Agent salva',
                config: updated,
            };
        }
        catch (error) {
            console.error('[Config] Erro ao salvar Legal Agent:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao salvar',
            });
        }
    });
    // Atualiza configuração do Stablecoin Agent
    app.put('/agents/stablecoin', { preHandler: [authMiddleware] }, async (request, reply) => {
        try {
            const userId = request.user.id;
            const currentConfig = await loadUserConfig(userId);
            const updated = {
                ...currentConfig.stablecoinAgent,
                ...request.body,
            };
            await saveUserConfigValue(userId, { stablecoinAgentConfig: updated });
            return {
                success: true,
                message: 'Configuração do Stablecoin Agent salva',
                config: updated,
            };
        }
        catch (error) {
            console.error('[Config] Erro ao salvar Stablecoin Agent:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao salvar',
            });
        }
    });
    // Atualiza configurações do Financial Agent
    app.put('/agents/financial', { preHandler: [authMiddleware] }, async (request, reply) => {
        try {
            const userId = request.user.id;
            const currentConfig = await loadUserConfig(userId);
            const updated = {
                ...currentConfig.financialAgent,
                ...request.body,
            };
            await saveUserConfigValue(userId, { financialAgentConfig: updated });
            return {
                success: true,
                message: 'Configuração do Financial Agent salva',
                config: updated,
            };
        }
        catch (error) {
            console.error('[Config] Erro ao salvar Financial Agent:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao salvar',
            });
        }
    });
    // ===========================================
    // REGRAS DE CLASSIFICAÇÃO (por usuário)
    // ===========================================
    // Adiciona uma regra de classificação
    app.post('/agents/email/rules', { preHandler: [authMiddleware] }, async (request, reply) => {
        try {
            const userId = request.user.id;
            const currentConfig = await loadUserConfig(userId);
            const newRule = {
                ...request.body,
                id: request.body.id || `rule-${Date.now()}`,
            };
            const updated = {
                ...currentConfig.emailAgent,
                customRules: [...(currentConfig.emailAgent.customRules || []), newRule],
            };
            await saveUserConfigValue(userId, { emailAgentConfig: updated });
            return {
                success: true,
                message: 'Regra adicionada com sucesso',
                rule: newRule,
            };
        }
        catch (error) {
            console.error('[Config] Erro ao adicionar regra:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao adicionar regra',
            });
        }
    });
    // Remove uma regra de classificação
    app.delete('/agents/email/rules/:ruleId', { preHandler: [authMiddleware] }, async (request, reply) => {
        try {
            const userId = request.user.id;
            const currentConfig = await loadUserConfig(userId);
            const updated = {
                ...currentConfig.emailAgent,
                customRules: (currentConfig.emailAgent.customRules || []).filter((r) => r.id !== request.params.ruleId),
            };
            await saveUserConfigValue(userId, { emailAgentConfig: updated });
            return {
                success: true,
                message: 'Regra removida com sucesso',
            };
        }
        catch (error) {
            console.error('[Config] Erro ao remover regra:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao remover regra',
            });
        }
    });
    // Atualiza uma regra específica
    app.put('/agents/email/rules/:ruleId', { preHandler: [authMiddleware] }, async (request, reply) => {
        try {
            const userId = request.user.id;
            const currentConfig = await loadUserConfig(userId);
            const ruleIndex = (currentConfig.emailAgent.customRules || []).findIndex((r) => r.id === request.params.ruleId);
            if (ruleIndex === -1) {
                return reply.status(404).send({ success: false, error: 'Regra não encontrada' });
            }
            const updatedRules = [...(currentConfig.emailAgent.customRules || [])];
            updatedRules[ruleIndex] = {
                ...updatedRules[ruleIndex],
                ...request.body,
            };
            const updated = {
                ...currentConfig.emailAgent,
                customRules: updatedRules,
            };
            await saveUserConfigValue(userId, { emailAgentConfig: updated });
            return {
                success: true,
                message: 'Regra atualizada com sucesso',
                rule: updatedRules[ruleIndex],
            };
        }
        catch (error) {
            console.error('[Config] Erro ao atualizar regra:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao atualizar regra',
            });
        }
    });
    // ===========================================
    // ROTAS DE COMPATIBILIDADE (Settings.tsx)
    // ===========================================
    // Salvar API Key Anthropic (admin only)
    app.post('/anthropic', { preHandler: [authMiddleware, adminMiddleware] }, async (request) => {
        const { apiKey } = request.body;
        if (!apiKey) {
            return { success: false, error: 'API Key é obrigatória' };
        }
        await saveGlobalConfigValue('anthropic.apiKey', apiKey, true);
        return { success: true, message: 'API Key Anthropic salva' };
    });
    // Salvar credenciais Gmail (admin only)
    app.post('/gmail', { preHandler: [authMiddleware, adminMiddleware] }, async (request) => {
        const { clientId, clientSecret } = request.body;
        if (!clientId || !clientSecret) {
            return { success: false, error: 'Client ID e Secret são obrigatórios' };
        }
        await saveGlobalConfigValue('gmail.clientId', clientId, false);
        await saveGlobalConfigValue('gmail.clientSecret', clientSecret, true);
        return { success: true, message: 'Credenciais Gmail salvas' };
    });
    // Salvar API Key Alchemy (admin only)
    app.post('/alchemy', { preHandler: [authMiddleware, adminMiddleware] }, async (request) => {
        const { apiKey } = request.body;
        if (!apiKey) {
            return { success: false, error: 'API Key é obrigatória' };
        }
        await saveGlobalConfigValue('alchemy.apiKey', apiKey, true);
        return { success: true, message: 'API Key Alchemy salva' };
    });
    // Salvar configurações do usuário
    app.post('/user', { preHandler: [authMiddleware] }, async (request) => {
        const userId = request.user.id;
        const { vipSenders, ignoreSenders } = request.body;
        const updates = {};
        if (vipSenders)
            updates.vipSenders = vipSenders;
        if (ignoreSenders)
            updates.ignoreSenders = ignoreSenders;
        await saveUserConfigValue(userId, updates);
        return { success: true, message: 'Configurações salvas' };
    });
    // Salvar notificações
    app.post('/notifications', { preHandler: [authMiddleware] }, async (request) => {
        const userId = request.user.id;
        const currentConfig = await loadUserConfig(userId);
        const notificationConfig = {
            ...currentConfig.notifications,
            slackWebhookUrl: request.body.slackWebhookUrl || '',
        };
        await saveUserConfigValue(userId, { notificationConfig });
        return { success: true, message: 'Notificações salvas' };
    });
    // Salvar config stablecoin
    app.post('/stablecoin', { preHandler: [authMiddleware] }, async (request) => {
        const userId = request.user.id;
        const currentConfig = await loadUserConfig(userId);
        const stablecoinAgentConfig = {
            ...currentConfig.stablecoinAgent,
            checkInterval: request.body.checkInterval || 60,
        };
        await saveUserConfigValue(userId, { stablecoinAgentConfig });
        return { success: true, message: 'Configuração salva' };
    });
    // Testar Anthropic
    app.post('/test/anthropic', { preHandler: [authMiddleware] }, async () => {
        const globalCfg = await loadGlobalConfig();
        if (!globalCfg.anthropic.apiKey) {
            return { success: false, error: 'API Key não configurada' };
        }
        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': globalCfg.anthropic.apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 10,
                    messages: [{ role: 'user', content: 'Hi' }],
                }),
            });
            if (response.ok) {
                return { success: true, message: 'Conexão OK!' };
            }
            else {
                const error = await response.json();
                return { success: false, error: error.error?.message || 'Erro na API' };
            }
        }
        catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Erro de conexão' };
        }
    });
    // Testar Alchemy
    app.post('/test/alchemy', { preHandler: [authMiddleware] }, async () => {
        const globalCfg = await loadGlobalConfig();
        if (!globalCfg.alchemy.apiKey) {
            return { success: false, error: 'API Key não configurada' };
        }
        try {
            const response = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${globalCfg.alchemy.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_blockNumber',
                    params: [],
                    id: 1,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                const blockNumber = parseInt(data.result, 16);
                return { success: true, message: `Conectado! Bloco: ${blockNumber}` };
            }
            else {
                return { success: false, error: 'Erro na API' };
            }
        }
        catch (error) {
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
        }
        catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Erro de conexão' };
        }
    });
};
export { saveConfigValue } from './config-legacy.js';
//# sourceMappingURL=config.js.map