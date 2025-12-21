import type { FinancialItem, FinancialAgentConfig, ExtractedDocument } from './types.js';
/**
 * Analisador de emails financeiros usando Claude AI.
 */
export declare class FinancialAnalyzer {
    private config;
    constructor(config: FinancialAgentConfig);
    /**
     * Verifica se um email parece ser sobre finanças/cobranças.
     */
    isFinancialEmail(subject: string, body: string): boolean;
    /**
     * Analisa um email financeiro e extrai informações estruturadas.
     * Agora também processa o conteúdo de anexos (PDFs, imagens).
     */
    analyze(emailSubject: string, emailBody: string, emailId: string, threadId?: string, attachmentInfo?: string, emailFrom?: string, emailDate?: Date, extractedDocuments?: ExtractedDocument[]): Promise<FinancialItem[]>;
    /**
     * Converte data no formato DD/MM/YYYY para ISO.
     */
    private parseDate;
    /**
     * Determina o status baseado na data de vencimento.
     */
    private determineStatus;
    /**
     * Monta contexto do email para análise, incluindo conteúdo de anexos.
     */
    private buildContext;
    /**
     * System prompt para análise financeira.
     */
    private buildSystemPrompt;
}
//# sourceMappingURL=financial-analyzer.d.ts.map