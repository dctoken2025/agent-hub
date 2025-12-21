import { Agent, type AgentConfig, type AgentResult, Notifier } from '@agent-hub/core';
import { LegalAgent, type ContractAnalysis } from '@agent-hub/legal-agent';
import { FinancialAgent, type FinancialItem } from '@agent-hub/financial-agent';
import { TaskAgent, type ActionItem } from '@agent-hub/task-agent';
import { type ClassificationRule } from './email-classifier.js';
import type { EmailAgentConfig, ClassifiedEmail } from './types.js';
export interface EmailAgentResult {
    processedCount: number;
    classifications: {
        urgent: number;
        attention: number;
        informative: number;
        low: number;
        cc_only: number;
    };
    emails: ClassifiedEmail[];
    contractsDetected: number;
    legalAnalyses: ContractAnalysis[];
    financialItemsDetected: number;
    financialItems: FinancialItem[];
    actionItemsDetected: number;
    actionItems: ActionItem[];
}
export declare class EmailAgent extends Agent<void, EmailAgentResult> {
    private gmailClient;
    private classifier;
    private emailConfig;
    private notifier?;
    private legalAgent?;
    private financialAgent?;
    private taskAgent?;
    private processedLabelId?;
    constructor(agentConfig: AgentConfig, emailConfig: EmailAgentConfig, notifier?: Notifier);
    private initializeLegalAgent;
    private initializeFinancialAgent;
    /**
     * Injeta uma instância externa do Legal Agent (com listeners configurados).
     */
    setLegalAgent(legalAgent: LegalAgent): void;
    /**
     * Injeta uma instância externa do Financial Agent (com listeners configurados).
     */
    setFinancialAgent(financialAgent: FinancialAgent): void;
    /**
     * Injeta um Task Agent externo para análise de action items.
     */
    setTaskAgent(taskAgent: TaskAgent): void;
    /**
     * Define regras de classificação personalizadas.
     */
    setCustomRules(rules: ClassificationRule[]): void;
    initialize(): Promise<void>;
    private processedEmailIds;
    onProcessingComplete?: (lastProcessedAt: Date) => Promise<void>;
    execute(): Promise<AgentResult<EmailAgentResult>>;
    /**
     * Retorna a data a partir da qual buscar emails.
     * Prioriza lastProcessedAt (mais recente), depois startDate.
     */
    private getFilterDate;
    /**
     * Atualiza a configuração de datas (chamado externamente)
     */
    updateDateConfig(config: {
        startDate?: string | Date;
        lastProcessedAt?: string | Date;
    }): void;
    /**
     * Verifica se um email parece ser sobre contrato.
     */
    private isContractEmail;
    /**
     * Verifica se um email parece ser sobre finanças (boletos, cobranças, pagamentos).
     */
    private isFinancialEmail;
    /**
     * Verifica se um email contém action items (tarefas, perguntas, pendências).
     */
    private hasActionItems;
    /**
     * Processa email com Task Agent para extração de action items.
     */
    private processWithTaskAgent;
    /**
     * Processa email com Financial Agent para análise de cobranças.
     * MELHORADO: Agora baixa e envia o conteúdo dos anexos (PDFs de boletos, etc.)
     * para análise profunda, similar ao Legal Agent.
     */
    private processWithFinancialAgent;
    /**
     * Processa email com Legal Agent para análise de contratos.
     */
    private processWithLegalAgent;
    /**
     * Processa um email específico por ID.
     */
    processEmail(emailId: string): Promise<ClassifiedEmail | null>;
    /**
     * Gera URL para autorização OAuth.
     */
    getAuthUrl(): string;
    /**
     * Completa autorização com código OAuth.
     */
    completeAuth(code: string): Promise<void>;
    /**
     * Retorna o Legal Agent integrado.
     */
    getLegalAgent(): LegalAgent | undefined;
    /**
     * Retorna o Financial Agent integrado.
     */
    getFinancialAgent(): FinancialAgent | undefined;
    /**
     * Retorna resumo formatado dos emails processados.
     */
    formatSummary(result: EmailAgentResult): string;
    private notifyUrgent;
    private getPriorityEmoji;
}
//# sourceMappingURL=email-agent.d.ts.map