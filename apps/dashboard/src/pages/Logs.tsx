import { useQuery } from '@tanstack/react-query';
import { 
  Activity,
  Bot,
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  FileText,
  RefreshCw,
  Filter,
  Terminal,
  DollarSign,
  Coins
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn, apiRequest } from '@/lib/utils';

interface AgentLog {
  id: number;
  agentId: string;
  agentName: string;
  eventType: string;
  success: boolean;
  duration: number;
  processedCount: number;
  details: {
    classifications?: Record<string, number>;
    contractsDetected?: number;
    financialItemsDetected?: number;
    itemsFound?: number;
    totalAmount?: number;
  } | null;
  errorMessage: string | null;
  createdAt: string;
}

interface ActivityLog {
  id: number;
  agentId: string;
  agentName: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'debug';
  emoji: string | null;
  message: string;
  details: string | null;
  createdAt: string;
}

interface LogsResponse {
  logs: AgentLog[];
  total: number;
}

interface ActivityResponse {
  logs: ActivityLog[];
  total: number;
}

export function Logs() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [view, setView] = useState<'summary' | 'activity'>('activity');
  const activityEndRef = useRef<HTMLDivElement>(null);

  // Logs resumidos
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['logs', selectedAgent],
    queryFn: () => apiRequest<LogsResponse>(`/agents/logs${selectedAgent ? `?agentId=${selectedAgent}` : ''}`),
    refetchInterval: autoRefresh && view === 'summary' ? 5000 : false,
  });

  // Logs de atividade detalhados
  const { data: activityData, isLoading: activityLoading, refetch: refetchActivity } = useQuery({
    queryKey: ['activity-logs', selectedAgent],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedAgent) params.append('agentId', selectedAgent);
      params.append('limit', '300');
      return apiRequest<ActivityResponse>(`/agents/activity?${params.toString()}`);
    },
    refetchInterval: autoRefresh && view === 'activity' ? 2000 : false,
  });

  const logs = data?.logs || [];
  const activityLogs = activityData?.logs || [];

  // Auto-scroll para o final quando novos logs chegam
  useEffect(() => {
    if (view === 'activity' && activityEndRef.current) {
      activityEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activityLogs.length, view]);

  const getEventIcon = (eventType: string, success: boolean) => {
    if (!success) return <XCircle className="h-4 w-4 text-red-500" />;
    switch (eventType) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'started': return <Activity className="h-4 w-4 text-blue-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getAgentIcon = (agentId: string) => {
    if (agentId.includes('email')) return <Mail className="h-4 w-4" />;
    if (agentId.includes('legal')) return <FileText className="h-4 w-4" />;
    if (agentId.includes('financial')) return <DollarSign className="h-4 w-4" />;
    if (agentId.includes('stablecoin')) return <Coins className="h-4 w-4" />;
    return <Bot className="h-4 w-4" />;
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'success': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      case 'debug': return 'text-gray-500';
      default: return 'text-gray-300';
    }
  };

  const getAgentColor = (agentId: string) => {
    if (agentId.includes('email')) return 'text-blue-400';
    if (agentId.includes('legal')) return 'text-purple-400';
    if (agentId.includes('financial')) return 'text-green-400';
    if (agentId.includes('stablecoin')) return 'text-yellow-400';
    return 'text-gray-400';
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatActivityTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Logs dos Agentes
          </h2>
          <p className="text-muted-foreground">
            Acompanhe a atividade dos agentes em tempo real
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh
          </label>
          <button
            onClick={() => view === 'summary' ? refetch() : refetchActivity()}
            disabled={isLoading || activityLoading}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${(isLoading || activityLoading) ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-2 border-b pb-4">
        <button
          onClick={() => setView('activity')}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
            view === 'activity'
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          <Terminal className="h-4 w-4" />
          Console
        </button>
        <button
          onClick={() => setView('summary')}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
            view === 'summary'
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          <Activity className="h-4 w-4" />
          Resumo
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <button
          onClick={() => setSelectedAgent(null)}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm transition-colors",
            !selectedAgent
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          Todos
        </button>
        <button
          onClick={() => setSelectedAgent('email-agent')}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm transition-colors flex items-center gap-1.5",
            selectedAgent === 'email-agent'
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          <Mail className="h-3.5 w-3.5" />
          Email
        </button>
        <button
          onClick={() => setSelectedAgent('legal-agent')}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm transition-colors flex items-center gap-1.5",
            selectedAgent === 'legal-agent'
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          <FileText className="h-3.5 w-3.5" />
          Legal
        </button>
        <button
          onClick={() => setSelectedAgent('financial-agent')}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm transition-colors flex items-center gap-1.5",
            selectedAgent === 'financial-agent'
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          <DollarSign className="h-3.5 w-3.5" />
          Financeiro
        </button>
        <button
          onClick={() => setSelectedAgent('stablecoin-agent')}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm transition-colors flex items-center gap-1.5",
            selectedAgent === 'stablecoin-agent'
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          <Coins className="h-3.5 w-3.5" />
          Stablecoin
        </button>
      </div>

      {/* Live indicator */}
      {autoRefresh && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          Monitoramento ao vivo {view === 'activity' ? '(atualiza a cada 2s)' : '(atualiza a cada 5s)'}
        </div>
      )}

      {/* Activity View (Console Style) */}
      {view === 'activity' && (
        <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
            <Terminal className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-400 font-mono">Console dos Agentes</span>
            <span className="text-xs text-gray-500 ml-auto">
              {activityLogs.length} entradas
            </span>
          </div>
          <div className="p-4 font-mono text-sm min-h-[500px] max-h-[calc(100vh-300px)] overflow-y-auto">
            {activityLoading && activityLogs.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-gray-500" />
              </div>
            ) : activityLogs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhuma atividade registrada</p>
                <p className="text-xs mt-1">Os logs aparecerão quando os agentes executarem</p>
              </div>
            ) : (
              <div className="space-y-1">
                {[...activityLogs].reverse().map((log) => (
                  <div key={log.id} className="flex items-start gap-2 hover:bg-gray-800/50 px-2 py-0.5 rounded">
                    <span className="text-gray-600 shrink-0">
                      [{formatActivityTime(log.createdAt)}]
                    </span>
                    <span className={cn("shrink-0", getAgentColor(log.agentId))}>
                      [{log.agentName}]
                    </span>
                    <span className={cn("flex-1", getLevelColor(log.level))}>
                      {log.emoji && <span className="mr-1">{log.emoji}</span>}
                      {log.message}
                    </span>
                  </div>
                ))}
                <div ref={activityEndRef} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary View (Cards) */}
      {view === 'summary' && (
        <>
          {isLoading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-xl border">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum log encontrado</p>
              <p className="text-sm text-muted-foreground mt-1">
                Os logs aparecerão aqui quando os agentes executarem
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    "p-4 bg-card rounded-lg border transition-all hover:shadow-md",
                    !log.success && "border-red-200 bg-red-50 dark:bg-red-950/20"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {/* Status Icon */}
                      <div className="mt-1">
                        {getEventIcon(log.eventType, log.success)}
                      </div>

                      {/* Content */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1.5 font-medium">
                            {getAgentIcon(log.agentId)}
                            {log.agentName || log.agentId}
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-xs font-medium",
                            log.success 
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                          )}>
                            {log.eventType}
                          </span>
                        </div>

                        {/* Details */}
                        <div className="mt-1 text-sm text-muted-foreground">
                          {/* Email Agent */}
                          {log.agentId.includes('email') && (
                            <>
                              {log.processedCount > 0 ? (
                                <>
                                  <span className="mr-4">📧 {log.processedCount} emails processados</span>
                                  {log.details?.classifications && (
                                    <span className="mr-4">
                                      🚨 {log.details.classifications.urgent || 0} urgentes
                                      {' • '}
                                      📋 {log.details.classifications.low || 0} baixa
                                    </span>
                                  )}
                                  {log.details?.contractsDetected && log.details.contractsDetected > 0 && (
                                    <span className="mr-4">📜 {log.details.contractsDetected} contratos</span>
                                  )}
                                  {log.details?.financialItemsDetected && log.details.financialItemsDetected > 0 && (
                                    <span className="mr-4">💰 {log.details.financialItemsDetected} cobranças</span>
                                  )}
                                </>
                              ) : (
                                <span className="text-muted-foreground">📭 Nenhum email novo para processar</span>
                              )}
                            </>
                          )}
                          {/* Legal Agent */}
                          {log.agentId.includes('legal') && (
                            <>
                              {log.processedCount > 0 ? (
                                <span className="mr-4">📋 {log.processedCount} documento(s) analisado(s)</span>
                              ) : (
                                <span className="text-muted-foreground">📭 Nenhum documento para analisar</span>
                              )}
                            </>
                          )}
                          {/* Financial Agent */}
                          {log.agentId.includes('financial') && (
                            <>
                              {log.processedCount > 0 || (log.details?.itemsFound && log.details.itemsFound > 0) ? (
                                <span className="mr-4">
                                  💵 {log.details?.itemsFound || log.processedCount} cobrança(s)
                                  {log.details?.totalAmount && ` (R$ ${(log.details.totalAmount / 100).toFixed(2)})`}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">📭 Nenhuma cobrança identificada neste email</span>
                              )}
                            </>
                          )}
                          {/* Stablecoin Agent */}
                          {log.agentId.includes('stablecoin') && (
                            <>
                              {log.processedCount > 0 ? (
                                <span className="mr-4">🪙 {log.processedCount} evento(s) detectado(s)</span>
                              ) : (
                                <span className="text-muted-foreground">📊 Nenhuma atividade significativa</span>
                              )}
                            </>
                          )}
                        </div>

                        {/* Error message */}
                        {log.errorMessage && (
                          <p className="mt-1 text-sm text-red-600">
                            ❌ {log.errorMessage}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Time and Duration */}
                    <div className="text-right text-sm">
                      <p className="text-muted-foreground">
                        {formatTime(log.createdAt)}
                      </p>
                      {log.duration > 0 && (
                        <p className="text-xs text-muted-foreground">
                          ⏱️ {formatDuration(log.duration)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
