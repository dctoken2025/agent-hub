/**
 * Tabela de preços por modelo (em USD por 1M tokens).
 */
export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic
  'claude-sonnet-4-20250514': { inputPer1M: 3.00, outputPer1M: 15.00 },
  'claude-3-5-sonnet-20241022': { inputPer1M: 3.00, outputPer1M: 15.00 },
  'claude-3-haiku-20240307': { inputPer1M: 0.25, outputPer1M: 1.25 },
  
  // OpenAI
  'gpt-4o': { inputPer1M: 2.50, outputPer1M: 10.00 },
  'gpt-4o-2024-11-20': { inputPer1M: 2.50, outputPer1M: 10.00 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60 },
  'gpt-4o-mini-2024-07-18': { inputPer1M: 0.15, outputPer1M: 0.60 },
};

/**
 * Calcula o custo estimado em microdólares (1 USD = 1.000.000).
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    // Fallback para um preço médio se modelo não encontrado
    return Math.round((inputTokens * 2 + outputTokens * 10) / 1000);
  }
  
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  
  // Retorna em microdólares
  return Math.round((inputCost + outputCost) * 1_000_000);
}

/**
 * Formata microdólares para exibição.
 */
export function formatCost(microDollars: number): string {
  const dollars = microDollars / 1_000_000;
  return `$${dollars.toFixed(4)}`;
}

/**
 * Modelos disponíveis por provider.
 */
export const AVAILABLE_MODELS = {
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', default: true },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', default: true },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  ],
};
