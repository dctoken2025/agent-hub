import { AlchemyClient } from './alchemy-client.js';
/**
 * Detector de anomalias em eventos de stablecoins.
 * Analisa eventos e identifica padrões fora do normal.
 */
export class AnomalyDetector {
    thresholds;
    eventHistory = new Map(); // stablecoin address -> eventos
    constructor(thresholds) {
        this.thresholds = thresholds;
    }
    /**
     * Atualiza os thresholds de detecção.
     */
    updateThresholds(thresholds) {
        this.thresholds = { ...this.thresholds, ...thresholds };
    }
    /**
     * Analisa um evento e retorna uma anomalia se detectada.
     */
    analyzeEvent(event) {
        const amount = this.parseFormattedAmount(event.amountFormatted);
        // Verifica eventos grandes baseado no tipo
        switch (event.eventType) {
            case 'mint':
                return this.checkMintAnomaly(event, amount);
            case 'burn':
                return this.checkBurnAnomaly(event, amount);
            case 'transfer':
                return this.checkTransferAnomaly(event, amount);
            default:
                return null;
        }
    }
    /**
     * Verifica anomalia em evento de mint.
     */
    checkMintAnomaly(event, amount) {
        // Mint muito grande (> 100M) = CRITICAL
        if (amount >= this.thresholds.largeMint * 10) {
            return this.createAlert('large_mint', 'critical', `Emissão Muito Grande de ${event.stablecoin.symbol}`, `Detectado mint de ${event.amountFormatted} ${event.stablecoin.symbol} - 10x acima do threshold normal`, event);
        }
        // Mint grande (> threshold) = HIGH
        if (amount >= this.thresholds.largeMint) {
            return this.createAlert('large_mint', 'high', `Grande Emissão de ${event.stablecoin.symbol}`, `Detectado mint de ${event.amountFormatted} ${event.stablecoin.symbol}`, event);
        }
        return null;
    }
    /**
     * Verifica anomalia em evento de burn.
     */
    checkBurnAnomaly(event, amount) {
        // Burn muito grande (> 100M) = CRITICAL
        if (amount >= this.thresholds.largeBurn * 10) {
            return this.createAlert('large_burn', 'critical', `Queima Muito Grande de ${event.stablecoin.symbol}`, `Detectado burn de ${event.amountFormatted} ${event.stablecoin.symbol} - 10x acima do threshold normal`, event);
        }
        // Burn grande (> threshold) = HIGH
        if (amount >= this.thresholds.largeBurn) {
            return this.createAlert('large_burn', 'high', `Grande Queima de ${event.stablecoin.symbol}`, `Detectado burn de ${event.amountFormatted} ${event.stablecoin.symbol}`, event);
        }
        return null;
    }
    /**
     * Verifica anomalia em evento de transfer.
     */
    checkTransferAnomaly(event, amount) {
        // Transfer muito grande = HIGH
        if (amount >= this.thresholds.largeTransfer * 2) {
            return this.createAlert('large_transfer', 'high', `Transferência Muito Grande de ${event.stablecoin.symbol}`, `Detectada transferência de ${event.amountFormatted} ${event.stablecoin.symbol} de ${this.truncateAddress(event.from)} para ${this.truncateAddress(event.to)}`, event);
        }
        // Transfer grande (> threshold) = MEDIUM
        if (amount >= this.thresholds.largeTransfer) {
            return this.createAlert('large_transfer', 'medium', `Grande Transferência de ${event.stablecoin.symbol}`, `Detectada transferência de ${event.amountFormatted} ${event.stablecoin.symbol}`, event);
        }
        return null;
    }
    /**
     * Analisa variação de supply entre dois snapshots.
     */
    analyzeSupplyChange(stablecoinSymbol, currentSupply, previousSupply, decimals) {
        if (previousSupply === BigInt(0)) {
            return null; // Primeiro snapshot, sem comparação
        }
        // Calcula variação percentual
        const difference = currentSupply - previousSupply;
        const changePercent = Number((difference * BigInt(10000)) / previousSupply) / 100;
        if (Math.abs(changePercent) >= this.thresholds.supplyChangePercent) {
            const direction = changePercent > 0 ? 'aumentou' : 'diminuiu';
            const currentFormatted = AlchemyClient.formatTokenAmount(currentSupply, decimals);
            const previousFormatted = AlchemyClient.formatTokenAmount(previousSupply, decimals);
            return {
                type: 'supply_change',
                severity: Math.abs(changePercent) >= this.thresholds.supplyChangePercent * 2 ? 'high' : 'medium',
                title: `Variação de Supply Anormal - ${stablecoinSymbol}`,
                description: `Supply ${direction} ${Math.abs(changePercent).toFixed(2)}% em 1 hora. De ${previousFormatted} para ${currentFormatted}`,
                metadata: {
                    previousSupply: previousSupply.toString(),
                    currentSupply: currentSupply.toString(),
                    changePercent,
                },
                timestamp: new Date(),
            };
        }
        return null;
    }
    /**
     * Analisa frequência de eventos.
     */
    analyzeFrequency(stablecoinSymbol, stablecoinAddress, newEvents) {
        // Adiciona novos eventos ao histórico
        const history = this.eventHistory.get(stablecoinAddress) || [];
        history.push(...newEvents);
        // Mantém apenas eventos da última hora
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        const recentEvents = history.filter(e => e.timestamp.getTime() > oneHourAgo);
        this.eventHistory.set(stablecoinAddress, recentEvents);
        // Verifica se excede threshold
        if (recentEvents.length >= this.thresholds.frequencyPerHour) {
            return {
                type: 'frequency_spike',
                severity: recentEvents.length >= this.thresholds.frequencyPerHour * 2 ? 'high' : 'medium',
                title: `Frequência Alta de Eventos - ${stablecoinSymbol}`,
                description: `Detectados ${recentEvents.length} eventos na última hora (threshold: ${this.thresholds.frequencyPerHour})`,
                metadata: {
                    eventCount: recentEvents.length,
                    threshold: this.thresholds.frequencyPerHour,
                },
                timestamp: new Date(),
            };
        }
        return null;
    }
    /**
     * Cria um alerta de anomalia.
     */
    createAlert(type, severity, title, description, event) {
        return {
            type,
            severity,
            title,
            description,
            event,
            metadata: event ? {
                txHash: event.txHash,
                blockNumber: event.blockNumber,
                from: event.from,
                to: event.to,
                amount: event.amount.toString(),
                amountFormatted: event.amountFormatted,
            } : {},
            timestamp: new Date(),
        };
    }
    /**
     * Converte valor formatado para número.
     */
    parseFormattedAmount(formatted) {
        // Remove separadores de milhar e converte para número
        return parseFloat(formatted.replace(/,/g, ''));
    }
    /**
     * Trunca endereço para exibição.
     */
    truncateAddress(address) {
        if (address.length <= 10)
            return address;
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    /**
     * Retorna o emoji de severidade.
     */
    static getSeverityEmoji(severity) {
        switch (severity) {
            case 'critical': return '🚨';
            case 'high': return '⚠️';
            case 'medium': return '🟡';
            case 'low': return '📋';
        }
    }
    /**
     * Limpa histórico de eventos antigos.
     */
    clearOldHistory() {
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        for (const [address, events] of this.eventHistory.entries()) {
            const recent = events.filter(e => e.timestamp.getTime() > oneHourAgo);
            this.eventHistory.set(address, recent);
        }
    }
}
//# sourceMappingURL=anomaly-detector.js.map