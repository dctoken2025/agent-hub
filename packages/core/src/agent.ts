import { EventEmitter } from 'events';
import type { AgentConfig, AgentResult, AgentStatus, AgentEvent } from './types.js';

/**
 * Classe base abstrata para todos os agentes autônomos.
 * Cada agente específico deve estender esta classe e implementar o método execute().
 */
export abstract class Agent<TInput = unknown, TOutput = unknown> extends EventEmitter {
  protected config: AgentConfig;
  protected status: AgentStatus = 'idle';
  private intervalId?: NodeJS.Timeout;
  private lastRun?: Date;
  private runCount: number = 0;

  constructor(config: AgentConfig) {
    super();
    this.config = config;
  }

  /**
   * Método abstrato que cada agente deve implementar.
   * Contém a lógica principal de execução do agente.
   */
  abstract execute(input?: TInput): Promise<AgentResult<TOutput>>;

  /**
   * Método opcional para inicialização do agente.
   * Pode ser sobrescrito para configurar recursos necessários.
   */
  async initialize(): Promise<void> {
    // Override em subclasses se necessário
  }

  /**
   * Método opcional para limpeza de recursos.
   * Chamado quando o agente é parado.
   */
  async cleanup(): Promise<void> {
    // Override em subclasses se necessário
  }

  /**
   * Inicia o agente. Se tiver schedule configurado, executa periodicamente.
   */
  async start(): Promise<void> {
    if (this.status === 'running') {
      console.log(`[${this.config.name}] Agente já está rodando`);
      return;
    }

    await this.initialize();
    this.status = 'running';
    this.emitEvent('started');

    console.log(`[${this.config.name}] Agente iniciado`);

    // Se tiver schedule do tipo interval, configura execução periódica
    if (this.config.schedule?.type === 'interval') {
      const intervalMs = (this.config.schedule.value as number) * 60 * 1000;
      
      // Executa imediatamente na primeira vez
      this.runOnce();
      
      // Configura execução periódica
      this.intervalId = setInterval(() => {
        this.runOnce();
      }, intervalMs);
    }
  }

  /**
   * Para o agente e limpa recursos.
   */
  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    await this.cleanup();
    this.status = 'idle';
    this.emitEvent('paused');

    console.log(`[${this.config.name}] Agente parado`);
  }

  /**
   * Pausa temporariamente o agente.
   */
  pause(): void {
    if (this.status === 'running') {
      this.status = 'paused';
      this.emitEvent('paused');
      console.log(`[${this.config.name}] Agente pausado`);
    }
  }

  /**
   * Retoma a execução do agente.
   */
  resume(): void {
    if (this.status === 'paused') {
      this.status = 'running';
      this.emitEvent('resumed');
      console.log(`[${this.config.name}] Agente retomado`);
    }
  }

  /**
   * Executa o agente uma única vez.
   */
  async runOnce(input?: TInput): Promise<AgentResult<TOutput>> {
    if (this.status === 'paused') {
      return {
        success: false,
        error: 'Agente está pausado',
        timestamp: new Date(),
        duration: 0,
      };
    }

    const startTime = Date.now();
    this.lastRun = new Date();
    this.runCount++;

    try {
      console.log(`[${this.config.name}] Executando... (run #${this.runCount})`);
      
      const result = await this.execute(input);
      
      if (result.success) {
        this.emitEvent('completed', { result });
      } else {
        this.emitEvent('failed', { error: result.error });
      }

      return {
        ...result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      this.status = 'error';
      this.emitEvent('failed', { error: errorMessage });

      return {
        success: false,
        error: errorMessage,
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Retorna informações sobre o estado atual do agente.
   */
  getInfo(): {
    config: AgentConfig;
    status: AgentStatus;
    lastRun?: Date;
    runCount: number;
  } {
    return {
      config: this.config,
      status: this.status,
      lastRun: this.lastRun,
      runCount: this.runCount,
    };
  }

  /**
   * Emite um evento do agente.
   */
  private emitEvent(type: AgentEvent['type'], details?: Record<string, unknown>): void {
    const event: AgentEvent = {
      type,
      agentId: this.config.id,
      timestamp: new Date(),
      details,
    };
    this.emit('agentEvent', event);
  }
}
