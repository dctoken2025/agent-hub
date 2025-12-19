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
  Filter
} from 'lucide-react';
import { useState } from 'react';
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
  } | null;
  errorMessage: string | null;
  createdAt: string;
}

interface LogsResponse {
  logs: AgentLog[];
  total: number;
}

export function Logs() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['logs', selectedAgent],
    queryFn: () => apiRequest<LogsResponse>(`/agents/logs${selectedAgent ? `?agentId=${selectedAgent}` : ''}`),
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const logs = data?.logs || [];

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
    if (agentId === 'email-agent') return <Mail className="h-4 w-4" />;
    if (agentId === 'legal-agent') return <FileText className="h-4 w-4" />;
    return <Bot className="h-4 w-4" />;
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
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
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
          Email Agent
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
          Legal Agent
        </button>
      </div>

      {/* Live indicator */}
      {autoRefresh && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          Monitoramento ao vivo
        </div>
      )}

      {/* Logs List */}
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
                      {log.processedCount > 0 && (
                        <span className="mr-4">
                          📧 {log.processedCount} emails processados
                        </span>
                      )}
                      {log.details?.classifications && (
                        <span className="mr-4">
                          🚨 {log.details.classifications.urgent || 0} urgentes
                          {' • '}
                          📋 {log.details.classifications.low || 0} baixa
                        </span>
                      )}
                      {log.details?.contractsDetected && log.details.contractsDetected > 0 && (
                        <span className="mr-4">
                          📜 {log.details.contractsDetected} contratos
                        </span>
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
    </div>
  );
}
