import type { ActionItem, TaskAgentConfig } from './types.js';
/**
 * Extrator de tarefas e action items de emails.
 * Usa Claude AI para identificar perguntas, pendências e itens de ação.
 */
export declare class TaskExtractor {
    private config;
    constructor(config: TaskAgentConfig);
    /**
     * Verifica se um email parece conter tarefas ou perguntas.
     */
    hasActionItems(subject: string, body: string): boolean;
    /**
     * Verifica se o remetente é um stakeholder VIP.
     */
    isVipStakeholder(email: string): boolean;
    /**
     * Extrai action items de um email usando IA.
     */
    extract(emailSubject: string, emailBody: string, emailId: string, emailFrom: string, threadId?: string, emailDate?: Date): Promise<ActionItem[]>;
    /**
     * Gera uma sugestão de resposta completa para o email.
     */
    generateReply(emailSubject: string, _emailBody: string, emailFrom: string, items: ActionItem[]): Promise<string | undefined>;
    /**
     * Constrói o contexto para análise.
     */
    private buildContext;
    /**
     * Constrói o prompt de sistema para extração de tarefas.
     */
    private buildSystemPrompt;
    /**
     * Calcula a prioridade final considerando todos os fatores.
     */
    private calculateFinalPriority;
    /**
     * Constrói a razão da prioridade para exibição.
     */
    private buildPriorityReason;
}
//# sourceMappingURL=task-extractor.d.ts.map