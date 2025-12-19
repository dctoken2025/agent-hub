import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Bot, 
  Play, 
  Pause, 
  RotateCcw,
  Activity
} from 'lucide-react';
import { cn, apiRequest } from '@/lib/utils';

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
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
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
                    disabled={startMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <Play className="h-4 w-4" />
                    Iniciar
                  </button>
                )}
                <button
                  onClick={() => runOnceMutation.mutate(agent.config.id)}
                  disabled={runOnceMutation.isPending}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
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
