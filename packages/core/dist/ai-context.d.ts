/**
 * Contexto para rastreamento de uso da AI.
 */
export interface AIContext {
    userId?: string;
    agentId?: string;
    operation?: string;
}
/**
 * Executa uma função com contexto de AI.
 */
export declare function runWithAIContext<T>(context: AIContext, fn: () => T): T;
/**
 * Obtém o contexto atual de AI.
 */
export declare function getAIContext(): AIContext | undefined;
/**
 * Define o contexto de AI para a execução atual.
 */
export declare function setAIContextValue<K extends keyof AIContext>(key: K, value: AIContext[K]): void;
//# sourceMappingURL=ai-context.d.ts.map