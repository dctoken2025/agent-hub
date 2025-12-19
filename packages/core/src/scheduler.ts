import type { Agent } from './agent.js';
import type { AgentEvent } from './types.js';

interface ScheduledAgent {
  agent: Agent;
  intervalId?: NodeJS.Timeout;
}

/**
 * Gerenciador central de agentes.
 * Controla o ciclo de vida e agendamento de todos os agentes.
 */
export class AgentScheduler {
  private agents: Map<string, ScheduledAgent> = new Map();
  private eventHandlers: Array<(event: AgentEvent) => void> = [];

  /**
   * Registra um agente no scheduler.
   */
  register(agent: Agent): void {
    const info = agent.getInfo();
    
    if (this.agents.has(info.config.id)) {
      console.warn(`[Scheduler] Agente ${info.config.id} já registrado`);
      return;
    }

    // Escuta eventos do agente
    agent.on('agentEvent', (event: AgentEvent) => {
      this.handleAgentEvent(event);
    });

    this.agents.set(info.config.id, { agent });
    console.log(`[Scheduler] Agente registrado: ${info.config.name}`);
  }

  /**
   * Remove um agente do scheduler.
   */
  async unregister(agentId: string): Promise<void> {
    const scheduled = this.agents.get(agentId);
    if (!scheduled) return;

    await scheduled.agent.stop();
    this.agents.delete(agentId);
    console.log(`[Scheduler] Agente removido: ${agentId}`);
  }

  /**
   * Inicia todos os agentes habilitados.
   */
  async startAll(): Promise<void> {
    console.log('[Scheduler] Iniciando todos os agentes...');
    
    const promises = Array.from(this.agents.values()).map(async ({ agent }) => {
      const info = agent.getInfo();
      if (info.config.enabled) {
        await agent.start();
      }
    });

    await Promise.all(promises);
  }

  /**
   * Para todos os agentes.
   */
  async stopAll(): Promise<void> {
    console.log('[Scheduler] Parando todos os agentes...');
    
    const promises = Array.from(this.agents.values()).map(async ({ agent }) => {
      await agent.stop();
    });

    await Promise.all(promises);
  }

  /**
   * Inicia um agente específico.
   */
  async start(agentId: string): Promise<void> {
    const scheduled = this.agents.get(agentId);
    if (!scheduled) {
      throw new Error(`Agente não encontrado: ${agentId}`);
    }
    await scheduled.agent.start();
  }

  /**
   * Para um agente específico.
   */
  async stop(agentId: string): Promise<void> {
    const scheduled = this.agents.get(agentId);
    if (!scheduled) {
      throw new Error(`Agente não encontrado: ${agentId}`);
    }
    await scheduled.agent.stop();
  }

  /**
   * Executa um agente uma vez manualmente.
   */
  async runOnce(agentId: string, input?: unknown): Promise<void> {
    const scheduled = this.agents.get(agentId);
    if (!scheduled) {
      throw new Error(`Agente não encontrado: ${agentId}`);
    }
    await scheduled.agent.runOnce(input);
  }

  /**
   * Retorna informações de todos os agentes.
   */
  getAgents(): Array<ReturnType<Agent['getInfo']>> {
    return Array.from(this.agents.values()).map(({ agent }) => agent.getInfo());
  }

  /**
   * Retorna informações de um agente específico.
   */
  getAgent(agentId: string): ReturnType<Agent['getInfo']> | null {
    const scheduled = this.agents.get(agentId);
    return scheduled ? scheduled.agent.getInfo() : null;
  }

  /**
   * Registra um handler para eventos de agentes.
   */
  onEvent(handler: (event: AgentEvent) => void): void {
    this.eventHandlers.push(handler);
  }

  private handleAgentEvent(event: AgentEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('[Scheduler] Erro no event handler:', error);
      }
    });
  }
}

// Singleton do scheduler
let sharedScheduler: AgentScheduler | null = null;

export function getScheduler(): AgentScheduler {
  if (!sharedScheduler) {
    sharedScheduler = new AgentScheduler();
  }
  return sharedScheduler;
}
