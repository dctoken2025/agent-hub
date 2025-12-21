import { EventEmitter } from 'events';
import type { AgentConfig, AgentResult, AgentStatus } from './types.js';
/**
 * Classe base abstrata para todos os agentes autônomos.
 * Cada agente específico deve estender esta classe e implementar o método execute().
 */
export declare abstract class Agent<TInput = unknown, TOutput = unknown> extends EventEmitter {
    config: AgentConfig;
    protected status: AgentStatus;
    private intervalId?;
    private lastRun?;
    private runCount;
    constructor(config: AgentConfig);
    /**
     * Método abstrato que cada agente deve implementar.
     * Contém a lógica principal de execução do agente.
     */
    abstract execute(input?: TInput): Promise<AgentResult<TOutput>>;
    /**
     * Método opcional para inicialização do agente.
     * Pode ser sobrescrito para configurar recursos necessários.
     */
    initialize(): Promise<void>;
    /**
     * Método opcional para limpeza de recursos.
     * Chamado quando o agente é parado.
     */
    cleanup(): Promise<void>;
    /**
     * Inicia o agente. Se tiver schedule configurado, executa periodicamente.
     */
    start(): Promise<void>;
    /**
     * Para o agente e limpa recursos.
     */
    stop(): Promise<void>;
    /**
     * Pausa temporariamente o agente.
     */
    pause(): void;
    /**
     * Retoma a execução do agente.
     */
    resume(): void;
    /**
     * Executa o agente uma única vez.
     */
    runOnce(input?: TInput): Promise<AgentResult<TOutput>>;
    /**
     * Retorna informações sobre o estado atual do agente.
     */
    getInfo(): {
        config: AgentConfig;
        status: AgentStatus;
        lastRun?: Date;
        runCount: number;
    };
    /**
     * Emite um evento do agente.
     */
    private emitEvent;
}
//# sourceMappingURL=agent.d.ts.map