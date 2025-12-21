import { Agent, type AgentConfig, type AgentResult, Notifier } from '@agent-hub/core';
import type { ActionItem, TaskAgentConfig } from './types.js';
export interface TaskAgentInput {
    emailId: string;
    threadId?: string;
    emailSubject: string;
    emailBody: string;
    emailFrom: string;
    emailDate?: Date;
}
export interface TaskAgentResult {
    emailId: string;
    itemsFound: number;
    items: ActionItem[];
    summary: string;
    suggestedReply?: string;
    criticalItems: number;
    hasDeadlines: boolean;
}
/**
 * Task Agent - Agente especializado em extrair e gerenciar tarefas de emails.
 *
 * Funcionalidades:
 * - Detecta emails com perguntas, pendências e action items
 * - Extrai cada item de forma estruturada
 * - Identifica stakeholders e projetos
 * - Calcula prioridades baseado em contexto
 * - Gera sugestões de resposta
 */
export declare class TaskAgent extends Agent<TaskAgentInput, TaskAgentResult> {
    private extractor;
    private taskConfig;
    private notifier?;
    private queue;
    constructor(agentConfig: AgentConfig, taskConfig?: Partial<TaskAgentConfig>, notifier?: Notifier);
    /**
     * Verifica se um email contém action items.
     */
    hasActionItems(subject: string, body: string): boolean;
    /**
     * Adiciona um email à fila para processamento.
     */
    addToQueue(input: TaskAgentInput): void;
    /**
     * Processa um email diretamente e extrai tarefas.
     * Método público para ser chamado pelo Email Agent.
     */
    processEmail(input: TaskAgentInput): Promise<TaskAgentResult | null>;
    /**
     * Execução agendada do agente (processa a fila).
     * Implementação obrigatória do método abstrato da classe base.
     */
    execute(input?: TaskAgentInput): Promise<AgentResult<TaskAgentResult>>;
    /**
     * Constrói um resumo dos itens extraídos.
     */
    private buildSummary;
    /**
     * Notifica sobre tarefas urgentes.
     */
    private notifyUrgentTasks;
    /**
     * Atualiza a configuração do agente.
     */
    updateConfig(config: Partial<TaskAgentConfig>): void;
    /**
     * Adiciona stakeholders VIP.
     */
    addVipStakeholders(stakeholders: string[]): void;
}
//# sourceMappingURL=task-agent.d.ts.map