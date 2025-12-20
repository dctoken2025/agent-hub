import { AsyncLocalStorage } from 'async_hooks';

/**
 * Contexto para rastreamento de uso da AI.
 */
export interface AIContext {
  userId?: string;
  agentId?: string;
  operation?: string;
}

// Storage global para contexto
const aiContextStorage = new AsyncLocalStorage<AIContext>();

/**
 * Executa uma função com contexto de AI.
 */
export function runWithAIContext<T>(context: AIContext, fn: () => T): T {
  return aiContextStorage.run(context, fn);
}

/**
 * Obtém o contexto atual de AI.
 */
export function getAIContext(): AIContext | undefined {
  return aiContextStorage.getStore();
}

/**
 * Define o contexto de AI para a execução atual.
 */
export function setAIContextValue<K extends keyof AIContext>(key: K, value: AIContext[K]): void {
  const store = aiContextStorage.getStore();
  if (store) {
    store[key] = value;
  }
}
