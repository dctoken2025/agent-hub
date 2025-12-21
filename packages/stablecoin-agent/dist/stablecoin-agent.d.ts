import { Agent, type AgentConfig, type AgentResult, Notifier } from '@agent-hub/core';
import type { StablecoinAgentConfig, StablecoinConfig, StablecoinEvent, StablecoinAgentResult, AnomalyAlert, SupplySnapshot } from './types.js';
/**
 * Agente autônomo para monitoramento de stablecoins.
 * Monitora eventos de mint, burn e transfer, além de variações de supply.
 */
export declare class StablecoinAgent extends Agent<void, StablecoinAgentResult> {
    private alchemyClient;
    private anomalyDetector;
    private stablecoinConfig;
    private notifier?;
    private stablecoins;
    private lastProcessedBlock;
    private lastSupply;
    onEventDetected?: (event: StablecoinEvent) => Promise<void>;
    onAnomalyDetected?: (anomaly: AnomalyAlert, event?: StablecoinEvent) => Promise<void>;
    onSupplySnapshot?: (snapshot: SupplySnapshot) => Promise<void>;
    onAgentLog?: (result: StablecoinAgentResult) => Promise<void>;
    constructor(agentConfig: AgentConfig, stablecoinConfig: StablecoinAgentConfig, notifier?: Notifier);
    /**
     * Define as stablecoins a serem monitoradas.
     */
    setStablecoins(stablecoins: StablecoinConfig[]): void;
    /**
     * Adiciona uma stablecoin para monitoramento.
     */
    addStablecoin(stablecoin: StablecoinConfig): void;
    /**
     * Remove uma stablecoin do monitoramento.
     */
    removeStablecoin(address: string): void;
    /**
     * Atualiza a API key da Alchemy.
     */
    updateAlchemyApiKey(apiKey: string): void;
    /**
     * Atualiza os thresholds de detecção.
     */
    updateThresholds(thresholds: Partial<StablecoinAgentConfig['thresholds']>): void;
    /**
     * Execução principal do agente.
     */
    execute(): Promise<AgentResult<StablecoinAgentResult>>;
    /**
     * Processa uma stablecoin individual.
     */
    private processStablecoin;
    /**
     * Processa supply de uma stablecoin.
     */
    private processSupply;
    /**
     * Converte evento raw para StablecoinEvent.
     */
    private convertToStablecoinEvent;
    /**
     * Notifica sobre uma anomalia.
     */
    private notifyAnomaly;
    /**
     * Testa a conexão com a Alchemy API.
     */
    testConnection(): Promise<{
        success: boolean;
        blockNumber?: number;
        error?: string;
    }>;
    /**
     * Retorna estatísticas do agente.
     */
    getStats(): {
        stablecoinsMonitored: number;
        lastProcessedBlocks: Record<string, number>;
    };
}
//# sourceMappingURL=stablecoin-agent.d.ts.map