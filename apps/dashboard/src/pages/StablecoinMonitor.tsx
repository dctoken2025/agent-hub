import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { 
  Coins, 
  AlertTriangle, 
  TrendingUp,
  Clock,
  Plus,
  Trash2,
  CheckCircle,
  Loader2,
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowRightCircle,
  ExternalLink,
} from 'lucide-react';
import { apiRequest } from '@/lib/utils';

interface Stablecoin {
  id: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  network: string;
  isActive: boolean;
  lastSupply: string | null;
  lastCheckedAt: string | null;
}

interface StablecoinEvent {
  id: number;
  stablecoinId: number;
  txHash: string;
  blockNumber: number;
  eventType: 'mint' | 'burn' | 'transfer';
  fromAddress: string;
  toAddress: string;
  amount: string;
  amountFormatted: string;
  isAnomaly: boolean;
  timestamp: string;
  stablecoin?: Stablecoin;
}

interface StablecoinAnomaly {
  id: number;
  stablecoinId: number;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  isAcknowledged: boolean;
  createdAt: string;
  stablecoin?: Stablecoin;
}

interface StablecoinStats {
  stablecoinsMonitored: number;
  events24h: number;
  pendingAnomalies: number;
  lastCheck: string | null;
}

export function StablecoinMonitor() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [newStablecoin, setNewStablecoin] = useState({
    address: '',
    name: '',
    symbol: '',
    decimals: 6,
    network: 'ethereum',
  });

  // Queries
  const { data: statsData } = useQuery({
    queryKey: ['stablecoinStats'],
    queryFn: () => apiRequest<StablecoinStats>('/stablecoins/stats'),
    refetchInterval: 30000,
  });

  const { data: stablecoinsData } = useQuery({
    queryKey: ['stablecoins'],
    queryFn: () => apiRequest<{ stablecoins: Stablecoin[] }>('/stablecoins'),
    refetchInterval: 60000,
  });

  const { data: eventsData } = useQuery({
    queryKey: ['stablecoinEvents'],
    queryFn: () => apiRequest<{ events: StablecoinEvent[] }>('/stablecoins/events?limit=20'),
    refetchInterval: 30000,
  });

  const { data: anomaliesData } = useQuery({
    queryKey: ['stablecoinAnomalies'],
    queryFn: () => apiRequest<{ anomalies: StablecoinAnomaly[] }>('/stablecoins/anomalies?acknowledged=false&limit=10'),
    refetchInterval: 30000,
  });

  // Mutations
  const addMutation = useMutation({
    mutationFn: async (data: typeof newStablecoin) => {
      const response = await apiRequest<{ success?: boolean; error?: string; stablecoin?: Stablecoin }>('/stablecoins', { 
        method: 'POST', 
        body: JSON.stringify(data) 
      });
      if (response.error) {
        throw new Error(response.error);
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stablecoins'] });
      queryClient.invalidateQueries({ queryKey: ['stablecoinStats'] });
      setShowAddForm(false);
      setAddError(null);
      setNewStablecoin({ address: '', name: '', symbol: '', decimals: 6, network: 'ethereum' });
    },
    onError: (error: Error) => {
      setAddError(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/stablecoins/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stablecoins'] });
      queryClient.invalidateQueries({ queryKey: ['stablecoinStats'] });
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/stablecoins/anomalies/${id}/acknowledge`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stablecoinAnomalies'] });
      queryClient.invalidateQueries({ queryKey: ['stablecoinStats'] });
    },
  });

  const stats = statsData || { stablecoinsMonitored: 0, events24h: 0, pendingAnomalies: 0, lastCheck: null };
  const stablecoinsList = stablecoinsData?.stablecoins || [];
  const events = eventsData?.events || [];
  const anomalies = anomaliesData?.anomalies || [];

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `há ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `há ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `há ${diffDays}d`;
  };

  const truncateAddress = (address: string) => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getExplorerUrl = (network: string, txHash: string) => {
    const explorers: Record<string, string> = {
      ethereum: 'https://etherscan.io/tx/',
      polygon: 'https://polygonscan.com/tx/',
      arbitrum: 'https://arbiscan.io/tx/',
      optimism: 'https://optimistic.etherscan.io/tx/',
      base: 'https://basescan.org/tx/',
    };
    return `${explorers[network] || explorers.ethereum}${txHash}`;
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'mint': return <ArrowUpCircle className="h-4 w-4 text-green-500" />;
      case 'burn': return <ArrowDownCircle className="h-4 w-4 text-red-500" />;
      default: return <ArrowRightCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-800';
      case 'high': return 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-800';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-800';
      default: return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return <span className="px-2 py-0.5 text-xs font-medium bg-red-500 text-white rounded">CRITICAL</span>;
      case 'high': return <span className="px-2 py-0.5 text-xs font-medium bg-orange-500 text-white rounded">HIGH</span>;
      case 'medium': return <span className="px-2 py-0.5 text-xs font-medium bg-yellow-500 text-white rounded">MEDIUM</span>;
      default: return <span className="px-2 py-0.5 text-xs font-medium bg-gray-500 text-white rounded">LOW</span>;
    }
  };

  const formatSupply = (supply: string | null, decimals: number = 18) => {
    if (!supply) return '-';
    try {
      const num = BigInt(supply);
      // Converte para número com decimais
      const divisor = BigInt(10 ** decimals);
      const integerPart = num / divisor;
      const value = Number(integerPart) + Number(num % divisor) / Number(divisor);
      
      // Formata de acordo com a magnitude
      if (value >= 1_000_000_000) {
        return `R$ ${(value / 1_000_000_000).toFixed(2)}B`;
      } else if (value >= 1_000_000) {
        return `R$ ${(value / 1_000_000).toFixed(2)}M`;
      } else if (value >= 1_000) {
        return `R$ ${(value / 1_000).toFixed(2)}K`;
      } else {
        return `R$ ${value.toFixed(2)}`;
      }
    } catch {
      return '-';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="p-6 bg-card rounded-xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-500/10">
              <Coins className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Stablecoins Monitoradas</p>
              <p className="text-2xl font-bold">{stats.stablecoinsMonitored}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-card rounded-xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-500/10">
              <TrendingUp className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Eventos (24h)</p>
              <p className="text-2xl font-bold">{stats.events24h}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-card rounded-xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-orange-500/10">
              <AlertTriangle className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Anomalias Pendentes</p>
              <p className="text-2xl font-bold">{stats.pendingAnomalies}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-card rounded-xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-500/10">
              <Clock className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Última Verificação</p>
              <p className="text-2xl font-bold">{formatTimeAgo(stats.lastCheck)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stablecoins List */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Stablecoins Monitoradas
          </h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
        </div>

        {showAddForm && (
          <div className="p-6 border-b bg-secondary/30">
            <div className="grid gap-4 md:grid-cols-6">
              <input
                type="text"
                placeholder="Endereço do contrato"
                value={newStablecoin.address}
                onChange={(e) => setNewStablecoin({ ...newStablecoin, address: e.target.value })}
                className="col-span-2 px-3 py-2 rounded-lg border bg-background"
              />
              <input
                type="text"
                placeholder="Nome"
                value={newStablecoin.name}
                onChange={(e) => setNewStablecoin({ ...newStablecoin, name: e.target.value })}
                className="px-3 py-2 rounded-lg border bg-background"
              />
              <input
                type="text"
                placeholder="Símbolo"
                value={newStablecoin.symbol}
                onChange={(e) => setNewStablecoin({ ...newStablecoin, symbol: e.target.value })}
                className="px-3 py-2 rounded-lg border bg-background"
              />
              <select
                value={newStablecoin.network}
                onChange={(e) => setNewStablecoin({ ...newStablecoin, network: e.target.value })}
                className="px-3 py-2 rounded-lg border bg-background"
              >
                <option value="ethereum">Ethereum</option>
                <option value="polygon">Polygon</option>
                <option value="arbitrum">Arbitrum</option>
                <option value="optimism">Optimism</option>
                <option value="base">Base</option>
              </select>
              <button
                onClick={() => addMutation.mutate(newStablecoin)}
                disabled={addMutation.isPending || !newStablecoin.address || !newStablecoin.name || !newStablecoin.symbol}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Salvar'}
              </button>
            </div>
            {addError && (
              <p className="mt-2 text-sm text-red-500">{addError}</p>
            )}
          </div>
        )}

        <div className="p-6">
          {stablecoinsList.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma stablecoin configurada. Clique em "Adicionar" para começar.
            </p>
          ) : (
            <div className="space-y-3">
              {stablecoinsList.map((stablecoin) => (
                <div
                  key={stablecoin.id}
                  className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="font-bold text-sm">{stablecoin.symbol}</span>
                    </div>
                    <div>
                      <p className="font-medium">{stablecoin.name} ({stablecoin.symbol})</p>
                      <p className="text-sm text-muted-foreground">
                        {truncateAddress(stablecoin.address)} · {stablecoin.network}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-medium">{formatSupply(stablecoin.lastSupply, stablecoin.decimals)}</p>
                      <p className="text-xs text-muted-foreground">
                        Atualizado {formatTimeAgo(stablecoin.lastCheckedAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteMutation.mutate(stablecoin.id)}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Events and Anomalies Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Events */}
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Eventos Recentes
            </h2>
          </div>
          <div className="p-6">
            {events.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum evento detectado ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      event.isAnomaly ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-secondary/50'
                    }`}
                  >
                    {getEventIcon(event.eventType)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium uppercase text-sm">{event.eventType}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-sm">{event.stablecoin?.symbol || 'N/A'}</span>
                        {event.isAnomaly && (
                          <span className="px-1.5 py-0.5 text-xs bg-orange-500 text-white rounded">ANOMALIA</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                        {event.amountFormatted} · 
                        <a
                          href={getExplorerUrl(event.stablecoin?.network || 'ethereum', event.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {truncateAddress(event.txHash)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      {formatTimeAgo(event.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Anomalies */}
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Anomalias Detectadas
            </h2>
          </div>
          <div className="p-6">
            {anomalies.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                <p className="text-muted-foreground">
                  Nenhuma anomalia pendente
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {anomalies.map((anomaly) => (
                  <div
                    key={anomaly.id}
                    className={`p-4 rounded-lg border ${getSeverityColor(anomaly.severity)}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getSeverityBadge(anomaly.severity)}
                          <span className="font-medium">{anomaly.title}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{anomaly.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTimeAgo(anomaly.createdAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => acknowledgeMutation.mutate(anomaly.id)}
                        className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                      >
                        Reconhecer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

