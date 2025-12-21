/**
 * Gerenciador central de agentes.
 * Controla o ciclo de vida e agendamento de todos os agentes.
 */
export class AgentScheduler {
    agents = new Map();
    eventHandlers = [];
    /**
     * Registra um agente no scheduler.
     */
    register(agent) {
        const info = agent.getInfo();
        if (this.agents.has(info.config.id)) {
            console.warn(`[Scheduler] Agente ${info.config.id} já registrado`);
            return;
        }
        // Escuta eventos do agente
        agent.on('agentEvent', (event) => {
            this.handleAgentEvent(event);
        });
        this.agents.set(info.config.id, { agent });
        console.log(`[Scheduler] Agente registrado: ${info.config.name}`);
    }
    /**
     * Remove um agente do scheduler.
     */
    async unregister(agentId) {
        const scheduled = this.agents.get(agentId);
        if (!scheduled)
            return;
        await scheduled.agent.stop();
        this.agents.delete(agentId);
        console.log(`[Scheduler] Agente removido: ${agentId}`);
    }
    /**
     * Inicia todos os agentes habilitados.
     */
    async startAll() {
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
    async stopAll() {
        console.log('[Scheduler] Parando todos os agentes...');
        const promises = Array.from(this.agents.values()).map(async ({ agent }) => {
            await agent.stop();
        });
        await Promise.all(promises);
    }
    /**
     * Inicia um agente específico.
     */
    async start(agentId) {
        const scheduled = this.agents.get(agentId);
        if (!scheduled) {
            throw new Error(`Agente não encontrado: ${agentId}`);
        }
        await scheduled.agent.start();
    }
    /**
     * Para um agente específico.
     */
    async stop(agentId) {
        const scheduled = this.agents.get(agentId);
        if (!scheduled) {
            throw new Error(`Agente não encontrado: ${agentId}`);
        }
        await scheduled.agent.stop();
    }
    /**
     * Executa um agente uma vez manualmente.
     */
    async runOnce(agentId, input) {
        const scheduled = this.agents.get(agentId);
        if (!scheduled) {
            throw new Error(`Agente não encontrado: ${agentId}`);
        }
        await scheduled.agent.runOnce(input);
    }
    /**
     * Retorna informações de todos os agentes.
     */
    getAgents() {
        return Array.from(this.agents.values()).map(({ agent }) => agent.getInfo());
    }
    /**
     * Retorna informações de um agente específico.
     */
    getAgent(agentId) {
        const scheduled = this.agents.get(agentId);
        return scheduled ? scheduled.agent.getInfo() : null;
    }
    /**
     * Retorna a instância direta de um agente (para atualizações de config).
     */
    getAgentInstance(agentId) {
        const scheduled = this.agents.get(agentId);
        return scheduled ? scheduled.agent : null;
    }
    /**
     * Atualiza a configuração de intervalo de um agente e o reinicia.
     */
    async updateAgentInterval(agentId, newIntervalMinutes) {
        const scheduled = this.agents.get(agentId);
        if (!scheduled) {
            console.warn(`[Scheduler] Agente ${agentId} não encontrado para atualização`);
            return false;
        }
        const agent = scheduled.agent;
        const wasRunning = agent.getInfo().status === 'running';
        try {
            // Para o agente se estiver rodando
            if (wasRunning) {
                console.log(`[Scheduler] 🔄 Parando ${agentId} para atualizar configuração...`);
                await agent.stop();
            }
            // Atualiza a configuração de intervalo
            agent.config.schedule = {
                type: 'interval',
                value: newIntervalMinutes,
            };
            console.log(`[Scheduler] ⚙️ Intervalo de ${agentId} atualizado para ${newIntervalMinutes} min`);
            // Reinicia se estava rodando
            if (wasRunning) {
                await agent.start();
                console.log(`[Scheduler] ✅ ${agentId} reiniciado com sucesso!`);
            }
            return true;
        }
        catch (error) {
            console.error(`[Scheduler] ❌ Erro ao atualizar ${agentId}:`, error);
            return false;
        }
    }
    /**
     * Registra um handler para eventos de agentes.
     */
    onEvent(handler) {
        this.eventHandlers.push(handler);
    }
    handleAgentEvent(event) {
        this.eventHandlers.forEach(handler => {
            try {
                handler(event);
            }
            catch (error) {
                console.error('[Scheduler] Erro no event handler:', error);
            }
        });
    }
}
// Singleton do scheduler
let sharedScheduler = null;
export function getScheduler() {
    if (!sharedScheduler) {
        sharedScheduler = new AgentScheduler();
    }
    return sharedScheduler;
}
//# sourceMappingURL=scheduler.js.map