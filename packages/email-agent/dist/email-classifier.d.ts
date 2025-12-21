import type { Email, EmailClassification, EmailAgentConfig } from './types.js';
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
/**
 * Classificador de emails usando Claude AI.
 * Analisa conteúdo, tom e contexto para determinar prioridade.
 */
export declare class EmailClassifier {
    private config;
    private customRules;
    constructor(config: EmailAgentConfig);
    /**
     * Define regras de classificação personalizadas.
     */
    setCustomRules(rules: ClassificationRule[]): void;
    /**
     * Classifica um email usando IA.
     */
    classify(email: Email): Promise<EmailClassification>;
    /**
     * Aplica regras de classificação personalizadas do usuário.
     */
    private applyCustomRules;
    /**
     * Classificação rápida sem IA para casos óbvios.
     */
    private quickClassify;
    /**
     * Verifica se é newsletter/marketing.
     */
    private isNewsletter;
    /**
     * Monta contexto do email para análise da IA.
     */
    private buildEmailContext;
    /**
     * System prompt para a IA.
     */
    private buildSystemPrompt;
    /**
     * Classificação padrão quando IA falha.
     */
    private defaultClassification;
}
//# sourceMappingURL=email-classifier.d.ts.map