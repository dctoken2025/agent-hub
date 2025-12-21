import type { AIMessage, AITool, AIResponse } from './types.js';
export type ProviderType = 'anthropic' | 'openai';
interface AIClientConfig {
    provider: ProviderType;
    anthropicApiKey?: string;
    anthropicModel?: string;
    openaiApiKey?: string;
    openaiModel?: string;
    maxTokens?: number;
    fallbackEnabled?: boolean;
}
/**
 * Cliente unificado para AI com suporte a múltiplos providers.
 * Suporta Anthropic (Claude) e OpenAI (GPT).
 */
export declare class AIClient {
    private primaryProvider;
    private fallbackProvider;
    private config;
    constructor(config?: Partial<AIClientConfig>);
    private createProvider;
    /**
     * Retorna o provider ativo.
     */
    getActiveProvider(): {
        name: ProviderType;
        model: string;
    };
    /**
     * Envia uma mensagem simples e retorna a resposta.
     */
    chat(messages: AIMessage[], systemPrompt?: string): Promise<AIResponse>;
    /**
     * Envia uma mensagem com suporte a tool use.
     */
    chatWithTools(messages: AIMessage[], tools: AITool[], systemPrompt?: string): Promise<AIResponse>;
    /**
     * Analisa texto e retorna classificação estruturada.
     */
    analyze<T>(text: string, instruction: string, schema: AITool): Promise<T | null>;
    /**
     * Executa operação com fallback automático.
     */
    private executeWithFallback;
}
/**
 * Configura o AIClient globalmente.
 */
export declare function configureAIClient(config: Partial<AIClientConfig>): void;
/**
 * Retorna o cliente AI compartilhado.
 */
export declare function getAIClient(options?: Partial<AIClientConfig>): AIClient;
/**
 * Recria o cliente com novas configurações.
 */
export declare function recreateAIClient(): void;
export {};
//# sourceMappingURL=ai-client.d.ts.map