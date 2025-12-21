import type { Agent } from './agent.js';
import type { AgentEvent } from './types.js';
/**
 * Gerenciador central de agentes.
 * Controla o ciclo de vida e agendamento de todos os agentes.
 */
export declare class AgentScheduler {
    private agents;
    private eventHandlers;
    /**
     * Registra um agente no scheduler.
     */
    register(agent: Agent): void;
    /**
     * Remove um agente do scheduler.
     */
    unregister(agentId: string): Promise<void>;
    /**
     * Inicia todos os agentes habilitados.
     */
    startAll(): Promise<void>;
    /**
     * Para todos os agentes.
     */
    stopAll(): Promise<void>;
    /**
     * Inicia um agente específico.
     */
    start(agentId: string): Promise<void>;
    /**
     * Para um agente específico.
     */
    stop(agentId: string): Promise<void>;
    /**
     * Executa um agente uma vez manualmente.
     */
    runOnce(agentId: string, input?: unknown): Promise<void>;
    /**
     * Retorna informações de todos os agentes.
     */
    getAgents(): Array<ReturnType<Agent['getInfo']>>;
    /**
     * Retorna informações de um agente específico.
     */
    getAgent(agentId: string): ReturnType<Agent['getInfo']> | null;
    /**
     * Retorna a instância direta de um agente (para atualizações de config).
     */
    getAgentInstance(agentId: string): Agent | null;
    /**
     * Atualiza a configuração de intervalo de um agente e o reinicia.
     */
    updateAgentInterval(agentId: string, newIntervalMinutes: number): Promise<boolean>;
    /**
     * Registra um handler para eventos de agentes.
     */
    onEvent(handler: (event: AgentEvent) => void): void;
    private handleAgentEvent;
}
export declare function getScheduler(): AgentScheduler;
//# sourceMappingURL=scheduler.d.ts.map