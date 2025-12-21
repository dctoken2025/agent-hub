import { Alchemy, Network as AlchemyNetwork } from 'alchemy-sdk';
// Mapeamento de redes para Alchemy
const NETWORK_MAP = {
    ethereum: AlchemyNetwork.ETH_MAINNET,
    polygon: AlchemyNetwork.MATIC_MAINNET,
    arbitrum: AlchemyNetwork.ARB_MAINNET,
    optimism: AlchemyNetwork.OPT_MAINNET,
    base: AlchemyNetwork.BASE_MAINNET,
};
/**
 * Cliente para interagir com a Alchemy API.
 * Busca eventos de Transfer e consulta supply de tokens ERC-20.
 */
export class AlchemyClient {
    clients = new Map();
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    /**
     * Obtém ou cria um cliente Alchemy para a rede especificada.
     */
    getClient(network) {
        if (!this.clients.has(network)) {
            const client = new Alchemy({
                apiKey: this.apiKey,
                network: NETWORK_MAP[network],
            });
            this.clients.set(network, client);
        }
        return this.clients.get(network);
    }
    /**
     * Busca o bloco atual de uma rede.
     */
    async getCurrentBlock(network) {
        const client = this.getClient(network);
        return await client.core.getBlockNumber();
    }
    /**
     * Busca eventos de Transfer de uma stablecoin em um intervalo de blocos.
     */
    async getTransferEvents(stablecoin, fromBlock, toBlock) {
        const client = this.getClient(stablecoin.network);
        console.log(`[AlchemyClient] Buscando eventos de ${stablecoin.symbol} do bloco ${fromBlock} ao ${toBlock}`);
        try {
            // Usa getLogs para buscar eventos de Transfer
            const logs = await client.core.getLogs({
                address: stablecoin.address,
                topics: [
                    // Transfer(address indexed from, address indexed to, uint256 value)
                    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
                ],
                fromBlock: `0x${fromBlock.toString(16)}`,
                toBlock: `0x${toBlock.toString(16)}`,
            });
            console.log(`[AlchemyClient] Encontrados ${logs.length} eventos de Transfer`);
            // Converte logs para RawTransferEvent
            const events = logs.map(log => {
                // Decodifica os topics (from e to são indexed)
                const from = log.topics[1] ? '0x' + log.topics[1].slice(26) : '';
                const to = log.topics[2] ? '0x' + log.topics[2].slice(26) : '';
                // Decodifica o valor do data
                const value = log.data ? BigInt(log.data) : BigInt(0);
                return {
                    transactionHash: log.transactionHash,
                    blockNumber: typeof log.blockNumber === 'string'
                        ? parseInt(log.blockNumber, 16)
                        : log.blockNumber,
                    logIndex: typeof log.logIndex === 'string'
                        ? parseInt(log.logIndex, 16)
                        : log.logIndex,
                    from: from.toLowerCase(),
                    to: to.toLowerCase(),
                    value,
                };
            });
            return events;
        }
        catch (error) {
            console.error(`[AlchemyClient] Erro ao buscar eventos:`, error);
            throw error;
        }
    }
    /**
     * Busca o supply total de uma stablecoin.
     */
    async getTotalSupply(stablecoin) {
        const client = this.getClient(stablecoin.network);
        try {
            // Chama totalSupply() no contrato
            const data = await client.core.call({
                to: stablecoin.address,
                data: '0x18160ddd', // keccak256("totalSupply()")[:4]
            });
            return BigInt(data);
        }
        catch (error) {
            console.error(`[AlchemyClient] Erro ao buscar supply de ${stablecoin.symbol}:`, error);
            throw error;
        }
    }
    /**
     * Busca o timestamp de um bloco.
     */
    async getBlockTimestamp(network, blockNumber) {
        const client = this.getClient(network);
        try {
            const block = await client.core.getBlock(blockNumber);
            if (block && block.timestamp) {
                return new Date(block.timestamp * 1000);
            }
            return new Date();
        }
        catch (error) {
            console.error(`[AlchemyClient] Erro ao buscar timestamp do bloco ${blockNumber}:`, error);
            return new Date();
        }
    }
    /**
     * Testa a conexão com a Alchemy API.
     */
    async testConnection(network = 'ethereum') {
        try {
            const client = this.getClient(network);
            const blockNumber = await client.core.getBlockNumber();
            return { success: true, blockNumber };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Erro desconhecido'
            };
        }
    }
    /**
     * Formata um valor de token para exibição.
     */
    static formatTokenAmount(amount, decimals) {
        const divisor = BigInt(10 ** decimals);
        const integerPart = amount / divisor;
        const fractionalPart = amount % divisor;
        // Formata com separadores de milhar
        const formattedInteger = integerPart.toLocaleString('en-US');
        if (fractionalPart === BigInt(0)) {
            return formattedInteger;
        }
        // Adiciona parte fracionária (máximo 2 casas)
        const fractionalStr = fractionalPart.toString().padStart(decimals, '0').slice(0, 2);
        return `${formattedInteger}.${fractionalStr}`;
    }
}
//# sourceMappingURL=alchemy-client.js.map