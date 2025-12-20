import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  User,
  Building2,
  Mail,
  Calendar,
  ChevronRight,
  CheckCircle2,
  Circle,
  Loader2,
  Filter,
  FolderOpen,
  MessageSquare,
  Copy,
  Check,
  X,
} from 'lucide-react';
import { apiRequest } from '@/lib/utils';

interface ActionItem {
  id: number;
  emailId: string;
  threadId?: string;
  emailSubject: string;
  emailFrom: string;
  emailDate?: string;
  stakeholderName: string;
  stakeholderCompany?: string;
  stakeholderRole?: string;
  stakeholderEmail?: string;
  stakeholderImportance: 'vip' | 'high' | 'normal';
  projectName?: string;
  projectCode?: string;
  projectType?: string;
  title: string;
  description: string;
  originalText: string;
  category: string;
  deadlineDate?: string;
  deadlineRelative?: string;
  deadlineIsExplicit?: boolean;
  deadlineDependsOn?: string;
  deadlineUrgency?: string;
  status: 'pending' | 'in_progress' | 'waiting' | 'done' | 'cancelled';
  responseText?: string;
  respondedAt?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  priorityReason?: string;
  suggestedResponse?: string;
  suggestedAction?: string;
  relatedDocuments?: string;
  blockedByExternal?: string;
  confidence?: number;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}

interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  waiting: number;
  done: number;
  critical: number;
  high: number;
  overdue: number;
  byProject: Array<{ name: string; count: number }>;
  byStakeholder: Array<{ name: string; company?: string; importance: string; count: number }>;
}

interface DashboardData {
  criticalItems: ActionItem[];
  overdueItems: ActionItem[];
  todayItems: ActionItem[];
  recentItems: ActionItem[];
}

