import { useQuery } from '@tanstack/react-query';
import { 
  Mail, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  TrendingUp,
  Bot,
  RefreshCw
} from 'lucide-react';
import { apiRequest } from '@/lib/utils';

interface EmailStats {
  totalProcessed: number;
  byPriority: {
    urgent: number;
    attention: number;
    informative: number;
    low: number;
    cc_only: number;
  };
  lastRun: string | null;
}

interface AgentInfo {
  config: {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
  };
  status: string;
  runCount: number;
  lastRun?: string;
}

export function Dashboard() {
  const { data: emailStats } = useQuery({
    queryKey: ['emailStats'],
    queryFn: () => apiRequest<EmailStats>('/emails/stats'),
    refetchInterval: 30000,
  });

  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: () => apiRequest<{ agents: AgentInfo[] }>('/agents'),
    refetchInterval: 10000,
  });

  const stats = [
    {
      name: 'Emails Processados',
      value: emailStats?.totalProcessed || 0,
      icon: Mail,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      name: 'Urgentes',
      value: emailStats?.byPriority.urgent || 0,
      icon: AlertCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      name: 'Precisam Atenção',
      value: emailStats?.byPriority.attention || 0,
      icon: Clock,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      name: 'Informativos',
      value: (emailStats?.byPriority.informative || 0) + 
             (emailStats?.byPriority.low || 0) +
             (emailStats?.byPriority.cc_only || 0),
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
  ];

  const agents = agentsData?.agents || [];

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div 
            key={stat.name}
            className="p-6 bg-card rounded-xl border shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.name}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Agents Status */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Status dos Agentes
          </h2>
        </div>
        <div className="p-6">
          {agents.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum agente configurado ainda
            </p>
          ) : (
            <div className="space-y-4">
              {agents.map((agent) => (
                <div 
                  key={agent.config.id}
                  className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-3 w-3 rounded-full ${
                      agent.status === 'running' ? 'bg-green-500 animate-pulse' :
                      agent.status === 'error' ? 'bg-red-500' :
                      'bg-gray-400'
                    }`} />
                    <div>
                      <p className="font-medium">{agent.config.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {agent.config.description}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium capitalize">{agent.status}</p>
                    <p className="text-xs text-muted-foreground">
                      {agent.runCount} execuções
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Ações Rápidas
          </h2>
        </div>
        <div className="p-6 grid gap-4 md:grid-cols-3">
          <button 
            onClick={() => apiRequest('/emails/fetch', { method: 'POST' })}
            className="flex items-center justify-center gap-2 p-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-5 w-5" />
            Buscar Emails Agora
          </button>
          <button 
            onClick={() => apiRequest('/agents/start-all', { method: 'POST' })}
            className="flex items-center justify-center gap-2 p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Bot className="h-5 w-5" />
            Iniciar Todos Agentes
          </button>
          <button 
            onClick={() => apiRequest('/agents/stop-all', { method: 'POST' })}
            className="flex items-center justify-center gap-2 p-4 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
          >
            <Clock className="h-5 w-5" />
            Pausar Todos
          </button>
        </div>
      </div>
    </div>
  );
}
