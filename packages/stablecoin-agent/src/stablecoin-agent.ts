import { Agent, type AgentConfig, type AgentResult, Notifier } from '@agent-hub/core';
import { AlchemyClient } from './alchemy-client.js';
import { AnomalyDetector } from './anomaly-detector.js';
import type {
  StablecoinAgentConfig,
  StablecoinConfig,
  StablecoinEvent,
  StablecoinAgentResult,
  AnomalyAlert,
  SupplySnapshot,
} from './types.js';
import { DEFAULT_THRESHOLDS } from './types.js';

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

/**
 * Agente autônomo para monitoramento de stablecoins.
 * Monitora eventos de mint, burn e transfer, além de variações de supply.
 */
export class StablecoinAgent extends Agent<void, StablecoinAgentResult> {
  private alchemyClient: AlchemyClient;
  private anomalyDetector: AnomalyDetector;
  private stablecoinConfig: StablecoinAgentConfig;
  private notifier?: Notifier;
  
  // Estado interno
  private stablecoins: StablecoinConfig[] = [];
  private lastProcessedBlock: Map<string, number> = new Map(); // address -> block
  private lastSupply: Map<string, bigint> = new Map(); // address -> supply

  // Callbacks para persistência (serão definidos pela API)
  public onEventDetected?: (event: StablecoinEvent) => Promise<void>;
  public onAnomalyDetected?: (anomaly: AnomalyAlert, event?: StablecoinEvent) => Promise<void>;
  public onSupplySnapshot?: (snapshot: SupplySnapshot) => Promise<void>;
  public onAgentLog?: (result: StablecoinAgentResult) => Promise<void>;

  constructor(
    agentConfig: AgentConfig,
    stablecoinConfig: StablecoinAgentConfig,
    notifier?: Notifier
  ) {
    super(agentConfig);
    this.stablecoinConfig = stablecoinConfig;
    this.alchemyClient = new AlchemyClient(stablecoinConfig.alchemyApiKey);
    this.anomalyDetector = new AnomalyDetector(stablecoinConfig.thresholds || DEFAULT_THRESHOLDS);
    this.notifier = notifier;
  }

  /**
   * Define as stablecoins a serem monitoradas.
   */
  setStablecoins(stablecoins: StablecoinConfig[]): void {
    this.stablecoins = stablecoins.filter(s => s.isActive !== false);
    console.log(`[StablecoinAgent] Monitorando ${this.stablecoins.length} stablecoin(s)`);
  }

  /**
   * Adiciona uma stablecoin para monitoramento.
   */
  addStablecoin(stablecoin: StablecoinConfig): void {
    this.stablecoins.push(stablecoin);
    console.log(`[StablecoinAgent] Adicionada: ${stablecoin.symbol} (${stablecoin.network})`);
  }

  /**
   * Remove uma stablecoin do monitoramento.
   */
  removeStablecoin(address: string): void {
    this.stablecoins = this.stablecoins.filter(s => 
      s.address.toLowerCase() !== address.toLowerCase()
    );
  }

  /**
   * Atualiza a API key da Alchemy.
   */
  updateAlchemyApiKey(apiKey: string): void {
    this.alchemyClient = new AlchemyClient(apiKey);
  }

  /**
   * Atualiza os thresholds de detecção.
   */
  updateThresholds(thresholds: Partial<StablecoinAgentConfig['thresholds']>): void {
    this.stablecoinConfig.thresholds = { 
      ...this.stablecoinConfig.thresholds, 
      ...thresholds 
    };
    this.anomalyDetector.updateThresholds(thresholds);
  }

