import type { AIMessage, AITool, AIResponse } from '../types.js';
import type { AIProvider, ProviderOptions } from './base.js';
/**
 * Provider para OpenAI (GPT).
 */
export declare class OpenAIProvider implements AIProvider {
    readonly name: "openai";
    readonly model: string;
    private client;
    private maxTokens;
    constructor(options?: ProviderOptions);
    chat(messages: AIMessage[], systemPrompt?: string): Promise<AIResponse>;
    chatWithTools(messages: AIMessage[], tools: AITool[], systemPrompt?: string): Promise<AIResponse>;
    analyze<T>(text: string, instruction: string, schema: AITool): Promise<T | null>;
}
//# sourceMappingURL=openai.d.ts.map