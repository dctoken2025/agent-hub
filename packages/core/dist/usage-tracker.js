import { getAIContext } from './ai-context.js';
import { calculateCost } from './providers/pricing.js';
// Buffer de registros para batch insert
let usageBuffer = [];
let flushTimeout = null;
let dbSaveFunction = null;
/**
 * Configura a função de salvamento no banco.
 */
export function setUsageSaveFunction(fn) {
    dbSaveFunction = fn;
}
/**
 * Registra uso de AI.
 */
export function trackUsage(provider, model, inputTokens, outputTokens, durationMs, success, errorMessage) {
    const context = getAIContext();
    const record = {
        userId: context?.userId,
        provider,
        model,
        agentId: context?.agentId,
        operation: context?.operation,
        inputTokens,
        outputTokens,
        estimatedCost: calculateCost(model, inputTokens, outputTokens),
        durationMs,
        success,
        errorMessage,
        createdAt: new Date(),
    };
    usageBuffer.push(record);
    // Log para debug
    const costFormatted = (record.estimatedCost / 1_000_000).toFixed(6);
    console.log(`[UsageTracker] ${provider}/${model}: ${inputTokens}+${outputTokens} tokens, $${costFormatted}, ${durationMs}ms`);
    // Agenda flush
    if (!flushTimeout) {
        flushTimeout = setTimeout(flushUsage, 1000);
    }
}
/**
 * Salva registros buffered no banco.
 */
async function flushUsage() {
    flushTimeout = null;
    if (usageBuffer.length === 0)
        return;
    const records = [...usageBuffer];
    usageBuffer = [];
    if (dbSaveFunction) {
        try {
            await dbSaveFunction(records);
        }
        catch (error) {
            console.error('[UsageTracker] Erro ao salvar uso:', error);
            // Re-adiciona ao buffer para tentar novamente
            usageBuffer.push(...records);
        }
    }
}
/**
 * Força flush imediato (para shutdown).
 */
export async function forceFlushUsage() {
    if (flushTimeout) {
        clearTimeout(flushTimeout);
        flushTimeout = null;
    }
    await flushUsage();
}
//# sourceMappingURL=usage-tracker.js.map