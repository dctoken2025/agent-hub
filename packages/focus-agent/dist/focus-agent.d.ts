import { Agent, type AgentConfig, type AgentResult } from '@agent-hub/core';
import type { FocusAgentConfig, FocusAgentInput, FocusBriefing, CollectedData } from './types.js';
/**
 * Focus Agent - Agente de IA para análise de foco e priorização
 *
 * Analisa emails, tarefas, itens financeiros e jurídicos para gerar
 * briefings executivos e listas priorizadas por urgência real.
 */
export declare class FocusAgent extends Agent<FocusAgentInput, FocusBriefing> {
    private _focusConfig;
    private dataCollector?;
    constructor(agentConfig: AgentConfig, focusConfig?: FocusAgentConfig);
    get focusConfig(): FocusAgentConfig;
    /**
     * Define a função de coleta de dados (injetada pelo AgentManager)
     */
    setDataCollector(collector: (userId: string, scope: 'today' | 'week') => Promise<CollectedData>): void;
    /**
     * Executa a análise de foco
     */
    execute(input?: FocusAgentInput): Promise<AgentResult<FocusBriefing>>;
    /**
     * Analisa os dados com IA e gera o briefing
     */
    private analyzeWithAI;
    /**
     * Constrói o prompt para a IA
     */
    private buildPrompt;
    /**
     * Prompt de sistema para a IA
     */
    private getSystemPrompt;
    /**
     * Faz parse da resposta da IA
     */
    private parseAIResponse;
    /**
     * Encontra os dados originais de um item
     */
    private findOriginalData;
    /**
     * Cria briefing de fallback sem IA
     */
    private createFallbackBriefing;
    /**
     * Calcula a data de expiração do briefing
     */
    private getExpirationDate;
}
//# sourceMappingURL=focus-agent.d.ts.map