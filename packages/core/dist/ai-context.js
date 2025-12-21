import { AsyncLocalStorage } from 'async_hooks';
// Storage global para contexto
const aiContextStorage = new AsyncLocalStorage();
/**
 * Executa uma função com contexto de AI.
 */
export function runWithAIContext(context, fn) {
    return aiContextStorage.run(context, fn);
}
/**
 * Obtém o contexto atual de AI.
 */
export function getAIContext() {
    return aiContextStorage.getStore();
}
/**
 * Define o contexto de AI para a execução atual.
 */
export function setAIContextValue(key, value) {
    const store = aiContextStorage.getStore();
    if (store) {
        store[key] = value;
    }
}
//# sourceMappingURL=ai-context.js.map