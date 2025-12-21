import type { StablecoinEvent, AnomalyAlert, AnomalyThresholds, AnomalySeverity } from './types.js';
/**
 * Detector de anomalias em eventos de stablecoins.
 * Analisa eventos e identifica padrões fora do normal.
 */
export declare class AnomalyDetector {
    private thresholds;
    private eventHistory;
    constructor(thresholds: AnomalyThresholds);
    /**
     * Atualiza os thresholds de detecção.
     */
    updateThresholds(thresholds: Partial<AnomalyThresholds>): void;
    /**
     * Analisa um evento e retorna uma anomalia se detectada.
     */
    analyzeEvent(event: StablecoinEvent): AnomalyAlert | null;
    /**
     * Verifica anomalia em evento de mint.
     */
    private checkMintAnomaly;
    /**
     * Verifica anomalia em evento de burn.
     */
    private checkBurnAnomaly;
    /**
     * Verifica anomalia em evento de transfer.
     */
    private checkTransferAnomaly;
    /**
     * Analisa variação de supply entre dois snapshots.
     */
    analyzeSupplyChange(stablecoinSymbol: string, currentSupply: bigint, previousSupply: bigint, decimals: number): AnomalyAlert | null;
    /**
     * Analisa frequência de eventos.
     */
    analyzeFrequency(stablecoinSymbol: string, stablecoinAddress: string, newEvents: StablecoinEvent[]): AnomalyAlert | null;
    /**
     * Cria um alerta de anomalia.
     */
    private createAlert;
    /**
     * Converte valor formatado para número.
     */
    private parseFormattedAmount;
    /**
     * Trunca endereço para exibição.
     */
    private truncateAddress;
    /**
     * Retorna o emoji de severidade.
     */
    static getSeverityEmoji(severity: AnomalySeverity): string;
    /**
     * Limpa histórico de eventos antigos.
     */
    clearOldHistory(): void;
}
//# sourceMappingURL=anomaly-detector.d.ts.map