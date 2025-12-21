export type Network = 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'base';
export interface StablecoinConfig {
    id?: number;
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    network: Network;
    isActive?: boolean;
}
export interface StablecoinAgentConfig {
    alchemyApiKey: string;
    networks: Network[];
    thresholds: AnomalyThresholds;
}
export interface AnomalyThresholds {
    largeMint: number;
    largeBurn: number;
    largeTransfer: number;
    supplyChangePercent: number;
    frequencyPerHour: number;
}
export type EventType = 'mint' | 'burn' | 'transfer';
export interface StablecoinEvent {
    txHash: string;
    blockNumber: number;
    logIndex: number;
    eventType: EventType;
    from: string;
    to: string;
    amount: bigint;
    amountFormatted: string;
    timestamp: Date;
    stablecoin: StablecoinConfig;
}
export interface RawTransferEvent {
    transactionHash: string;
    blockNumber: number;
    logIndex: number;
    from: string;
    to: string;
    value: bigint;
    timestamp?: number;
}
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';
export type AnomalyType = 'large_mint' | 'large_burn' | 'large_transfer' | 'supply_change' | 'frequency_spike';
export interface AnomalyAlert {
    type: AnomalyType;
    severity: AnomalySeverity;
    title: string;
    description: string;
    event?: StablecoinEvent;
    metadata: Record<string, unknown>;
    timestamp: Date;
}
export interface SupplySnapshot {
    stablecoinId: number;
    supply: bigint;
    supplyFormatted: string;
    blockNumber: number;
    changePercent?: number;
    timestamp: Date;
}
export interface StablecoinAgentResult {
    stablecoinsChecked: number;
    eventsProcessed: number;
    anomaliesDetected: number;
    supplySnapshots: number;
    events: StablecoinEvent[];
    anomalies: AnomalyAlert[];
}
export declare const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export declare const DEFAULT_THRESHOLDS: AnomalyThresholds;
export declare const TRANSFER_EVENT_SIGNATURE = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
//# sourceMappingURL=types.d.ts.map