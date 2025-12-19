// Stablecoin Agent - Monitoramento de Stablecoins na Blockchain

// Classes principais
export { StablecoinAgent } from './stablecoin-agent.js';
export { AlchemyClient } from './alchemy-client.js';
export { AnomalyDetector } from './anomaly-detector.js';

// Tipos
export type {
  // Configuração
  Network,
  StablecoinConfig,
  StablecoinAgentConfig,
  AnomalyThresholds,
  
  // Eventos
  EventType,
  StablecoinEvent,
  RawTransferEvent,
  
  // Anomalias
  AnomalySeverity,
  AnomalyType,
  AnomalyAlert,
  
  // Supply
  SupplySnapshot,
  
  // Resultado
  StablecoinAgentResult,
} from './types.js';

// Constantes
export { 
  ZERO_ADDRESS, 
  DEFAULT_THRESHOLDS,
  TRANSFER_EVENT_SIGNATURE,
} from './types.js';
