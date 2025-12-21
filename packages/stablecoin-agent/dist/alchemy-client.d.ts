import type { Network, StablecoinConfig, RawTransferEvent } from './types.js';
export interface AlchemyClientConfig {
    apiKey: string;
    network: Network;
}
/**
 * Cliente para interagir com a Alchemy API.
 * Busca eventos de Transfer e consulta supply de tokens ERC-20.
 */
export declare class AlchemyClient {
    private clients;
    private apiKey;
    constructor(apiKey: string);
    /**
     * Obtém ou cria um cliente Alchemy para a rede especificada.
     */
    private getClient;
    /**
     * Busca o bloco atual de uma rede.
     */
    getCurrentBlock(network: Network): Promise<number>;
    /**
     * Busca eventos de Transfer de uma stablecoin em um intervalo de blocos.
     */
    getTransferEvents(stablecoin: StablecoinConfig, fromBlock: number, toBlock: number): Promise<RawTransferEvent[]>;
    /**
     * Busca o supply total de uma stablecoin.
     */
    getTotalSupply(stablecoin: StablecoinConfig): Promise<bigint>;
    /**
     * Busca o timestamp de um bloco.
     */
    getBlockTimestamp(network: Network, blockNumber: number): Promise<Date>;
    /**
     * Testa a conexão com a Alchemy API.
     */
    testConnection(network?: Network): Promise<{
        success: boolean;
        blockNumber?: number;
        error?: string;
    }>;
    /**
     * Formata um valor de token para exibição.
     */
    static formatTokenAmount(amount: bigint, decimals: number): string;
}
//# sourceMappingURL=alchemy-client.d.ts.map