import type { AIMessage, AITool, AIResponse } from '../types.js';
import type { AIProvider, ProviderOptions } from './base.js';
/**
 * Provider para Anthropic (Claude).
 */
export declare class AnthropicProvider implements AIProvider {
    readonly name: "anthropic";
    readonly model: string;
    private client;
    private maxTokens;
    constructor(options?: ProviderOptions);
    chat(messages: AIMessage[], systemPrompt?: string): Promise<AIResponse>;
    chatWithTools(messages: AIMessage[], tools: AITool[], systemPrompt?: string): Promise<AIResponse>;
    analyze<T>(text: string, instruction: string, schema: AITool): Promise<T | null>;
}
//# sourceMappingURL=anthropic.d.ts.map