import type { AIMessage, AITool, AIResponse } from './types.js';
import type { AIProvider, ProviderOptions } from './providers/base.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { OpenAIProvider } from './providers/openai.js';
import { trackUsage } from './usage-tracker.js';

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
export class AIClient {
  private primaryProvider: AIProvider;
  private fallbackProvider: AIProvider | null = null;
  private config: AIClientConfig;

  constructor(config?: Partial<AIClientConfig>) {
    this.config = {
      provider: config?.provider || 'anthropic',
      anthropicApiKey: config?.anthropicApiKey,
      anthropicModel: config?.anthropicModel,
      openaiApiKey: config?.openaiApiKey,
      openaiModel: config?.openaiModel,
      maxTokens: config?.maxTokens || 4096,
      fallbackEnabled: config?.fallbackEnabled ?? true,
    };

    // Cria provider primário
    this.primaryProvider = this.createProvider(this.config.provider);

    // Cria provider de fallback se configurado
    if (this.config.fallbackEnabled) {
      const fallbackType = this.config.provider === 'anthropic' ? 'openai' : 'anthropic';
      try {
        this.fallbackProvider = this.createProvider(fallbackType);
      } catch {
        // Fallback não configurado, ignora
        this.fallbackProvider = null;
      }
    }
  }

  private createProvider(type: ProviderType): AIProvider {
    const options: ProviderOptions = {
      maxTokens: this.config.maxTokens,
    };

    if (type === 'anthropic') {
      options.apiKey = this.config.anthropicApiKey;
      options.model = this.config.anthropicModel;
      return new AnthropicProvider(options);
    } else {
      options.apiKey = this.config.openaiApiKey;
      options.model = this.config.openaiModel;
      return new OpenAIProvider(options);
    }
  }

  /**
   * Retorna o provider ativo.
   */
  getActiveProvider(): { name: ProviderType; model: string } {
    return {
      name: this.primaryProvider.name,
      model: this.primaryProvider.model,
    };
  }

  /**
   * Envia uma mensagem simples e retorna a resposta.
   */
  async chat(
    messages: AIMessage[],
    systemPrompt?: string
  ): Promise<AIResponse> {
    return this.executeWithFallback(
      (provider) => provider.chat(messages, systemPrompt)
    );
  }

  /**
   * Envia uma mensagem com suporte a tool use.
   */
  async chatWithTools(
    messages: AIMessage[],
    tools: AITool[],
    systemPrompt?: string
  ): Promise<AIResponse> {
    return this.executeWithFallback(
      (provider) => provider.chatWithTools(messages, tools, systemPrompt)
    );
  }

  /**
   * Analisa texto e retorna classificação estruturada.
   */
  async analyze<T>(
    text: string,
    instruction: string,
    schema: AITool
  ): Promise<T | null> {
    return this.executeWithFallback(
      (provider) => provider.analyze<T>(text, instruction, schema)
    );
  }

  /**
   * Executa operação com fallback automático.
   */
  private async executeWithFallback<T>(
    operation: (provider: AIProvider) => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await operation(this.primaryProvider);
      
      // Registra uso bem-sucedido
      const duration = Date.now() - startTime;
      const response = result as unknown as AIResponse;
      if (response?.usage) {
        trackUsage(
          this.primaryProvider.name,
          this.primaryProvider.model,
          response.usage.inputTokens,
          response.usage.outputTokens,
          duration,
          true
        );
      }
      
      return result;
    } catch (primaryError) {
      const duration = Date.now() - startTime;
      const errorMessage = primaryError instanceof Error ? primaryError.message : 'Unknown error';
      
      console.error(`[AIClient] Erro no provider ${this.primaryProvider.name}:`, errorMessage);
      
      // Registra falha
      trackUsage(
        this.primaryProvider.name,
        this.primaryProvider.model,
        0,
        0,
        duration,
        false,
        errorMessage
      );

      // Tenta fallback se disponível
      if (this.fallbackProvider) {
        console.log(`[AIClient] Tentando fallback com ${this.fallbackProvider.name}...`);
        
        const fallbackStartTime = Date.now();
        try {
          const result = await operation(this.fallbackProvider);
          
          // Registra uso bem-sucedido do fallback
          const fallbackDuration = Date.now() - fallbackStartTime;
          const response = result as unknown as AIResponse;
          if (response?.usage) {
            trackUsage(
              this.fallbackProvider.name,
              this.fallbackProvider.model,
              response.usage.inputTokens,
              response.usage.outputTokens,
              fallbackDuration,
              true
            );
          }
          
          return result;
        } catch (fallbackError) {
          const fallbackDuration = Date.now() - fallbackStartTime;
          const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
          
          console.error(`[AIClient] Fallback também falhou:`, fallbackErrorMessage);
          
          // Registra falha do fallback
          trackUsage(
            this.fallbackProvider.name,
            this.fallbackProvider.model,
            0,
            0,
            fallbackDuration,
            false,
            fallbackErrorMessage
          );
          
          throw fallbackError;
        }
      }
      
      throw primaryError;
    }
  }
}

// Configuração global
let globalConfig: Partial<AIClientConfig> = {};
let sharedClient: AIClient | null = null;

/**
 * Configura o AIClient globalmente.
 */
export function configureAIClient(config: Partial<AIClientConfig>): void {
  globalConfig = { ...globalConfig, ...config };
  sharedClient = null; // Força recriação
  console.log(`[AIClient] Configurado: provider=${config.provider || globalConfig.provider || 'anthropic'}`);
}

/**
 * Retorna o cliente AI compartilhado.
 */
export function getAIClient(options?: Partial<AIClientConfig>): AIClient {
  if (!sharedClient || options) {
    const mergedConfig = { ...globalConfig, ...options };
    sharedClient = new AIClient(mergedConfig);
  }
  return sharedClient;
}

/**
 * Recria o cliente com novas configurações.
 */
export function recreateAIClient(): void {
  sharedClient = null;
}
