import { Agent, type AgentConfig, type AgentResult, Notifier } from '@agent-hub/core';
import type { FinancialItem, FinancialAgentConfig, DocumentAttachment } from './types.js';
export interface FinancialAgentInput {
    emailId: string;
    threadId?: string;
    emailSubject: string;
    emailBody: string;
    emailFrom?: string;
    emailDate?: Date;
    attachmentInfo?: string;
    attachments?: DocumentAttachment[];
}
export interface FinancialAgentResult {
    emailId: string;
    itemsFound: number;
    items: FinancialItem[];
    hasUrgentItems: boolean;
    hasOverdueItems: boolean;
    totalAmount: number;
    summary: string;
}
/**
 * Agente financeiro para análise de cobranças, boletos e pagamentos.
 * Recebe emails do Email Agent e extrai informações financeiras estruturadas.
 *
 * MELHORADO: Agora extrai e analisa o conteúdo de anexos (PDFs de boletos, etc.)
 * similar ao Legal Agent, para capturar todas as informações financeiras.
 */
export declare class FinancialAgent extends Agent<FinancialAgentInput, FinancialAgentResult> {
    private analyzer;
    private extractor;
    private financialConfig;
    private notifier?;
    private queue;
    constructor(agentConfig: AgentConfig, financialConfig: FinancialAgentConfig, notifier?: Notifier);
    /**
     * Adiciona email à fila para processamento.
     */
    enqueue(input: FinancialAgentInput): void;
    /**
     * Verifica se um email parece ser sobre finanças.
     */
    isFinancialEmail(subject: string, body: string): boolean;
    /**
     * Processa a fila de emails financeiros.
     */
    execute(input?: FinancialAgentInput): Promise<AgentResult<FinancialAgentResult>>;
    /**
     * Gera resumo dos itens encontrados.
     */
    private generateSummary;
    /**
     * Envia notificação para itens urgentes ou vencidos.
     */
    private notifyUrgent;
    /**
     * Retorna quantidade de itens na fila.
     */
    getQueueSize(): number;
}
//# sourceMappingURL=financial-agent.d.ts.map