const priorityConfig = {
  critical: { label: 'Crítico', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: '🔴' },
  high: { label: 'Alto', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', icon: '🟠' },
  medium: { label: 'Médio', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: '🟡' },
  low: { label: 'Baixo', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: '🟢' },
};

const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-gray-100 text-gray-800', icon: Circle },
  in_progress: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-800', icon: Loader2 },
  waiting: { label: 'Aguardando', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  done: { label: 'Concluído', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: Circle },
};

const categoryLabels: Record<string, string> = {
  confirmation: 'Confirmação',
  status_update: 'Status',
  deadline: 'Prazo',
  document: 'Documento',
  approval: 'Aprovação',
  action: 'Ação',
  question: 'Pergunta',
  information: 'Informação',
  followup: 'Acompanhamento',
};

export function Tasks() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'dashboard' | 'list'>('dashboard');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<ActionItem | null>(null);

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery<TaskStats>({
    queryKey: ['task-stats'],
    queryFn: () => apiRequest('/tasks/stats'),
  });

  // Fetch dashboard
  const { data: dashboard, isLoading: dashboardLoading } = useQuery<DashboardData>({
    queryKey: ['task-dashboard'],
    queryFn: () => apiRequest('/tasks/dashboard'),
  });

  // Fetch list
  const { data: listData, isLoading: listLoading } = useQuery<{ items: ActionItem[] }>({
    queryKey: ['task-items', statusFilter, priorityFilter],
    queryFn: () => apiRequest(`/tasks/items?status=${statusFilter}&priority=${priorityFilter}`),
    enabled: view === 'list',
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, responseText }: { id: number; status: string; responseText?: string }) =>
      apiRequest(`/tasks/items/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, responseText }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-stats'] });
      queryClient.invalidateQueries({ queryKey: ['task-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['task-items'] });
    },
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const copyToClipboard = async (text: string, id: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openTaskDetail = async (item: ActionItem) => {
    try {
      // Busca detalhes completos do item (incluindo originalText que pode não vir do dashboard)
      const response = await apiRequest<{ item: ActionItem }>(`/tasks/items/${item.id}`);
      setSelectedItem(response.item);
    } catch (error) {
      // Em caso de erro, usa os dados que já temos
      console.error('Erro ao buscar detalhes:', error);
      setSelectedItem(item);
    }
  };

  const closeTaskDetail = () => {
    setSelectedItem(null);
  };

  const TaskCard = ({ item }: { item: ActionItem }) => (
    <div
      onClick={() => openTaskDetail(item)}
      className="p-4 bg-card rounded-lg border hover:border-primary/50 cursor-pointer transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityConfig[item.priority]?.color || 'bg-gray-100'}`}>
          {priorityConfig[item.priority]?.icon} {priorityConfig[item.priority]?.label}
        </span>
        <span className="text-xs text-muted-foreground">{categoryLabels[item.category] || item.category}</span>
      </div>
      
      <h4 className="font-medium mb-1 line-clamp-2">{item.title}</h4>
      
      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
        <User className="h-3 w-3" />
        <span>{item.stakeholderName}</span>
        {item.stakeholderCompany && (
          <>
            <span>•</span>
            <Building2 className="h-3 w-3" />
            <span>{item.stakeholderCompany}</span>
          </>
        )}
      </div>

      {item.projectName && (
        <div className="flex items-center gap-2 text-xs text-primary mt-1">
          <FolderOpen className="h-3 w-3" />
          <span>{item.projectName}</span>
        </div>
      )}

      {(item.deadlineDate || item.deadlineRelative) && (
        <div className="flex items-center gap-2 text-xs text-amber-600 mt-2">
          <Calendar className="h-3 w-3" />
          <span>{item.deadlineDate ? formatDate(item.deadlineDate) : item.deadlineRelative}</span>
        </div>
      )}
    </div>
  );

  if (statsLoading || dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tarefas</h1>
          <p className="text-muted-foreground">Action items extraídos dos seus emails</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('dashboard')}
            className={`px-4 py-2 rounded-lg ${view === 'dashboard' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-4 py-2 rounded-lg ${view === 'list' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
          >
            Lista
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="p-4 bg-card rounded-lg border">
          <div className="text-2xl font-bold">{stats?.pending || 0}</div>
          <div className="text-sm text-muted-foreground">Pendentes</div>
        </div>
        <div className="p-4 bg-card rounded-lg border">
          <div className="text-2xl font-bold text-red-600">{stats?.critical || 0}</div>
          <div className="text-sm text-muted-foreground">Críticos</div>
        </div>
        <div className="p-4 bg-card rounded-lg border">
          <div className="text-2xl font-bold text-orange-600">{stats?.overdue || 0}</div>
          <div className="text-sm text-muted-foreground">Vencidos</div>
        </div>
        <div className="p-4 bg-card rounded-lg border">
          <div className="text-2xl font-bold text-blue-600">{stats?.inProgress || 0}</div>
          <div className="text-sm text-muted-foreground">Em Andamento</div>
        </div>
        <div className="p-4 bg-card rounded-lg border">
          <div className="text-2xl font-bold text-yellow-600">{stats?.waiting || 0}</div>
          <div className="text-sm text-muted-foreground">Aguardando</div>
        </div>
        <div className="p-4 bg-card rounded-lg border">
          <div className="text-2xl font-bold text-green-600">{stats?.done || 0}</div>
          <div className="text-sm text-muted-foreground">Concluídos</div>
        </div>
      </div>

      {view === 'dashboard' ? (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Críticos */}
          <div className="bg-card rounded-lg border p-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Itens Críticos
            </h2>
            <div className="space-y-3">
              {dashboard?.criticalItems?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum item crítico 🎉</p>
              ) : (
                dashboard?.criticalItems?.map(item => (
                  <TaskCard key={item.id} item={item} />
                ))
              )}
            </div>
          </div>

          {/* Vencidos */}
          <div className="bg-card rounded-lg border p-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-orange-500" />
              Vencidos
            </h2>
            <div className="space-y-3">
              {dashboard?.overdueItems?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum item vencido 🎉</p>
              ) : (
                dashboard?.overdueItems?.map(item => (
                  <TaskCard key={item.id} item={item} />
                ))
              )}
            </div>
          </div>

          {/* Hoje/Amanhã */}
          <div className="bg-card rounded-lg border p-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-blue-500" />
              Hoje / Próximos
            </h2>
            <div className="space-y-3">
              {dashboard?.todayItems?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum item para hoje</p>
              ) : (
                dashboard?.todayItems?.map(item => (
                  <TaskCard key={item.id} item={item} />
                ))
              )}
            </div>
          </div>

          {/* Recentes */}
          <div className="bg-card rounded-lg border p-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <CheckSquare className="h-5 w-5 text-primary" />
              Recentes
            </h2>
            <div className="space-y-3">
              {dashboard?.recentItems?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum item recente</p>
              ) : (
                dashboard?.recentItems?.map(item => (
                  <TaskCard key={item.id} item={item} />
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-lg border">
          {/* Filtros */}
          <div className="p-4 border-b flex gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 border rounded-lg bg-background text-sm"
              >
                <option value="all">Todos os status</option>
                <option value="pending">Pendentes</option>
                <option value="in_progress">Em Andamento</option>
                <option value="waiting">Aguardando</option>
                <option value="done">Concluídos</option>
              </select>
            </div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-1.5 border rounded-lg bg-background text-sm"
            >
              <option value="all">Todas prioridades</option>
              <option value="critical">Crítico</option>
              <option value="high">Alto</option>
              <option value="medium">Médio</option>
              <option value="low">Baixo</option>
            </select>
          </div>

          {/* Lista */}
          <div className="divide-y">
            {listLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : listData?.items?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma tarefa encontrada
              </div>
            ) : (
              listData?.items?.map(item => (
                <div
                  key={item.id}
                  onClick={() => openTaskDetail(item)}
                  className="p-4 hover:bg-muted/50 cursor-pointer flex items-center gap-4"
                >
                  <div className="flex-shrink-0">
                    <span className={`inline-flex w-8 h-8 items-center justify-center rounded-full text-sm ${priorityConfig[item.priority]?.color || 'bg-gray-100'}`}>
                      {priorityConfig[item.priority]?.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.title}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span>{item.stakeholderName}</span>
                      {item.projectName && (
                        <>
                          <span>•</span>
                          <span>{item.projectName}</span>
                        </>
                      )}
                      {item.deadlineDate && (
                        <>
                          <span>•</span>
                          <span>{formatDate(item.deadlineDate)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <span className={`px-2 py-1 rounded text-xs ${statusConfig[item.status]?.color || 'bg-gray-100'}`}>
                      {statusConfig[item.status]?.label}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal de Detalhes */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={closeTaskDetail} />
          <div className="relative bg-card rounded-2xl border shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-card border-b p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Detalhes da Tarefa</h2>
              <button onClick={closeTaskDetail} className="p-1 hover:bg-muted rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Header com prioridade e status */}
              <div className="flex items-center justify-between">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${priorityConfig[selectedItem.priority]?.color || 'bg-gray-100'}`}>
                  {priorityConfig[selectedItem.priority]?.icon} {priorityConfig[selectedItem.priority]?.label}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig[selectedItem.status]?.color || 'bg-gray-100'}`}>
                  {statusConfig[selectedItem.status]?.label}
                </span>
              </div>

              {/* Título */}
              <div>
                <h3 className="text-lg font-semibold">{selectedItem.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{selectedItem.description}</p>
              </div>

              {/* Stakeholder e Projeto */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Stakeholder</span>
                  </div>
                  <p className="font-medium">{selectedItem.stakeholderName}</p>
                  {selectedItem.stakeholderCompany && (
                    <p className="text-sm text-muted-foreground">{selectedItem.stakeholderCompany}</p>
                  )}
                  {selectedItem.stakeholderImportance === 'vip' && (
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded mt-1 inline-block">VIP</span>
                  )}
                </div>
                {selectedItem.projectName && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Projeto</span>
                    </div>
                    <p className="font-medium">{selectedItem.projectName}</p>
                    {selectedItem.projectType && (
                      <p className="text-sm text-muted-foreground">{selectedItem.projectType}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Prazo */}
              {(selectedItem.deadlineDate || selectedItem.deadlineRelative) && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {selectedItem.deadlineDate ? formatDate(selectedItem.deadlineDate) : selectedItem.deadlineRelative}
                    </span>
                  </div>
                  {selectedItem.deadlineDependsOn && (
                    <p className="text-xs text-amber-600">{selectedItem.deadlineDependsOn}</p>
                  )}
                </div>
              )}

              {/* Texto original */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Texto Original</span>
                  <button
                    onClick={() => copyToClipboard(selectedItem.originalText, selectedItem.id)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {copiedId === selectedItem.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-sm italic">"{selectedItem.originalText}"</p>
              </div>

              {/* Sugestão da IA */}
              {selectedItem.suggestedResponse && (
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">Sugestão de Resposta</span>
                  </div>
                  <p className="text-sm">{selectedItem.suggestedResponse}</p>
                </div>
              )}

              {/* Email de origem */}
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Email de Origem</span>
                </div>
                <p className="font-medium text-sm">{selectedItem.emailSubject}</p>
                <p className="text-xs text-muted-foreground">De: {selectedItem.emailFrom}</p>
              </div>

              {/* Ações */}
              <div className="flex gap-2 pt-4 border-t">
                {selectedItem.status !== 'done' && (
                  <>
                    <button
                      onClick={() => {
                        updateStatusMutation.mutate({ id: selectedItem.id, status: 'in_progress' });
                        closeTaskDetail();
                      }}
                      className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                      🔄 Em Andamento
                    </button>
                    <button
                      onClick={() => {
                        updateStatusMutation.mutate({ id: selectedItem.id, status: 'done' });
                        closeTaskDetail();
                      }}
                      className="flex-1 py-2 px-4 bg-green-500 text-white rounded-lg hover:bg-green-600"
                    >
                      ✅ Concluir
                    </button>
                  </>
                )}
                {selectedItem.status === 'done' && (
                  <button
                    onClick={() => {
                      updateStatusMutation.mutate({ id: selectedItem.id, status: 'pending' });
                      closeTaskDetail();
                    }}
                    className="flex-1 py-2 px-4 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                  >
                    ↩️ Reabrir
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Tasks;
