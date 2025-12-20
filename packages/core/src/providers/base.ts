import type { AIMessage, AITool, AIResponse } from '../types.js';

/**
 * Interface base para providers de AI.
 */
export interface AIProvider {
  readonly name: 'anthropic' | 'openai';
  readonly model: string;
  
  /**
   * Envia uma mensagem simples e retorna a resposta.
   */
  chat(
    messages: AIMessage[],
    systemPrompt?: string
  ): Promise<AIResponse>;

  /**
   * Envia uma mensagem com suporte a tool use.
   */
  chatWithTools(
    messages: AIMessage[],
    tools: AITool[],
    systemPrompt?: string
  ): Promise<AIResponse>;

  /**
   * Analisa texto e retorna classificação estruturada.
   */
  analyze<T>(
    text: string,
    instruction: string,
    schema: AITool
  ): Promise<T | null>;
}

/**
 * Opções para criar um provider.
 */
export interface ProviderOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}
