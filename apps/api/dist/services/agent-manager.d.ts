/**
 * AgentManager - Gerenciador de Agentes Multi-tenant
 *
 * Responsável por criar, gerenciar e parar agentes para cada usuário.
 * Cada usuário tem suas próprias instâncias de agentes com suas configurações.
 */
import { type Agent } from '@agent-hub/core';
export declare class AgentManager {
    private userAgents;
    /**
     * Inicializa agentes para um usuário específico.
     * Chamado quando usuário faz login ou quando configs mudam.
     */
    initializeForUser(userId: string): Promise<void>;
    /**
     * Configura logging de eventos do agente.
     */
    private setupAgentLogging;
    /**
     * Para todos os agentes de um usuário.
     */
    stopForUser(userId: string): Promise<void>;
    /**
     * Inicia um agente específico do usuário.
     */
    startAgent(userId: string, agentType: string): Promise<void>;
    /**
     * Para um agente específico do usuário.
     */
    stopAgent(userId: string, agentType: string): Promise<void>;
    /**
     * Executa um agente uma vez manualmente.
     */
    runAgentOnce(userId: string, agentType: string, input?: unknown): Promise<void>;
    /**
     * Retorna informações dos agentes de um usuário.
     */
    getUserAgents(userId: string): Array<ReturnType<Agent['getInfo']>>;
    /**
     * Retorna informações de um agente específico.
     */
    getAgentInfo(userId: string, agentId: string): ReturnType<Agent['getInfo']> | null;
    /**
     * Atualiza configurações de um agente e reinicia.
     */
    updateAgentConfig(userId: string, _agentType?: string): Promise<void>;
    /**
     * Lista todos os usuários com agentes ativos.
     */
    getActiveUsers(): string[];
    /**
     * Para todos os agentes de todos os usuários.
     */
    stopAll(): Promise<void>;
    /**
     * Salva o estado de ativação dos agentes no banco.
     */
    setAgentsActiveState(userId: string, active: boolean): Promise<void>;
    /**
     * Inicia o scheduler de geração diária de briefings de foco.
     * Executa todos os dias às 6h da manhã (horário Brasil).
     */
    startDailyFocusScheduler(): void;
    /**
     * Gera briefings de foco para todos os usuários ativos.
     */
    generateDailyFocusBriefings(): Promise<void>;
    /**
     * Auto-inicia agentes de todos os usuários que tinham agentes ativos.
     * Chamado quando o servidor inicia.
     */
    autoStartAgents(): Promise<void>;
}
export declare function getAgentManager(): AgentManager;
//# sourceMappingURL=agent-manager.d.ts.map