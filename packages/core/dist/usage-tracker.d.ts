/**
 * Registro de uso de AI.
 */
export interface UsageRecord {
    userId?: string;
    provider: 'anthropic' | 'openai';
    model: string;
    agentId?: string;
    operation?: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;
    durationMs: number;
    success: boolean;
    errorMessage?: string;
    createdAt: Date;
}
/**
 * Configura a função de salvamento no banco.
 */
export declare function setUsageSaveFunction(fn: (records: UsageRecord[]) => Promise<void>): void;
/**
 * Registra uso de AI.
 */
export declare function trackUsage(provider: 'anthropic' | 'openai', model: string, inputTokens: number, outputTokens: number, durationMs: number, success: boolean, errorMessage?: string): void;
/**
 * Força flush imediato (para shutdown).
 */
export declare function forceFlushUsage(): Promise<void>;
//# sourceMappingURL=usage-tracker.d.ts.map