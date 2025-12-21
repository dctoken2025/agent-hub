import { Agent, type AgentConfig, type AgentResult, Notifier } from '@agent-hub/core';
import type { DocumentAttachment, ContractAnalysis, LegalAgentConfig } from './types.js';
export interface LegalAgentInput {
    emailId: string;
    threadId?: string;
    emailSubject: string;
    emailBody: string;
    attachments: DocumentAttachment[];
}
export interface LegalAgentResult {
    emailId: string;
    documentsAnalyzed: number;
    analyses: ContractAnalysis[];
    hasHighRiskDocuments: boolean;
    summary: string;
}
/**
 * Agente jurídico para análise de contratos e documentos legais.
 * Recebe anexos de emails e analisa conteúdo jurídico.
 */
export declare class LegalAgent extends Agent<LegalAgentInput, LegalAgentResult> {
    private extractor;
    private analyzer;
    private legalConfig;
    private notifier?;
    private queue;
    constructor(agentConfig: AgentConfig, legalConfig: LegalAgentConfig, notifier?: Notifier);
    /**
     * Adiciona documentos à fila para processamento.
     */
    enqueue(input: LegalAgentInput): void;
    /**
     * Processa a fila de documentos.
     */
    execute(input?: LegalAgentInput): Promise<AgentResult<LegalAgentResult>>;
    /**
     * Verifica se um email parece discutir contratos.
     */
    isContractEmail(subject: string, body: string): boolean;
    /**
     * Gera resumo das análises.
     */
    private generateSummary;
    /**
     * Envia notificação para documentos de alto risco.
     */
    private notifyHighRisk;
    /**
     * Retorna quantidade de itens na fila.
     */
    getQueueSize(): number;
}
//# sourceMappingURL=legal-agent.d.ts.map