import { Agent, type AgentConfig, type AgentResult, Notifier } from '@agent-hub/core';
import type { CommercialItem, CommercialAgentConfig } from './types.js';
export interface CommercialAgentInput {
    emailId: string;
    threadId?: string;
    emailSubject: string;
    emailBody: string;
    emailFrom?: string;
    emailDate?: Date;
}
export interface CommercialAgentResult {
    emailId: string;
    itemsFound: number;
    items: CommercialItem[];
    hasCriticalItems: boolean;
    hasHighPriorityItems: boolean;
    totalEstimatedValue: number;
    summary: string;
}
/**
 * Agente comercial para análise de pedidos de cotação, propostas e oportunidades de vendas.
 * Recebe emails do Email Agent e extrai informações comerciais estruturadas.
 */
export declare class CommercialAgent extends Agent<CommercialAgentInput, CommercialAgentResult> {
    private analyzer;
    private commercialConfig;
    private notifier?;
    private queue;
    constructor(agentConfig: AgentConfig, commercialConfig: CommercialAgentConfig, notifier?: Notifier);
    /**
     * Adiciona email à fila para processamento.
     */
    enqueue(input: CommercialAgentInput): void;
    /**
     * Verifica se um email parece ser comercial.
     */
    isCommercialEmail(subject: string, body: string): boolean;
    /**
     * Processa a fila de emails comerciais.
     */
    execute(input?: CommercialAgentInput): Promise<AgentResult<CommercialAgentResult>>;
    /**
     * Gera resumo dos itens encontrados.
     */
    private generateSummary;
    /**
     * Envia notificação para itens prioritários.
     */
    private notifyPriority;
    /**
     * Retorna label amigável para tipo de item.
     */
    private getTypeLabel;
    /**
     * Retorna quantidade de itens na fila.
     */
    getQueueSize(): number;
}
//# sourceMappingURL=commercial-agent.d.ts.map