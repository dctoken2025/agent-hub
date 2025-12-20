import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { 
  Users as UsersIcon, 
  Shield, 
  Clock, 
  Ban, 
  CheckCircle2,
  XCircle,
  AlertCircle,
  Mail,
  Calendar,
  Activity,
  Bot,
  Scale,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Search,
  RefreshCw,
  Brain,
  Unlock,
  Timer,
  Infinity
} from 'lucide-react';
import { cn, apiRequest } from '@/lib/utils';

interface UserStats {
  emailsProcessed: number;
  legalAnalyses: number;
  financialItems: number;
  agentRuns: number;
  lastActivity: string | null;
  agentsActive: boolean;
}

interface UserData {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'user';
  accountStatus: 'pending' | 'active' | 'suspended' | 'trial_expired';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  hasGmailConnected: boolean;
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  isTrialExpired: boolean;
  stats: UserStats;
}

interface AdminStats {
  users: {
    byStatus: Record<string, number>;
    total: number;
  };
  totals: {
    emails: number;
    legalAnalyses: number;
    financialItems: number;
  };
  aiUsage: {
    callsLast30Days: number;
    costLast30DaysUsd: number;
  };
}

export function Users() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Busca estatísticas gerais
  const { data: statsData } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => apiRequest<AdminStats>('/admin/stats'),
  });

  // Busca lista de usuários
  const { data: usersData, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => apiRequest<{ users: UserData[]; total: number }>('/admin/users'),
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  // Mutação para alterar status
  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) =>
      apiRequest(`/admin/users/${userId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });

  // Mutação para liberar trial (acesso permanente)
  const unlockMutation = useMutation({
    mutationFn: (userId: string) =>
      apiRequest(`/admin/users/${userId}/unlock`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });

  const users = usersData?.users || [];
  const stats = statsData;

  // Filtros
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === 'all' || user.accountStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string, isTrialExpired?: boolean) => {
    if (isTrialExpired) return <Timer className="w-4 h-4 text-orange-500" />;
    switch (status) {
      case 'active': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'suspended': return <Ban className="w-4 h-4 text-red-500" />;
      case 'trial_expired': return <Timer className="w-4 h-4 text-orange-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusLabel = (status: string, isTrialExpired?: boolean, trialDaysRemaining?: number | null) => {
    if (isTrialExpired || status === 'trial_expired') return 'Trial Expirado';
    if (status === 'active' && typeof trialDaysRemaining === 'number' && trialDaysRemaining > 0) {
      return `Trial: ${trialDaysRemaining}d`;
    }
    switch (status) {
      case 'active': return 'Ativo';
      case 'pending': return 'Pendente';
      case 'suspended': return 'Suspenso';
      default: return status;
    }
  };

  const getStatusColor = (status: string, isTrialExpired?: boolean, trialDaysRemaining?: number | null) => {
    if (isTrialExpired || status === 'trial_expired') return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    if (status === 'active' && typeof trialDaysRemaining === 'number' && trialDaysRemaining > 0) {
      return trialDaysRemaining <= 2 
        ? 'bg-orange-500/10 text-orange-500 border-orange-500/20'
        : 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'pending': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'suspended': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <UsersIcon className="w-7 h-7" />
            Gerenciar Usuários
          </h2>
          <p className="text-muted-foreground">
            Controle de acesso e estatísticas de uso
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          Atualizar
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-card rounded-xl border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <UsersIcon className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Usuários</p>
              <p className="text-2xl font-bold">{stats?.users.total || 0}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-card rounded-xl border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pendentes</p>
              <p className="text-2xl font-bold">{stats?.users.byStatus?.pending || 0}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-card rounded-xl border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ativos</p>
              <p className="text-2xl font-bold">{stats?.users.byStatus?.active || 0}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-card rounded-xl border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Brain className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Custo AI (30d)</p>
              <p className="text-2xl font-bold">
                ${stats?.aiUsage.costLast30DaysUsd?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por email ou nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">Todos os Status</option>
          <option value="pending">Pendentes</option>
          <option value="active">Ativos</option>
          <option value="suspended">Suspensos</option>
        </select>
      </div>

      {/* Users List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Activity className="w-8 h-8 animate-pulse text-muted-foreground" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border">
          <UsersIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Nenhum usuário encontrado</p>
          <p className="text-muted-foreground mt-1">
            {searchTerm ? 'Tente ajustar os filtros' : 'Aguardando novos cadastros'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredUsers.map((user) => (
            <div 
              key={user.id}
              className="bg-card rounded-xl border overflow-hidden"
            >
              {/* User Header */}
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-secondary/50 transition-colors"
                onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    {user.role === 'admin' ? (
                      <Shield className="w-5 h-5 text-primary" />
                    ) : (
                      <UsersIcon className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{user.name || user.email.split('@')[0]}</p>
                      {user.role === 'admin' && (
                        <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {user.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Trial/Status Badge */}
                  <div className={cn(
                    "px-3 py-1 rounded-full border flex items-center gap-2",
                    getStatusColor(user.accountStatus, user.isTrialExpired, user.trialDaysRemaining)
                  )}>
                    {getStatusIcon(user.accountStatus, user.isTrialExpired)}
                    <span className="text-sm font-medium">
                      {getStatusLabel(user.accountStatus, user.isTrialExpired, user.trialDaysRemaining)}
                    </span>
                  </div>
                  
                  {/* Ícone de acesso permanente */}
                  {user.role !== 'admin' && user.trialEndsAt === null && user.accountStatus === 'active' && (
                    <div className="flex items-center gap-1 text-green-500" title="Acesso Permanente">
                      <Infinity className="w-4 h-4" />
                    </div>
                  )}

                  {/* Quick Stats */}
                  <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      {user.stats.emailsProcessed}
                    </div>
                    <div className="flex items-center gap-1">
                      <Bot className="w-4 h-4" />
                      {user.stats.agentRuns}
                    </div>
                  </div>

                  {expandedUser === user.id ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedUser === user.id && (
                <div className="p-4 border-t bg-secondary/30">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Info Column */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                        Informações
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Criado em</p>
                          <p className="text-sm flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Acesso</p>
                          <p className="text-sm flex items-center gap-1">
                            {user.trialEndsAt === null ? (
                              <>
                                <Infinity className="w-3 h-3 text-green-500" />
                                <span className="text-green-500">Permanente</span>
                              </>
                            ) : user.isTrialExpired ? (
                              <>
                                <Timer className="w-3 h-3 text-red-500" />
                                <span className="text-red-500">Trial Expirado</span>
                              </>
                            ) : (
                              <>
                                <Timer className="w-3 h-3 text-blue-500" />
                                <span className="text-blue-500">
                                  Trial: {user.trialDaysRemaining}d restantes
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Gmail Conectado</p>
                          <p className="text-sm flex items-center gap-1">
                            {user.hasGmailConnected ? (
                              <CheckCircle2 className="w-3 h-3 text-green-500" />
                            ) : (
                              <XCircle className="w-3 h-3 text-red-500" />
                            )}
                            {user.hasGmailConnected ? 'Sim' : 'Não'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Agentes</p>
                          <p className="text-sm flex items-center gap-1">
                            <Bot className="w-3 h-3" />
                            {user.stats.agentsActive ? 'Ativos' : 'Parados'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Última Atividade</p>
                          <p className="text-sm">
                            {user.stats.lastActivity 
                              ? new Date(user.stats.lastActivity).toLocaleString('pt-BR')
                              : 'Nunca'
                            }
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Stats Column */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                        Estatísticas
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-card rounded-lg border">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-blue-500" />
                            <span className="text-sm text-muted-foreground">Emails</span>
                          </div>
                          <p className="text-xl font-bold">{user.stats.emailsProcessed}</p>
                        </div>
                        <div className="p-3 bg-card rounded-lg border">
                          <div className="flex items-center gap-2">
                            <Scale className="w-4 h-4 text-purple-500" />
                            <span className="text-sm text-muted-foreground">Jurídico</span>
                          </div>
                          <p className="text-xl font-bold">{user.stats.legalAnalyses}</p>
                        </div>
                        <div className="p-3 bg-card rounded-lg border">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-muted-foreground">Financeiro</span>
                          </div>
                          <p className="text-xl font-bold">{user.stats.financialItems}</p>
                        </div>
                        <div className="p-3 bg-card rounded-lg border">
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-orange-500" />
                            <span className="text-sm text-muted-foreground">Execuções</span>
                          </div>
                          <p className="text-xl font-bold">{user.stats.agentRuns}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {user.role !== 'admin' && (
                    <div className="mt-6 pt-4 border-t flex flex-wrap gap-2">
                      {/* Botão de Liberar Permanentemente */}
                      {user.trialEndsAt !== null && (
                        <button
                          onClick={() => unlockMutation.mutate(user.id)}
                          disabled={unlockMutation.isPending}
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors disabled:opacity-50"
                        >
                          <Unlock className="w-4 h-4" />
                          Liberar Permanentemente
                        </button>
                      )}
                      
                      {user.accountStatus !== 'active' && (
                        <button
                          onClick={() => statusMutation.mutate({ userId: user.id, status: 'active' })}
                          disabled={statusMutation.isPending}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Ativar Conta
                        </button>
                      )}
                      {user.accountStatus !== 'suspended' && (
                        <button
                          onClick={() => statusMutation.mutate({ userId: user.id, status: 'suspended' })}
                          disabled={statusMutation.isPending}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          <Ban className="w-4 h-4" />
                          Suspender
                        </button>
                      )}
                      {user.accountStatus !== 'pending' && (
                        <button
                          onClick={() => statusMutation.mutate({ userId: user.id, status: 'pending' })}
                          disabled={statusMutation.isPending}
                          className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
                        >
                          <Clock className="w-4 h-4" />
                          Colocar em Pendente
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

