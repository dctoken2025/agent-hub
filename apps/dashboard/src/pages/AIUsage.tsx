import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { 
  Brain, 
  DollarSign, 
  Zap, 
  Clock, 
  Users, 
  Settings,
  Check,
  AlertCircle,
  Loader2,
  Save,
  TestTube,
  ExternalLink,
  TrendingUp,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { apiRequest } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface AIUsageStats {
  period: { days: number; since: string };
  stats: {
    totalCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalCost: number;
    costFormatted: string;
    avgDuration: number;
    successRate: number;
  };
  byProvider: Array<{
    provider: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    costFormatted: string;
    percentage: number;
  }>;
  byUser: Array<{
    userId: string;
    userEmail: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    costFormatted: string;
    percentage: number;
  }>;
  byAgent: Array<{
    agentId: string;
    agentName: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    costFormatted: string;
    percentage: number;
  }>;
  byDay: Array<{
    date: string;
    calls: number;
    cost: number;
  }>;
}

interface AIConfig {
  provider: string;
  anthropic: {
    apiKey: string;
    adminApiKey: string;
    model: string;
    isConfigured: boolean;
    hasAdminKey: boolean;
  };
  openai: {
    apiKey: string;
    adminApiKey: string;
    model: string;
    isConfigured: boolean;
    hasAdminKey: boolean;
  };
  fallbackEnabled: boolean;
  availableModels: {
    anthropic: Array<{ id: string; name: string; default?: boolean }>;
    openai: Array<{ id: string; name: string; default?: boolean }>;
  };
}

// Resposta da Admin API da Anthropic
interface AnthropicCostReport {
  data?: {
    costs?: Array<{
      model?: string;
      cost_usd?: number;
      input_tokens?: number;
      output_tokens?: number;
    }>;
    total_cost_usd?: number;
  };
  error?: string;
  period?: { start: string; end: string };
}

// Resposta da Admin API da OpenAI
interface OpenAICostReport {
  costs?: {
    data?: Array<{
      results?: Array<{
        amount?: { value?: number };
      }>;
    }>;
  };
  usage?: {
    data?: Array<{
      results?: Array<{
        input_tokens?: number;
        output_tokens?: number;
      }>;
    }>;
  };
  error?: string;
  period?: { start: string; end: string };
}

export function AIUsage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'stats' | 'config'>('stats');
  
  // Form states
  const [provider, setProvider] = useState<string>('');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [anthropicAdminApiKey, setAnthropicAdminApiKey] = useState('');
  const [anthropicModel, setAnthropicModel] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiAdminApiKey, setOpenaiAdminApiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('');
  const [fallbackEnabled, setFallbackEnabled] = useState(true);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Stats query
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['ai-usage-stats'],
    queryFn: () => apiRequest<AIUsageStats>('/ai-usage/stats?days=7'),
    enabled: view === 'stats',
  });

  // Custos reais da Anthropic (Admin API)
  const { data: anthropicCosts, isLoading: anthropicLoading, refetch: refetchAnthropic } = useQuery({
    queryKey: ['anthropic-costs'],
    queryFn: () => apiRequest<AnthropicCostReport>('/ai-usage/anthropic'),
    enabled: view === 'stats',
  });

  // Custos reais da OpenAI (Admin API)
  const { data: openaiCosts, isLoading: openaiLoading, refetch: refetchOpenai } = useQuery({
    queryKey: ['openai-costs'],
    queryFn: () => apiRequest<OpenAICostReport>('/ai-usage/openai'),
    enabled: view === 'stats',
  });

  // Config query
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['ai-usage-config'],
    queryFn: async () => {
      const result = await apiRequest<AIConfig>('/ai-usage/config');
      setProvider(result.provider);
      setAnthropicModel(result.anthropic.model);
      setOpenaiModel(result.openai.model);
      setFallbackEnabled(result.fallbackEnabled);
      return result;
    },
    enabled: view === 'config',
  });

  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => 
      apiRequest('/ai-usage/config', { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-usage-config'] });
      setAnthropicApiKey('');
      setAnthropicAdminApiKey('');
      setOpenaiApiKey('');
      setOpenaiAdminApiKey('');
    },
  });

  // Test provider mutation
  const testProviderMutation = useMutation({
    mutationFn: async (providerName: string) => {
      const result = await apiRequest<{ success: boolean; message?: string; error?: string }>(
        `/ai-usage/test/${providerName}`, 
        { method: 'POST' }
      );
      return result;
    },
    onSuccess: (result) => {
      setTestResult({ 
        success: result.success, 
        message: result.success ? (result.message || 'Conexão OK!') : (result.error || 'Erro') 
      });
    },
    onError: (error) => {
      setTestResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    },
  });

  const formatNumber = (num: number) => num.toLocaleString('pt-BR');

  const getProviderColor = (provider: string) => {
    if (provider === 'anthropic') return 'text-purple-600 bg-purple-100';
    if (provider === 'openai') return 'text-green-600 bg-green-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getAgentColor = (agentName: string) => {
    if (agentName.includes('Email')) return 'text-blue-600';
    if (agentName.includes('Legal')) return 'text-amber-600';
    if (agentName.includes('Financial')) return 'text-green-600';
    if (agentName.includes('Stablecoin')) return 'text-purple-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" />
            Uso da API de IA
          </h1>
          <p className="text-muted-foreground">
            Monitore o consumo e configure os providers de IA
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setView('stats')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
              view === 'stats' 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted hover:bg-muted/80"
            )}
          >
            <BarChart3 className="h-4 w-4" />
            Estatísticas
          </button>
          <button
            onClick={() => setView('config')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
              view === 'config' 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted hover:bg-muted/80"
            )}
          >
            <Settings className="h-4 w-4" />
            Configuração
          </button>
        </div>
      </div>

      {/* Stats View */}
      {view === 'stats' && (
        <div className="space-y-6">
          {/* Period Info */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Últimos 7 dias
            </p>
            <button
              onClick={() => refetchStats()}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-lg"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
          </div>

          {statsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : stats?.stats ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-sm">Custo Estimado</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.stats.costFormatted}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatNumber(stats.stats.totalTokens)} tokens
                  </p>
                </div>

                <div className="bg-card rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Zap className="h-4 w-4" />
                    <span className="text-sm">Chamadas</span>
                  </div>
                  <p className="text-2xl font-bold">{formatNumber(stats.stats.totalCalls)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.stats.successRate}% sucesso
                  </p>
                </div>

                <div className="bg-card rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">Tokens</span>
                  </div>
                  <p className="text-2xl font-bold">{formatNumber(stats.stats.totalInputTokens)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Input • {formatNumber(stats.stats.totalOutputTokens)} output
                  </p>
                </div>

                <div className="bg-card rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">Tempo Médio</span>
                  </div>
                  <p className="text-2xl font-bold">{(stats.stats.avgDuration / 1000).toFixed(1)}s</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    por requisição
                  </p>
                </div>
              </div>

              {/* By Provider */}
              {stats.byProvider.length > 0 && (
                <div className="bg-card rounded-lg border p-4">
                  <h3 className="font-semibold mb-4">Por Provider</h3>
                  <div className="space-y-3">
                    {stats.byProvider.map((p) => (
                      <div key={p.provider} className="flex items-center gap-4">
                        <span className={cn(
                          "px-2 py-1 rounded text-xs font-medium",
                          getProviderColor(p.provider)
                        )}>
                          {p.provider === 'anthropic' ? '🟣 Anthropic' : '🟢 OpenAI'}
                        </span>
                        <div className="flex-1">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full",
                                p.provider === 'anthropic' ? 'bg-purple-500' : 'bg-green-500'
                              )}
                              style={{ width: `${p.percentage}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-medium w-16 text-right">{p.percentage}%</span>
                        <span className="text-sm text-muted-foreground w-20 text-right">{p.costFormatted}</span>
                        <span className="text-sm text-muted-foreground w-24 text-right">{p.calls} calls</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* By User */}
              {stats.byUser.length > 0 && (
                <div className="bg-card rounded-lg border p-4">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Por Usuário
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium">Usuário</th>
                          <th className="text-right py-2 font-medium">Chamadas</th>
                          <th className="text-right py-2 font-medium">Input</th>
                          <th className="text-right py-2 font-medium">Output</th>
                          <th className="text-right py-2 font-medium">Custo</th>
                          <th className="text-right py-2 font-medium">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.byUser.map((u) => (
                          <tr key={u.userId} className="border-b last:border-0">
                            <td className="py-2">{u.userEmail || 'Sistema'}</td>
                            <td className="text-right py-2">{formatNumber(u.calls)}</td>
                            <td className="text-right py-2">{formatNumber(u.inputTokens)}</td>
                            <td className="text-right py-2">{formatNumber(u.outputTokens)}</td>
                            <td className="text-right py-2 font-medium">{u.costFormatted}</td>
                            <td className="text-right py-2 text-muted-foreground">{u.percentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* By Agent */}
              {stats.byAgent.length > 0 && (
                <div className="bg-card rounded-lg border p-4">
                  <h3 className="font-semibold mb-4">Por Agente</h3>
                  <div className="space-y-3">
                    {stats.byAgent.map((a) => (
                      <div key={a.agentId} className="flex items-center gap-4">
                        <span className={cn("font-medium w-40", getAgentColor(a.agentName))}>
                          {a.agentName}
                        </span>
                        <div className="flex-1">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${a.percentage}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-medium w-16 text-right">{a.percentage}%</span>
                        <span className="text-sm text-muted-foreground w-20 text-right">{a.costFormatted}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Custos Reais dos Providers */}
              <div className="bg-card rounded-lg border p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    Custos Reais dos Providers
                  </h3>
                  <button
                    onClick={() => {
                      refetchAnthropic();
                      refetchOpenai();
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Atualizar
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Anthropic */}
                  <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xl">🟣</span>
                      <span className="font-semibold">Anthropic</span>
                      {anthropicLoading && <Loader2 className="h-4 w-4 animate-spin text-purple-500" />}
                    </div>
                    
                    {anthropicCosts?.error ? (
                      <div className="text-sm text-amber-600 dark:text-amber-400 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>{anthropicCosts.error}</span>
                      </div>
                    ) : anthropicCosts?.data ? (
                      <div className="space-y-2">
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          ${(anthropicCosts.data.total_cost_usd || 0).toFixed(4)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Últimos 7 dias (via Admin API)
                        </p>
                        {anthropicCosts.data.costs && anthropicCosts.data.costs.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-800">
                            <p className="text-xs font-medium mb-2">Por modelo:</p>
                            {anthropicCosts.data.costs.map((c, i) => (
                              <div key={i} className="flex justify-between text-xs">
                                <span className="text-muted-foreground">{c.model}</span>
                                <span className="font-medium">${(c.cost_usd || 0).toFixed(4)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : !anthropicLoading && (
                      <p className="text-sm text-muted-foreground">
                        Configure a Admin API Key para ver custos reais
                      </p>
                    )}
                  </div>

                  {/* OpenAI */}
                  <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xl">🟢</span>
                      <span className="font-semibold">OpenAI</span>
                      {openaiLoading && <Loader2 className="h-4 w-4 animate-spin text-green-500" />}
                    </div>
                    
                    {openaiCosts?.error ? (
                      <div className="text-sm text-amber-600 dark:text-amber-400 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>{openaiCosts.error}</span>
                      </div>
                    ) : openaiCosts?.costs ? (
                      <div className="space-y-2">
                        {(() => {
                          try {
                            // Calcula custo total - estrutura pode variar
                            let totalCost = 0;
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const costsData = openaiCosts.costs as any;
                            
                            if (costsData?.data && Array.isArray(costsData.data)) {
                              totalCost = costsData.data.reduce((acc: number, bucket: { results?: Array<{ amount?: { value?: number } }> }) => {
                                if (bucket.results && Array.isArray(bucket.results)) {
                                  const bucketTotal = bucket.results.reduce((sum: number, r) => sum + (r.amount?.value || 0), 0);
                                  return acc + bucketTotal;
                                }
                                return acc;
                              }, 0);
                            } else if (typeof costsData?.total_cost === 'number') {
                              totalCost = costsData.total_cost;
                            }
                            
                            return (
                              <>
                                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                  ${totalCost.toFixed(4)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Últimos 7 dias (via Admin API)
                                </p>
                              </>
                            );
                          } catch (e) {
                            console.error('Erro ao processar custos OpenAI:', e);
                            return (
                              <div className="text-sm text-amber-600">
                                Erro ao processar dados
                              </div>
                            );
                          }
                        })()}
                      </div>
                    ) : !openaiLoading && (
                      <p className="text-sm text-muted-foreground">
                        Configure a Admin API Key para ver custos reais
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-4 text-center">
                  💡 Os custos acima são obtidos diretamente das APIs oficiais dos providers
                </p>
              </div>
            </>
          ) : (
            <div className="bg-card rounded-lg border p-8 text-center">
              <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">Nenhum dado de uso</h3>
              <p className="text-muted-foreground">
                Os dados de uso aparecerão aqui após os agentes começarem a processar.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Config View */}
      {view === 'config' && (
        <div className="space-y-6">
          {configLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Provider Selection */}
              <div className="bg-card rounded-lg border p-4">
                <h3 className="font-semibold mb-4">Provider Ativo</h3>
                <div className="flex gap-4">
                  <button
                    onClick={() => setProvider('anthropic')}
                    className={cn(
                      "flex-1 p-4 rounded-lg border-2 transition-colors",
                      provider === 'anthropic' 
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-950" 
                        : "border-muted hover:border-purple-300"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">🟣</span>
                      <span className="font-semibold">Anthropic</span>
                      {provider === 'anthropic' && (
                        <Check className="h-4 w-4 text-purple-500 ml-auto" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">Claude Sonnet 4, Haiku</p>
                    {config?.anthropic.isConfigured && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 mt-2">
                        <Check className="h-3 w-3" /> Configurado
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setProvider('openai')}
                    className={cn(
                      "flex-1 p-4 rounded-lg border-2 transition-colors",
                      provider === 'openai' 
                        ? "border-green-500 bg-green-50 dark:bg-green-950" 
                        : "border-muted hover:border-green-300"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">🟢</span>
                      <span className="font-semibold">OpenAI</span>
                      {provider === 'openai' && (
                        <Check className="h-4 w-4 text-green-500 ml-auto" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">GPT-4o, GPT-4o Mini</p>
                    {config?.openai.isConfigured && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 mt-2">
                        <Check className="h-3 w-3" /> Configurado
                      </span>
                    )}
                  </button>
                </div>

                {/* Fallback Toggle */}
                <div className="mt-4 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="fallback"
                    checked={fallbackEnabled}
                    onChange={(e) => setFallbackEnabled(e.target.checked)}
                    className="h-4 w-4 rounded"
                  />
                  <label htmlFor="fallback" className="text-sm">
                    Habilitar fallback automático (se o provider principal falhar, tenta o secundário)
                  </label>
                </div>
              </div>

              {/* Anthropic Config */}
              <div className="bg-card rounded-lg border p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <span className="text-lg">🟣</span>
                  Anthropic (Claude)
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">API Key</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={anthropicApiKey}
                        onChange={(e) => setAnthropicApiKey(e.target.value)}
                        placeholder={config?.anthropic.apiKey || 'sk-ant-...'}
                        className="flex-1 px-3 py-2 border rounded-lg bg-background"
                      />
                      <button
                        onClick={() => testProviderMutation.mutate('anthropic')}
                        disabled={testProviderMutation.isPending}
                        className="px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg flex items-center gap-2"
                      >
                        {testProviderMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <TestTube className="h-4 w-4" />
                        )}
                        Testar
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Admin API Key 
                      <span className="text-muted-foreground font-normal ml-1">(opcional, para consultar gastos)</span>
                    </label>
                    <input
                      type="password"
                      value={anthropicAdminApiKey}
                      onChange={(e) => setAnthropicAdminApiKey(e.target.value)}
                      placeholder={config?.anthropic.adminApiKey || 'admin-key-...'}
                      className="w-full px-3 py-2 border rounded-lg bg-background"
                    />
                    <a 
                      href="https://console.anthropic.com/settings/admin-keys" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                    >
                      Gerar Admin API Key <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Modelo</label>
                    <select
                      value={anthropicModel}
                      onChange={(e) => setAnthropicModel(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-background"
                    >
                      {config?.availableModels.anthropic.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* OpenAI Config */}
              <div className="bg-card rounded-lg border p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <span className="text-lg">🟢</span>
                  OpenAI (GPT)
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">API Key</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={openaiApiKey}
                        onChange={(e) => setOpenaiApiKey(e.target.value)}
                        placeholder={config?.openai.apiKey || 'sk-...'}
                        className="flex-1 px-3 py-2 border rounded-lg bg-background"
                      />
                      <button
                        onClick={() => testProviderMutation.mutate('openai')}
                        disabled={testProviderMutation.isPending}
                        className="px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg flex items-center gap-2"
                      >
                        {testProviderMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <TestTube className="h-4 w-4" />
                        )}
                        Testar
                      </button>
                    </div>
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                    >
                      Gerar API Key <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Admin API Key 
                      <span className="text-muted-foreground font-normal ml-1">(opcional, para consultar gastos)</span>
                    </label>
                    <input
                      type="password"
                      value={openaiAdminApiKey}
                      onChange={(e) => setOpenaiAdminApiKey(e.target.value)}
                      placeholder={config?.openai.adminApiKey || 'sk-admin-...'}
                      className="w-full px-3 py-2 border rounded-lg bg-background"
                    />
                    <a 
                      href="https://platform.openai.com/settings/organization/admin-keys" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                    >
                      Gerar Admin API Key <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Modelo</label>
                    <select
                      value={openaiModel}
                      onChange={(e) => setOpenaiModel(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-background"
                    >
                      {config?.availableModels.openai.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Test Result */}
              {testResult && (
                <div className={cn(
                  "p-4 rounded-lg border flex items-center gap-2",
                  testResult.success 
                    ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200" 
                    : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200"
                )}>
                  {testResult.success ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <AlertCircle className="h-5 w-5" />
                  )}
                  {testResult.message}
                </div>
              )}

              {/* Save Button */}
              <button
                onClick={() => {
                  const data: Record<string, unknown> = { provider, fallbackEnabled };
                  if (anthropicApiKey) data.anthropicApiKey = anthropicApiKey;
                  if (anthropicAdminApiKey) data.anthropicAdminApiKey = anthropicAdminApiKey;
                  if (anthropicModel) data.anthropicModel = anthropicModel;
                  if (openaiApiKey) data.openaiApiKey = openaiApiKey;
                  if (openaiAdminApiKey) data.openaiAdminApiKey = openaiAdminApiKey;
                  if (openaiModel) data.openaiModel = openaiModel;
                  saveConfigMutation.mutate(data);
                }}
                disabled={saveConfigMutation.isPending}
                className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50"
              >
                {saveConfigMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Save className="h-5 w-5" />
                )}
                Salvar Configurações
              </button>

              {saveConfigMutation.isSuccess && (
                <div className="p-4 rounded-lg border bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200 flex items-center gap-2">
                  <Check className="h-5 w-5" />
                  Configurações salvas com sucesso!
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

