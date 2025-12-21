import type { CommercialItem, CommercialAgentConfig } from './types.js';
/**
 * Analisador de emails comerciais usando Claude AI.
 */
export declare class CommercialAnalyzer {
    private config;
    constructor(config: CommercialAgentConfig);
    /**
     * Verifica rapidamente se um email parece ser comercial.
     */
    isCommercialEmail(subject: string, body: string): boolean;
    /**
     * Analisa um email comercial usando IA.
     */
    analyze(emailSubject: string, emailBody: string, emailId: string, threadId?: string, emailFrom?: string, emailDate?: Date): Promise<CommercialItem[]>;
    /**
     * Ajusta a prioridade baseado em regras adicionais.
     */
    private adjustPriority;
    /**
     * Monta contexto do email para análise.
     */
    private buildEmailContext;
    /**
     * System prompt para análise comercial.
     */
    private buildSystemPrompt;
}
//# sourceMappingURL=commercial-analyzer.d.ts.map