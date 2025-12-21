import type { FastifyPluginAsync } from 'fastify';
export interface ClassificationRule {
    id: string;
    name: string;
    enabled: boolean;
    condition: {
        field: 'subject' | 'body' | 'from' | 'all';
        operator: 'contains' | 'startsWith' | 'endsWith' | 'equals' | 'regex';
        value: string;
        caseSensitive?: boolean;
    };
    action: {
        priority: 'urgent' | 'attention' | 'informative' | 'low' | 'cc_only';
        tags?: string[];
        requiresAction?: boolean;
        reasoning?: string;
    };
}
export interface EmailAgentSettings {
    enabled: boolean;
    intervalMinutes: number;
    maxEmailsPerRun: number;
    processContracts: boolean;
    unreadOnly: boolean;
    customRules: ClassificationRule[];
    startDate?: string;
    lastProcessedAt?: string;
    customContext?: string;
}
export interface LegalAgentSettings {
    enabled: boolean;
    autoAnalyze: boolean;
    maxDocumentSizeMB: number;
    contractKeywords: string[];
    highRiskKeywords: string[];
    customContext?: string;
}
export interface StablecoinAgentSettings {
    enabled: boolean;
    checkInterval: number;
    thresholds: {
        largeMint: number;
        largeBurn: number;
        largeTransfer: number;
        supplyChangePercent: number;
        frequencyPerHour: number;
    };
}
export interface FinancialAgentSettings {
    enabled: boolean;
    autoAnalyze: boolean;
    urgentDaysBeforeDue: number;
    approvalThreshold: number;
    financialKeywords: string[];
    customContext?: string;
}
export interface CommercialAgentSettings {
    enabled: boolean;
    autoAnalyze: boolean;
    maxEmailAgeDays: number;
    commercialKeywords: string[];
    urgentKeywords: string[];
    customContext?: string;
}
export interface NotificationSettings {
    slackWebhookUrl?: string;
    telegramBotToken?: string;
    telegramChatId?: string;
}
export declare function loadGlobalConfig(): Promise<{
    anthropic: {
        apiKey: string;
    };
    gmail: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
    };
    alchemy: {
        apiKey: string;
    };
    ai: {
        provider: string;
        anthropicApiKey: string;
        anthropicModel: string;
        anthropicAdminApiKey: string;
        openaiApiKey: string;
        openaiModel: string;
        openaiAdminApiKey: string;
        fallbackEnabled: boolean;
    };
}>;
export declare function loadUserConfig(userId: string): Promise<{
    vipSenders: string[];
    ignoreSenders: string[];
    emailAgent: EmailAgentSettings;
    legalAgent: LegalAgentSettings;
    stablecoinAgent: StablecoinAgentSettings;
    financialAgent: FinancialAgentSettings;
    commercialAgent: CommercialAgentSettings;
    notifications: NotificationSettings;
}>;
export declare function saveGlobalConfigValue(key: string, value: string, isSecret?: boolean): Promise<void>;
export declare function saveUserConfigValue(userId: string, updates: Partial<{
    vipSenders: string[];
    ignoreSenders: string[];
    emailAgentConfig: EmailAgentSettings;
    legalAgentConfig: LegalAgentSettings;
    stablecoinAgentConfig: StablecoinAgentSettings;
    financialAgentConfig: FinancialAgentSettings;
    commercialAgentConfig: CommercialAgentSettings;
    notificationConfig: NotificationSettings;
}>): Promise<void>;
export declare function loadConfig(userId?: string): Promise<{
    anthropic: {
        apiKey: string;
    };
    gmail: {
        tokens: Record<string, unknown> | undefined;
        clientId: string;
        clientSecret: string;
        redirectUri: string;
    };
    alchemy: {
        apiKey: string;
    };
    user: {
        email: string;
        vipSenders: string[];
        ignoreSenders: string[];
    };
    notifications: NotificationSettings;
    settings: {
        emailCheckInterval: number;
        stablecoinCheckInterval: number;
    };
    stablecoin: {
        checkInterval: number;
        thresholds: {
            largeMint: number;
            largeBurn: number;
            largeTransfer: number;
            supplyChangePercent: number;
            frequencyPerHour: number;
        };
    };
    emailAgent: EmailAgentSettings;
    legalAgent: LegalAgentSettings;
}>;
export declare const configRoutes: FastifyPluginAsync;
export { saveConfigValue } from './config-legacy.js';
//# sourceMappingURL=config.d.ts.map