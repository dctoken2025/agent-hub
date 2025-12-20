import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Bot, 
  Play, 
  Pause, 
  RotateCcw,
  Activity,
  Lock,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { cn, apiRequest } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface AgentInfo {
  config: {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    schedule?: {
      type: string;
      value: number | string;
    };
  };
  status: string;
  runCount: number;
  lastRun?: string;
}

export function Agents() {
  const queryClient = useQueryClient();
  const { isAccountActive, user, isTrialExpired, trialDaysRemaining, isAdmin } = useAuth();
  
  const { data, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => apiRequest<{ agents: AgentInfo[] }>('/agents'),
    refetchInterval: 5000,
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/agents/${id}/start`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });

  const stopMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/agents/${id}/stop`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });

  const runOnceMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/agents/${id}/run`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });

  const agents = data?.agents || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'running': return 'Rodando';
      case 'paused': return 'Pausado';
      case 'error': return 'Erro';
      case 'idle': return 'Parado';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner de dias restantes do trial */}
      {!isAdmin && trialDaysRemaining !== null && trialDaysRemaining > 0 && trialDaysRemaining <= 7 && (
        <div className={cn(
          "p-4 rounded-xl border",
          trialDaysRemaining <= 2 
            ? "bg-orange-500/10 border-orange-500/20" 
            : "bg-blue-500/10 border-blue-500/20"
        )}>
          <div className="flex items-center gap-3">
            <Clock className={cn(
              "w-5 h-5 flex-shrink-0",
              trialDaysRemaining <= 2 ? "text-orange-500" : "text-blue-500"
            )} />
            <div>
              <p className={cn(
                "font-medium",
                trialDaysRemaining <= 2 ? "text-orange-600 dark:text-orange-400" : "text-blue-600 dark:text-blue-400"
              )}>
                {trialDaysRemaining === 1 
                  ? 'Último dia do período de teste!' 
                  : `${trialDaysRemaining} dias restantes do período de teste`
                }
              </p>
              <p className="text-sm text-muted-foreground">
                Entre em contato para continuar usando os agentes após o período de teste.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Aviso de trial expirado */}
      {isTrialExpired && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-600 dark:text-red-400">
                Período de teste encerrado
              </p>
              <p className="text-sm text-muted-foreground">
                Seu período de teste de 7 dias expirou. Entre em contato para continuar usando os agentes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Aviso de conta pendente/suspensa (não trial) */}
      {!isAccountActive && !isTrialExpired && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-yellow-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-yellow-600 dark:text-yellow-400">
                Agentes bloqueados
              </p>
              <p className="text-sm text-muted-foreground">
                {user?.accountStatus === 'pending' 
                  ? 'Sua conta está aguardando aprovação do administrador para ativar os agentes.'
                  : 'Sua conta está suspensa. Entre em contato com o administrador.'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Agentes</h2>
          <p className="text-muted-foreground">
            Gerencie seus agentes autônomos
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => apiRequest('/agents/start-all', { method: 'POST' })}
            disabled={!isAccountActive || isTrialExpired}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
              isAccountActive && !isTrialExpired
                ? "bg-green-600 text-white hover:bg-green-700" 
                : "bg-gray-400 text-gray-200 cursor-not-allowed"
            )}
          >
            <Play className="h-4 w-4" />
            Iniciar Todos
          </button>
          <button
            onClick={() => apiRequest('/agents/stop-all', { method: 'POST' })}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
          >
            <Pause className="h-4 w-4" />
            Parar Todos
          </button>
        </div>
      </div>

      {/* Agent List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Activity className="h-8 w-8 animate-pulse text-muted-foreground" />
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border">
          <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Nenhum agente configurado</p>
          <p className="text-muted-foreground mt-1">
            Configure as variáveis de ambiente para habilitar os agentes
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {agents.map((agent) => (
            <div 
              key={agent.config.id}
              className="p-6 bg-card rounded-xl border shadow-sm"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{agent.config.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {agent.config.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "h-3 w-3 rounded-full",
                    getStatusColor(agent.status),
                    agent.status === 'running' && "animate-pulse"
                  )} />
                  <span className="text-sm font-medium">
                    {getStatusLabel(agent.status)}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Execuções</p>
                  <p className="text-lg font-semibold">{agent.runCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Última Execução</p>
                  <p className="text-sm font-medium">
                    {agent.lastRun 
                      ? new Date(agent.lastRun).toLocaleString('pt-BR')
                      : 'Nunca'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Intervalo</p>
                  <p className="text-sm font-medium">
                    {agent.config.schedule?.type === 'manual' 
                      ? 'Sob demanda'
                      : agent.config.schedule?.type === 'interval'
                        ? `${agent.config.schedule.value} min`
                        : 'Não configurado'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Habilitado</p>
                  <p className="text-sm font-medium">
                    {agent.config.enabled ? 'Sim' : 'Não'}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {agent.status === 'running' ? (
                  <button
                    onClick={() => stopMutation.mutate(agent.config.id)}
                    disabled={stopMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors disabled:opacity-50"
                  >
                    <Pause className="h-4 w-4" />
                    Parar
                  </button>
                ) : (
                  <button
                    onClick={() => startMutation.mutate(agent.config.id)}
                    disabled={startMutation.isPending || !isAccountActive || isTrialExpired}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors disabled:opacity-50",
                      isAccountActive && !isTrialExpired
                        ? "bg-green-600 text-white hover:bg-green-700" 
                        : "bg-gray-400 text-gray-200 cursor-not-allowed"
                    )}
                  >
                    {isAccountActive && !isTrialExpired ? <Play className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    Iniciar
                  </button>
                )}
                <button
                  onClick={() => runOnceMutation.mutate(agent.config.id)}
                  disabled={runOnceMutation.isPending || !isAccountActive || isTrialExpired}
                  className={cn(
                    "flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50",
                    isAccountActive && !isTrialExpired
                      ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                      : "bg-gray-400 text-gray-200 cursor-not-allowed"
                  )}
                >
                  <RotateCcw className="h-4 w-4" />
                  Executar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
