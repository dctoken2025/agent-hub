import Anthropic from '@anthropic-ai/sdk';
import type { AIMessage, AITool, AIResponse } from './types.js';

/**
 * Cliente para interação com a API do Claude.
 * Wrapper simplificado com suporte a tool use.
 */
export class AIClient {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(options?: {
    apiKey?: string;
    model?: string;
    maxTokens?: number;
  }) {
    this.client = new Anthropic({
      apiKey: options?.apiKey || process.env.ANTHROPIC_API_KEY,
    });
    this.model = options?.model || 'claude-sonnet-4-20250514';
    this.maxTokens = options?.maxTokens || 4096;
  }

  /**
   * Envia uma mensagem simples e retorna a resposta.
   */
  async chat(
    messages: AIMessage[],
    systemPrompt?: string
  ): Promise<AIResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textContent = response.content.find(c => c.type === 'text');
    
    return {
      content: textContent?.type === 'text' ? textContent.text : '',
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  /**
   * Envia uma mensagem com suporte a tool use.
   */
  async chatWithTools(
    messages: AIMessage[],
    tools: AITool[],
    systemPrompt?: string
  ): Promise<AIResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool['input_schema'],
      })),
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textContent = response.content.find(c => c.type === 'text');
    const toolUseBlocks = response.content.filter(c => c.type === 'tool_use');

    return {
      content: textContent?.type === 'text' ? textContent.text : '',
      toolCalls: toolUseBlocks.map(block => {
        if (block.type === 'tool_use') {
          return {
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          };
        }
        return { id: '', name: '', input: {} };
      }).filter(t => t.id !== ''),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  /**
   * Analisa texto e retorna classificação estruturada.
   */
  async analyze<T>(
    text: string,
    instruction: string,
    schema: AITool
  ): Promise<T | null> {
    const response = await this.chatWithTools(
      [{ role: 'user', content: `${instruction}\n\nTexto para análise:\n${text}` }],
      [schema]
    );

    if (response.toolCalls && response.toolCalls.length > 0) {
      return response.toolCalls[0].input as T;
    }

    return null;
  }
}

let sharedClient: AIClient | null = null;

export function getAIClient(options?: {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}): AIClient {
  if (!sharedClient) {
    sharedClient = new AIClient(options);
  }
  return sharedClient;
}
