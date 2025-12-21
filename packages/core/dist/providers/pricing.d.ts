/**
 * Tabela de preços por modelo (em USD por 1M tokens).
 */
export interface ModelPricing {
    inputPer1M: number;
    outputPer1M: number;
}
export declare const MODEL_PRICING: Record<string, ModelPricing>;
/**
 * Calcula o custo estimado em microdólares (1 USD = 1.000.000).
 */
export declare function calculateCost(model: string, inputTokens: number, outputTokens: number): number;
/**
 * Formata microdólares para exibição.
 */
export declare function formatCost(microDollars: number): string;
/**
 * Modelos disponíveis por provider.
 */
export declare const AVAILABLE_MODELS: {
    anthropic: ({
        id: string;
        name: string;
        default: boolean;
    } | {
        id: string;
        name: string;
        default?: undefined;
    })[];
    openai: ({
        id: string;
        name: string;
        default: boolean;
    } | {
        id: string;
        name: string;
        default?: undefined;
    })[];
};
//# sourceMappingURL=pricing.d.ts.map