  /**
   * Execução principal do agente.
   */
  async execute(): Promise<AgentResult<StablecoinAgentResult>> {
    const startTime = Date.now();
    
    const result: StablecoinAgentResult = {
      stablecoinsChecked: 0,
      eventsProcessed: 0,
      anomaliesDetected: 0,
      supplySnapshots: 0,
      events: [],
      anomalies: [],
    };

    if (this.stablecoins.length === 0) {
      console.log('[StablecoinAgent] Nenhuma stablecoin configurada para monitorar');
      return {
        success: true,
        data: result,
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };
    }

    try {
      console.log(`[StablecoinAgent] Iniciando verificação de ${this.stablecoins.length} stablecoin(s)...`);

      for (const stablecoin of this.stablecoins) {
        try {
          await this.processStablecoin(stablecoin, result);
          result.stablecoinsChecked++;
        } catch (error) {
          console.error(`[StablecoinAgent] Erro ao processar ${stablecoin.symbol}:`, error);
        }
      }

      // Limpa histórico antigo
      this.anomalyDetector.clearOldHistory();

      // Log do resultado
      console.log(`[StablecoinAgent] Verificação concluída:`);
      console.log(`   📊 Stablecoins: ${result.stablecoinsChecked}`);
      console.log(`   📝 Eventos: ${result.eventsProcessed}`);
      console.log(`   ⚠️ Anomalias: ${result.anomaliesDetected}`);
      console.log(`   💰 Snapshots: ${result.supplySnapshots}`);

      // Callback para log no banco
      if (this.onAgentLog) {
        await this.onAgentLog(result);
      }

      return {
        success: true,
        data: result,
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[StablecoinAgent] Erro na execução:', errorMessage);

      return {
        success: false,
        error: errorMessage,
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Processa uma stablecoin individual.
   */
  private async processStablecoin(
    stablecoin: StablecoinConfig,
    result: StablecoinAgentResult
  ): Promise<void> {
    const addressKey = `${stablecoin.network}:${stablecoin.address.toLowerCase()}`;
    
    console.log(`[StablecoinAgent] Processando ${stablecoin.symbol} (${stablecoin.network})...`);

    // Obtém bloco atual
    const currentBlock = await this.alchemyClient.getCurrentBlock(stablecoin.network);
    
    // Determina intervalo de blocos
    // Para primeira execução, busca apenas últimos 100 blocos para não sobrecarregar
    let fromBlock = this.lastProcessedBlock.get(addressKey);
    if (!fromBlock) {
      fromBlock = currentBlock - 100; // ~20 minutos de blocos no Ethereum
    }
    
    const toBlock = currentBlock;
    
    if (fromBlock >= toBlock) {
      console.log(`[StablecoinAgent] ${stablecoin.symbol}: Sem novos blocos para processar`);
      return;
    }

    // Busca eventos de Transfer
    const rawEvents = await this.alchemyClient.getTransferEvents(stablecoin, fromBlock, toBlock);
    
    // Processa cada evento
    for (const rawEvent of rawEvents) {
      const event = this.convertToStablecoinEvent(rawEvent, stablecoin);
      result.events.push(event);
      result.eventsProcessed++;

      // Persiste evento
      if (this.onEventDetected) {
        await this.onEventDetected(event);
      }

      // Analisa anomalia
      const anomaly = this.anomalyDetector.analyzeEvent(event);
      if (anomaly) {
        result.anomalies.push(anomaly);
        result.anomaliesDetected++;

        // Persiste anomalia
        if (this.onAnomalyDetected) {
          await this.onAnomalyDetected(anomaly, event);
        }

        // Notifica
        await this.notifyAnomaly(anomaly);
      }
    }

    // Analisa frequência de eventos
    const frequencyAnomaly = this.anomalyDetector.analyzeFrequency(
      stablecoin.symbol,
      addressKey,
      result.events.filter(e => 
        e.stablecoin.address.toLowerCase() === stablecoin.address.toLowerCase()
      )
    );
    
    if (frequencyAnomaly) {
      result.anomalies.push(frequencyAnomaly);
      result.anomaliesDetected++;
      
      if (this.onAnomalyDetected) {
        await this.onAnomalyDetected(frequencyAnomaly);
      }
      
      await this.notifyAnomaly(frequencyAnomaly);
    }

    // Busca e analisa supply
    await this.processSupply(stablecoin, addressKey, currentBlock, result);

    // Atualiza último bloco processado
    this.lastProcessedBlock.set(addressKey, toBlock);
  }

  /**
   * Processa supply de uma stablecoin.
   */
  private async processSupply(
    stablecoin: StablecoinConfig,
    addressKey: string,
    blockNumber: number,
    result: StablecoinAgentResult
  ): Promise<void> {
    try {
      const currentSupply = await this.alchemyClient.getTotalSupply(stablecoin);
      const previousSupply = this.lastSupply.get(addressKey);

      // Cria snapshot
      const snapshot: SupplySnapshot = {
        stablecoinId: stablecoin.id || 0,
        supply: currentSupply,
        supplyFormatted: AlchemyClient.formatTokenAmount(currentSupply, stablecoin.decimals),
        blockNumber,
        changePercent: previousSupply 
          ? Number((currentSupply - previousSupply) * BigInt(10000) / previousSupply) / 100
          : undefined,
        timestamp: new Date(),
      };

      result.supplySnapshots++;

      // Persiste snapshot
      if (this.onSupplySnapshot) {
        await this.onSupplySnapshot(snapshot);
      }

      // Analisa variação de supply
      if (previousSupply) {
        const supplyAnomaly = this.anomalyDetector.analyzeSupplyChange(
          stablecoin.symbol,
          currentSupply,
          previousSupply,
          stablecoin.decimals
        );

        if (supplyAnomaly) {
          result.anomalies.push(supplyAnomaly);
          result.anomaliesDetected++;

          if (this.onAnomalyDetected) {
            await this.onAnomalyDetected(supplyAnomaly);
          }

          await this.notifyAnomaly(supplyAnomaly);
        }
      }

      // Atualiza último supply
      this.lastSupply.set(addressKey, currentSupply);

      console.log(`[StablecoinAgent] ${stablecoin.symbol} Supply: ${snapshot.supplyFormatted}`);

    } catch (error) {
      console.error(`[StablecoinAgent] Erro ao buscar supply de ${stablecoin.symbol}:`, error);
    }
  }

  /**
   * Converte evento raw para StablecoinEvent.
   */
  private convertToStablecoinEvent(
    raw: { 
      transactionHash: string; 
      blockNumber: number; 
      logIndex: number;
      from: string; 
      to: string; 
      value: bigint;
    },
    stablecoin: StablecoinConfig
  ): StablecoinEvent {
    // Determina tipo do evento
    let eventType: 'mint' | 'burn' | 'transfer';
    
    if (raw.from.toLowerCase() === ZERO_ADDR) {
      eventType = 'mint';
    } else if (raw.to.toLowerCase() === ZERO_ADDR) {
      eventType = 'burn';
    } else {
      eventType = 'transfer';
    }

    return {
      txHash: raw.transactionHash,
      blockNumber: raw.blockNumber,
      logIndex: raw.logIndex,
      eventType,
      from: raw.from,
      to: raw.to,
      amount: raw.value,
      amountFormatted: AlchemyClient.formatTokenAmount(raw.value, stablecoin.decimals),
      timestamp: new Date(),
      stablecoin,
    };
  }

  /**
   * Notifica sobre uma anomalia.
   */
  private async notifyAnomaly(anomaly: AnomalyAlert): Promise<void> {
    if (!this.notifier) return;

    // Só notifica anomalias high ou critical
    if (anomaly.severity !== 'high' && anomaly.severity !== 'critical') {
      return;
    }

    const emoji = AnomalyDetector.getSeverityEmoji(anomaly.severity);
    const message = `${emoji} **${anomaly.title}**\n\n${anomaly.description}`;

    try {
      await this.notifier.notify(message, {
        title: `${emoji} Stablecoin Alert`,
        priority: anomaly.severity === 'critical' ? 'urgent' : 'high',
      });
    } catch (error) {
      console.error('[StablecoinAgent] Erro ao enviar notificação:', error);
    }
  }

  /**
   * Testa a conexão com a Alchemy API.
   */
  async testConnection(): Promise<{ success: boolean; blockNumber?: number; error?: string }> {
    return await this.alchemyClient.testConnection();
  }

  /**
   * Retorna estatísticas do agente.
   */
  getStats(): {
    stablecoinsMonitored: number;
    lastProcessedBlocks: Record<string, number>;
  } {
    return {
      stablecoinsMonitored: this.stablecoins.length,
      lastProcessedBlocks: Object.fromEntries(this.lastProcessedBlock),
    };
  }
}

