import { EventEmitter } from 'events';
import { runWithAIContext } from './ai-context.js';
/**
 * Classe base abstrata para todos os agentes autônomos.
 * Cada agente específico deve estender esta classe e implementar o método execute().
 */
export class Agent extends EventEmitter {
    config;
    status = 'idle';
    intervalId;
    lastRun;
    runCount = 0;
    constructor(config) {
        super();
        this.config = config;
    }
    /**
     * Método opcional para inicialização do agente.
     * Pode ser sobrescrito para configurar recursos necessários.
     */
    async initialize() {
        // Override em subclasses se necessário
    }
    /**
     * Método opcional para limpeza de recursos.
     * Chamado quando o agente é parado.
     */
    async cleanup() {
        // Override em subclasses se necessário
    }
    /**
     * Inicia o agente. Se tiver schedule configurado, executa periodicamente.
     */
    async start() {
        if (this.status === 'running') {
            console.log(`[${this.config.name}] Agente já está rodando`);
            return;
        }
        try {
            console.log(`[${this.config.name}] Iniciando agente...`);
            await this.initialize();
            this.status = 'running';
            this.emitEvent('started');
            console.log(`[${this.config.name}] Agente iniciado com sucesso`);
            // Se tiver schedule do tipo interval, configura execução periódica
            if (this.config.schedule?.type === 'interval') {
                const intervalMs = this.config.schedule.value * 60 * 1000;
                console.log(`[${this.config.name}] Configurando execução a cada ${this.config.schedule.value} minuto(s)`);
                // Executa imediatamente na primeira vez
                console.log(`[${this.config.name}] Executando primeira vez...`);
                this.runOnce().catch(err => {
                    console.error(`[${this.config.name}] Erro na primeira execução:`, err);
                });
                // Configura execução periódica
                this.intervalId = setInterval(() => {
                    this.runOnce().catch(err => {
                        console.error(`[${this.config.name}] Erro na execução periódica:`, err);
                    });
                }, intervalMs);
            }
        }
        catch (error) {
            console.error(`[${this.config.name}] Erro ao iniciar agente:`, error);
            this.status = 'error';
            this.emitEvent('failed', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
            throw error;
        }
    }
    /**
     * Para o agente e limpa recursos.
     */
    async stop() {
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
    pause() {
        if (this.status === 'running') {
            this.status = 'paused';
            this.emitEvent('paused');
            console.log(`[${this.config.name}] Agente pausado`);
        }
    }
    /**
     * Retoma a execução do agente.
     */
    resume() {
        if (this.status === 'paused') {
            this.status = 'running';
            this.emitEvent('resumed');
            console.log(`[${this.config.name}] Agente retomado`);
        }
    }
    /**
     * Executa o agente uma única vez.
     */
    async runOnce(input) {
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
        // Executa dentro do contexto de AI para rastrear uso por usuário/agente
        const aiContext = {
            userId: this.config.userId,
            agentId: this.config.id,
            operation: this.config.name,
        };
        return runWithAIContext(aiContext, async () => {
            try {
                console.log(`[${this.config.name}] Executando... (run #${this.runCount})`);
                const result = await this.execute(input);
                const duration = Date.now() - startTime;
                if (result.success) {
                    this.emitEvent('completed', { result, duration });
                }
                else {
                    this.emitEvent('failed', { error: result.error, duration });
                }
                return {
                    ...result,
                    duration,
                };
            }
            catch (error) {
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
        });
    }
    /**
     * Retorna informações sobre o estado atual do agente.
     */
    getInfo() {
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
    emitEvent(type, details) {
        const event = {
            type,
            agentId: this.config.id,
            timestamp: new Date(),
            details,
        };
        // Emite tanto o evento genérico quanto o evento específico
        this.emit('agentEvent', event);
        this.emit(type, details);
    }
}
//# sourceMappingURL=agent.js.map