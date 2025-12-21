import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Briefcase,
  AlertTriangle,
  CheckCircle,
  Calendar,
  RefreshCw,
  Building2,
  FileText,
  Clock,
  ChevronRight,
  X,
  Filter,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Mail,
  ExternalLink,
  Phone,
  User,
  Target,
  Trophy,
  XCircle,
  Handshake,
  MessageSquare,
  Repeat,
  HelpCircle,
  Send,
  Users,
  Copy,
  CheckCheck,
  Star
} from 'lucide-react';
import { useState } from 'react';
import { cn, apiRequest } from '@/lib/utils';
import { useDialog } from '@/components/Dialog';

interface CommercialItem {
  id: number;
  emailId: string;
  threadId?: string;
  emailSubject?: string;
  emailFrom?: string;
  emailDate?: string;
  type: 'quote_request' | 'proposal' | 'negotiation' | 'order' | 'follow_up' | 'complaint' | 'renewal' | 'opportunity' | 'outro';
  status: 'new' | 'in_progress' | 'quoted' | 'negotiating' | 'won' | 'lost' | 'cancelled' | 'on_hold';
  clientName: string;
  clientCompany?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientType?: 'prospect' | 'new_client' | 'existing_client' | 'strategic_client' | 'partner' | 'distributor' | 'other';
  title: string;
  description: string;
  productsServices?: string;
  estimatedValue?: number;
  currency?: string;
  quantity?: string;
  deadlineDate?: string;
  desiredDeliveryDate?: string;
  hasCompetitors?: boolean;
  competitorNames?: string;
  isUrgentBid?: boolean;
  priority: 'critical' | 'high' | 'normal' | 'low';
  priorityReason?: string;
  suggestedAction?: string;
  suggestedResponse?: string;
  wonAt?: string;
  lostAt?: string;
  lostReason?: string;
  wonValue?: number;
  assignedTo?: string;
  tags?: string;
  notes?: string;
  confidence: number;
  analyzedAt: string;
}

interface DashboardResponse {
  criticalItems: CommercialItem[];
  highPriorityItems: CommercialItem[];
  pendingQuotes: CommercialItem[];
  recentItems: CommercialItem[];
  summary: {
    critical: number;
    high: number;
    pending: number;
    totalValue: number;
  };
}

interface ItemsResponse {
  items: CommercialItem[];
  total: number;
}

interface StatsResponse {
  total: number;
  newItems: number;
  inProgress: number;
  won: number;
  lost: number;
  totalEstimatedValue: number;
  wonValue: number;
  criticalCount: number;
  highCount: number;
  byType: Record<string, { count: number; value: number }>;
  byPriority: Record<string, number>;
}

const typeConfig = {
  quote_request: { label: 'Cotação', icon: FileText, color: 'text-blue-600 bg-blue-100' },
  proposal: { label: 'Proposta', icon: Send, color: 'text-purple-600 bg-purple-100' },
  negotiation: { label: 'Negociação', icon: Handshake, color: 'text-orange-600 bg-orange-100' },
  order: { label: 'Pedido', icon: CheckCircle, color: 'text-green-600 bg-green-100' },
  follow_up: { label: 'Follow-up', icon: MessageSquare, color: 'text-cyan-600 bg-cyan-100' },
  complaint: { label: 'Reclamação', icon: AlertCircle, color: 'text-red-600 bg-red-100' },
  renewal: { label: 'Renovação', icon: Repeat, color: 'text-teal-600 bg-teal-100' },
  opportunity: { label: 'Oportunidade', icon: Target, color: 'text-amber-600 bg-amber-100' },
  outro: { label: 'Outro', icon: HelpCircle, color: 'text-gray-600 bg-gray-100' },
};

const statusConfig = {
  new: { label: 'Novo', color: 'bg-blue-100 text-blue-800', icon: Clock },
  in_progress: { label: 'Em Andamento', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  quoted: { label: 'Cotado', color: 'bg-purple-100 text-purple-800', icon: Send },
  negotiating: { label: 'Negociando', color: 'bg-orange-100 text-orange-800', icon: Handshake },
  won: { label: 'Ganho', color: 'bg-green-100 text-green-800', icon: Trophy },
  lost: { label: 'Perdido', color: 'bg-red-100 text-red-800', icon: XCircle },
  cancelled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800', icon: X },
  on_hold: { label: 'Pausado', color: 'bg-slate-100 text-slate-800', icon: Clock },
};

const priorityConfig = {
  critical: { label: 'Crítico', color: 'bg-red-500', textColor: 'text-red-600', icon: '🔴' },
  high: { label: 'Alto', color: 'bg-orange-500', textColor: 'text-orange-600', icon: '🟠' },
  normal: { label: 'Normal', color: 'bg-blue-500', textColor: 'text-blue-600', icon: '🔵' },
  low: { label: 'Baixo', color: 'bg-gray-400', textColor: 'text-gray-600', icon: '⚪' },
};

const clientTypeLabels: Record<string, string> = {
  prospect: 'Prospect',
  new_client: 'Cliente Novo',
  existing_client: 'Cliente Existente',
  strategic_client: 'Cliente Estratégico',
  partner: 'Parceiro',
  distributor: 'Distribuidor',
  other: 'Outro',
};

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR');
}

function getDaysUntilDeadline(deadlineDate: string | undefined): number | null {
  if (!deadlineDate) return null;
  const deadline = new Date(deadlineDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  return Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function Commercial() {
  const queryClient = useQueryClient();
  const dialog = useDialog();
  const [selectedItem, setSelectedItem] = useState<CommercialItem | null>(null);
  const [filter, setFilter] = useState<{ status?: string; type?: string; priority?: string }>({});
  const [view, setView] = useState<'dashboard' | 'list'>('dashboard');

  // Busca dashboard
  const { data: dashboard, isLoading: loadingDashboard } = useQuery({
    queryKey: ['commercial-dashboard'],
    queryFn: () => apiRequest<DashboardResponse>('/commercial/dashboard'),
  });

  // Busca stats
  const { data: stats } = useQuery({
    queryKey: ['commercial-stats'],
    queryFn: () => apiRequest<StatsResponse>('/commercial/stats'),
  });

  // Busca itens com filtros
  const { data: items, isLoading: loadingItems, refetch } = useQuery({
    queryKey: ['commercial-items', filter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter.status) params.append('status', filter.status);
      if (filter.type) params.append('type', filter.type);
      if (filter.priority) params.append('priority', filter.priority);
      const query = params.toString();
      return apiRequest<ItemsResponse>(`/commercial/items${query ? `?${query}` : ''}`);
    },
    enabled: view === 'list',
  });

  // Atualiza status
  const updateStatus = useMutation({
    mutationFn: ({ id, status, wonValue, lostReason }: { 
      id: number; 
      status: string; 
      wonValue?: number;
      lostReason?: string;
    }) =>
      apiRequest(`/commercial/items/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, wonValue, lostReason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commercial-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['commercial-items'] });
      queryClient.invalidateQueries({ queryKey: ['commercial-stats'] });
      dialog.success('Status atualizado!');
      setSelectedItem(null);
    },
    onError: () => dialog.error('Erro ao atualizar status'),
  });

  // Exclui item
  const deleteItem = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/commercial/items/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commercial-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['commercial-items'] });
      queryClient.invalidateQueries({ queryKey: ['commercial-stats'] });
      dialog.success('Item excluído com sucesso!');
      setSelectedItem(null);
    },
    onError: () => dialog.error('Erro ao excluir item'),
  });

  const isLoading = loadingDashboard || loadingItems;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-indigo-600" />
            Comercial
          </h2>
          <p className="text-muted-foreground">
            Cotações, propostas e oportunidades de vendas
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView(view === 'dashboard' ? 'list' : 'dashboard')}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-muted"
          >
            {view === 'dashboard' ? <Filter className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
            {view === 'dashboard' ? 'Ver Lista' : 'Ver Dashboard'}
          </button>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              Pendentes
            </div>
            <div className="text-2xl font-bold">{stats.newItems + stats.inProgress}</div>
            <div className="text-sm text-muted-foreground">{stats.criticalCount + stats.highCount} prioritários</div>
          </div>
          <div className="bg-card rounded-xl border p-4 border-green-200 dark:border-green-900">
            <div className="flex items-center gap-2 text-sm text-green-600 mb-1">
              <Trophy className="h-4 w-4" />
              Ganhos
            </div>
            <div className="text-2xl font-bold text-green-600">{stats.won}</div>
            <div className="text-sm text-green-600">{formatCurrency(stats.wonValue)}</div>
          </div>
          <div className="bg-card rounded-xl border p-4 border-red-200 dark:border-red-900">
            <div className="flex items-center gap-2 text-sm text-red-600 mb-1">
              <XCircle className="h-4 w-4" />
              Perdidos
            </div>
            <div className="text-2xl font-bold text-red-600">{stats.lost}</div>
            <div className="text-sm text-muted-foreground">
              Taxa: {stats.won + stats.lost > 0 
                ? Math.round((stats.won / (stats.won + stats.lost)) * 100) 
                : 0}% ganhos
            </div>
          </div>
          <div className="bg-card rounded-xl border p-4 border-indigo-200 dark:border-indigo-900">
            <div className="flex items-center gap-2 text-sm text-indigo-600 mb-1">
              <DollarSign className="h-4 w-4" />
              Pipeline
            </div>
            <div className="text-2xl font-bold text-indigo-600">{formatCurrency(stats.totalEstimatedValue)}</div>
            <div className="text-sm text-muted-foreground">{stats.total} oportunidades</div>
          </div>
        </div>
      )}

      {view === 'dashboard' ? (
        /* Dashboard View */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Críticos */}
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-red-50 dark:bg-red-950">
              <h3 className="font-semibold flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
                Críticos ({dashboard?.summary.critical || 0})
              </h3>
            </div>
            <div className="divide-y max-h-80 overflow-y-auto">
              {dashboard?.criticalItems.length === 0 && (
                <p className="p-4 text-center text-muted-foreground">Nenhum item crítico</p>
              )}
              {dashboard?.criticalItems.map((item) => (
                <ItemRow key={item.id} item={item} onClick={() => setSelectedItem(item)} />
              ))}
            </div>
          </div>

          {/* Alta Prioridade */}
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-orange-50 dark:bg-orange-950">
              <h3 className="font-semibold flex items-center gap-2 text-orange-700 dark:text-orange-400">
                <Clock className="h-5 w-5" />
                Alta Prioridade ({dashboard?.summary.high || 0})
              </h3>
            </div>
            <div className="divide-y max-h-80 overflow-y-auto">
              {dashboard?.highPriorityItems.length === 0 && (
                <p className="p-4 text-center text-muted-foreground">Nenhum item de alta prioridade</p>
              )}
              {dashboard?.highPriorityItems.map((item) => (
                <ItemRow key={item.id} item={item} onClick={() => setSelectedItem(item)} />
              ))}
            </div>
          </div>

          {/* Cotações Pendentes */}
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-blue-50 dark:bg-blue-950">
              <h3 className="font-semibold flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <FileText className="h-5 w-5" />
                Cotações Pendentes
              </h3>
            </div>
            <div className="divide-y max-h-80 overflow-y-auto">
              {dashboard?.pendingQuotes.length === 0 && (
                <p className="p-4 text-center text-muted-foreground">Nenhuma cotação pendente</p>
              )}
              {dashboard?.pendingQuotes.map((item) => (
                <ItemRow key={item.id} item={item} onClick={() => setSelectedItem(item)} showStatus />
              ))}
            </div>
          </div>

          {/* Recentes */}
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <Target className="h-5 w-5" />
                Detectados Recentemente
              </h3>
            </div>
            <div className="divide-y max-h-80 overflow-y-auto">
              {dashboard?.recentItems.length === 0 && (
                <p className="p-4 text-center text-muted-foreground">Nenhum item recente</p>
              )}
              {dashboard?.recentItems.map((item) => (
                <ItemRow key={item.id} item={item} onClick={() => setSelectedItem(item)} showStatus />
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* List View */
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          {/* Filtros */}
          <div className="p-4 border-b flex flex-wrap gap-3">
            <select
              value={filter.status || ''}
              onChange={(e) => setFilter({ ...filter, status: e.target.value || undefined })}
              className="px-3 py-2 border rounded-lg bg-background"
            >
              <option value="">Todos os status</option>
              <option value="new">Novos</option>
              <option value="in_progress">Em Andamento</option>
              <option value="quoted">Cotados</option>
              <option value="negotiating">Negociando</option>
              <option value="won">Ganhos</option>
              <option value="lost">Perdidos</option>
            </select>
            <select
              value={filter.type || ''}
              onChange={(e) => setFilter({ ...filter, type: e.target.value || undefined })}
              className="px-3 py-2 border rounded-lg bg-background"
            >
              <option value="">Todos os tipos</option>
              {Object.entries(typeConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
            <select
              value={filter.priority || ''}
              onChange={(e) => setFilter({ ...filter, priority: e.target.value || undefined })}
              className="px-3 py-2 border rounded-lg bg-background"
            >
              <option value="">Todas as prioridades</option>
              {Object.entries(priorityConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.icon} {config.label}</option>
              ))}
            </select>
            {(filter.status || filter.type || filter.priority) && (
              <button
                onClick={() => setFilter({})}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="divide-y">
            {items?.items.length === 0 && (
              <p className="p-8 text-center text-muted-foreground">Nenhum item encontrado</p>
            )}
            {items?.items.map((item) => (
              <ItemRow key={item.id} item={item} onClick={() => setSelectedItem(item)} showStatus />
            ))}
          </div>
        </div>
      )}

      {/* Modal de Detalhes */}
      {selectedItem && (
        <CommercialDetailsModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onUpdateStatus={(status, wonValue, lostReason) => 
            updateStatus.mutate({ id: selectedItem.id, status, wonValue, lostReason })
          }
          onDelete={() => deleteItem.mutate(selectedItem.id)}
          isPending={updateStatus.isPending}
          isDeleting={deleteItem.isPending}
        />
      )}
    </div>
  );
}

// Componente de linha de item
function ItemRow({ item, onClick, showStatus }: { item: CommercialItem; onClick: () => void; showStatus?: boolean }) {
  const TypeIcon = typeConfig[item.type]?.icon || FileText;
  const daysUntil = getDaysUntilDeadline(item.deadlineDate);

  return (
    <button
      onClick={onClick}
      className="w-full p-4 flex items-center gap-4 hover:bg-muted/50 text-left transition-colors"
    >
      <div className={cn("p-2 rounded-lg", typeConfig[item.type]?.color || 'text-gray-600 bg-gray-100')}>
        <TypeIcon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{item.title}</p>
          {item.clientType === 'strategic_client' && (
            <Star className="h-4 w-4 text-amber-500 shrink-0" />
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {item.clientName} {item.clientCompany && `• ${item.clientCompany}`}
        </p>
      </div>
      <div className="text-right shrink-0">
        {item.estimatedValue ? (
          <p className="font-semibold">{formatCurrency(item.estimatedValue)}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Sem valor</p>
        )}
        {daysUntil !== null && (
          <p className={cn(
            "text-xs",
            daysUntil < 0 ? "text-red-600" :
            daysUntil <= 2 ? "text-orange-600" :
            "text-muted-foreground"
          )}>
            {daysUntil < 0 
              ? `Atrasado ${Math.abs(daysUntil)} dia(s)` 
              : daysUntil === 0 
              ? 'Vence hoje'
              : daysUntil === 1
              ? 'Vence amanhã'
              : `Prazo: ${daysUntil} dias`}
          </p>
        )}
        {showStatus && (
          <span className={cn("text-xs px-1.5 py-0.5 rounded mt-1 inline-block", statusConfig[item.status]?.color || 'bg-gray-100 text-gray-800')}>
            {statusConfig[item.status]?.label || item.status}
          </span>
        )}
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </button>
  );
}

// Modal de detalhes
function CommercialDetailsModal({ 
  item, 
  onClose, 
  onUpdateStatus,
  onDelete,
  isPending,
  isDeleting
}: { 
  item: CommercialItem; 
  onClose: () => void; 
  onUpdateStatus: (status: string, wonValue?: number, lostReason?: string) => void;
  onDelete: () => void;
  isPending: boolean;
  isDeleting: boolean;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showLostForm, setShowLostForm] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [showWonForm, setShowWonForm] = useState(false);
  const [wonValue, setWonValue] = useState(item.estimatedValue || 0);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <button
      onClick={() => copyToClipboard(text, field)}
      className="p-1.5 hover:bg-muted rounded-md transition-colors"
      title="Copiar"
    >
      {copiedField === field ? (
        <CheckCheck className="h-4 w-4 text-green-600" />
      ) : (
        <Copy className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );

  const handleMarkWon = () => {
    if (showWonForm) {
      onUpdateStatus('won', wonValue);
      setShowWonForm(false);
    } else {
      setShowWonForm(true);
    }
  };

  const handleMarkLost = () => {
    if (showLostForm) {
      onUpdateStatus('lost', undefined, lostReason);
      setShowLostForm(false);
    } else {
      setShowLostForm(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl border shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-card z-10">
          <h3 className="font-semibold text-lg">Detalhes da Oportunidade</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Status, Tipo e Prioridade */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("px-2 py-1 rounded text-xs font-medium", statusConfig[item.status]?.color)}>
              {statusConfig[item.status]?.label}
            </span>
            <span className={cn("px-2 py-1 rounded text-xs font-medium", typeConfig[item.type]?.color)}>
              {typeConfig[item.type]?.label}
            </span>
            <span className={cn("px-2 py-1 rounded text-xs font-medium", `bg-${priorityConfig[item.priority].color.replace('bg-', '')}/20`, priorityConfig[item.priority].textColor)}>
              {priorityConfig[item.priority].icon} {priorityConfig[item.priority].label}
            </span>
            {item.isUrgentBid && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                ⚡ Licitação Urgente
              </span>
            )}
          </div>

          {/* Título */}
          <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 rounded-xl border border-indigo-200 dark:border-indigo-800">
            <h4 className="text-xl font-bold">{item.title}</h4>
            {item.priorityReason && (
              <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-1">{item.priorityReason}</p>
            )}
          </div>

          {/* Email de origem */}
          {(item.emailSubject || item.emailFrom) && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Detectado no email:</p>
                  {item.emailSubject && (
                    <p className="font-medium text-sm">{item.emailSubject}</p>
                  )}
                  {item.emailFrom && (
                    <p className="text-sm text-muted-foreground">De: {item.emailFrom}</p>
                  )}
                  {item.emailDate && (
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(item.emailDate)}</p>
                  )}
                </div>
                <a
                  href={`https://mail.google.com/mail/u/0/#inbox/${item.threadId || item.emailId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900 rounded text-blue-600 dark:text-blue-400"
                  title="Ver email no Gmail"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          )}

          {/* Valor Estimado */}
          {item.estimatedValue && (
            <div className="text-center py-5 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-xl border border-green-200 dark:border-green-800">
              <p className="text-sm text-muted-foreground">Valor Estimado</p>
              <p className="text-4xl font-bold text-green-700 dark:text-green-400">{formatCurrency(item.estimatedValue)}</p>
              {item.quantity && (
                <p className="text-sm text-muted-foreground mt-1">Quantidade: {item.quantity}</p>
              )}
            </div>
          )}

          {/* Cliente */}
          <div className="p-4 bg-muted/30 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-lg">{item.clientName}</p>
                  {item.clientType === 'strategic_client' && (
                    <Star className="h-4 w-4 text-amber-500" />
                  )}
                </div>
                {item.clientCompany && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    {item.clientCompany}
                  </p>
                )}
                {item.clientType && (
                  <span className="text-xs px-2 py-0.5 bg-muted rounded mt-1 inline-block">
                    {clientTypeLabels[item.clientType] || item.clientType}
                  </span>
                )}
              </div>
            </div>

            {/* Contatos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              {item.clientEmail && (
                <div className="flex items-center gap-2 p-2 bg-background rounded-lg">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm flex-1 truncate">{item.clientEmail}</span>
                  <CopyButton text={item.clientEmail} field="email" />
                </div>
              )}
              {item.clientPhone && (
                <div className="flex items-center gap-2 p-2 bg-background rounded-lg">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm flex-1">{item.clientPhone}</span>
                  <CopyButton text={item.clientPhone} field="phone" />
                </div>
              )}
            </div>
          </div>

          {/* Descrição */}
          <div className="p-4 bg-muted/20 rounded-xl">
            <p className="text-sm text-muted-foreground mb-1">Descrição</p>
            <p className="text-base whitespace-pre-wrap">{item.description}</p>
          </div>

          {/* Produtos/Serviços */}
          {item.productsServices && (
            <div className="p-4 bg-muted/20 rounded-xl">
              <p className="text-sm text-muted-foreground mb-2">Produtos/Serviços Solicitados</p>
              <div className="flex flex-wrap gap-2">
                {(JSON.parse(item.productsServices) as string[]).map((ps, i) => (
                  <span key={i} className="px-2 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 rounded text-sm">
                    {ps}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Prazos */}
          {(item.deadlineDate || item.desiredDeliveryDate) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {item.deadlineDate && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span className="text-sm text-amber-800 dark:text-amber-200">Prazo para Resposta</span>
                  </div>
                  <p className="font-semibold mt-1">{formatDate(item.deadlineDate)}</p>
                </div>
              )}
              {item.desiredDeliveryDate && (
                <div className="p-3 bg-cyan-50 dark:bg-cyan-950 rounded-lg border border-cyan-200 dark:border-cyan-800">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-cyan-600" />
                    <span className="text-sm text-cyan-800 dark:text-cyan-200">Entrega Desejada</span>
                  </div>
                  <p className="font-semibold mt-1">{formatDate(item.desiredDeliveryDate)}</p>
                </div>
              )}
            </div>
          )}

          {/* Concorrência */}
          {item.hasCompetitors && (
            <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-800 dark:text-orange-200">Concorrência Identificada</span>
              </div>
              {item.competitorNames && (
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  {(JSON.parse(item.competitorNames) as string[]).join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Ação Sugerida */}
          {item.suggestedAction && (
            <div className="p-4 bg-violet-50 dark:bg-violet-950 rounded-xl border border-violet-200 dark:border-violet-800">
              <p className="text-sm text-violet-600 dark:text-violet-400 font-medium mb-1">💡 Ação Sugerida</p>
              <p className="font-medium">{item.suggestedAction}</p>
            </div>
          )}

          {/* Resposta Sugerida */}
          {item.suggestedResponse && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mb-1">📝 Sugestão de Resposta</p>
              <p className="text-sm whitespace-pre-wrap">{item.suggestedResponse}</p>
              <button
                onClick={() => copyToClipboard(item.suggestedResponse!, 'response')}
                className="mt-2 flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700"
              >
                {copiedField === 'response' ? <CheckCheck className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiedField === 'response' ? 'Copiado!' : 'Copiar resposta'}
              </button>
            </div>
          )}

          {/* Notas */}
          {item.notes && (
            <div className="p-3 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Notas</p>
              <p className="text-sm">{item.notes}</p>
            </div>
          )}

          {/* Tags */}
          {item.tags && (
            <div className="flex flex-wrap gap-1">
              {(JSON.parse(item.tags) as string[]).map((tag, i) => (
                <span key={i} className="text-xs px-2 py-0.5 bg-muted rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Metadados */}
          <div className="text-xs text-muted-foreground flex items-center justify-between pt-2 border-t">
            <span>Analisado em {formatDate(item.analyzedAt)}</span>
            <span>Confiança: {item.confidence}%</span>
          </div>

          {/* Formulários para Won/Lost */}
          {showWonForm && (
            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-xl border border-green-200 dark:border-green-800">
              <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">Valor Final do Negócio</p>
              <input
                type="text"
                value={(wonValue / 100).toLocaleString('pt-BR')}
                onChange={(e) => {
                  const value = parseInt(e.target.value.replace(/\D/g, '')) || 0;
                  setWonValue(value * 100);
                }}
                className="w-full px-3 py-2 border rounded-lg bg-background"
                placeholder="Valor em R$"
              />
            </div>
          )}

          {showLostForm && (
            <div className="p-4 bg-red-50 dark:bg-red-950 rounded-xl border border-red-200 dark:border-red-800">
              <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">Motivo da Perda</p>
              <textarea
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background h-20"
                placeholder="Ex: Preço, prazo, concorrente..."
              />
            </div>
          )}

          {/* Ações */}
          <div className="pt-4 border-t space-y-3">
            {/* Status rápidos */}
            {item.status !== 'won' && item.status !== 'lost' && item.status !== 'cancelled' && (
              <div className="flex flex-wrap gap-2">
                {item.status === 'new' && (
                  <button
                    onClick={() => onUpdateStatus('in_progress')}
                    disabled={isPending}
                    className="px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg text-sm font-medium hover:bg-yellow-200 disabled:opacity-50"
                  >
                    Em Andamento
                  </button>
                )}
                {(item.status === 'new' || item.status === 'in_progress') && (
                  <button
                    onClick={() => onUpdateStatus('quoted')}
                    disabled={isPending}
                    className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 disabled:opacity-50"
                  >
                    Marcar Cotado
                  </button>
                )}
                {(item.status === 'quoted' || item.status === 'in_progress') && (
                  <button
                    onClick={() => onUpdateStatus('negotiating')}
                    disabled={isPending}
                    className="px-3 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-200 disabled:opacity-50"
                  >
                    Em Negociação
                  </button>
                )}
              </div>
            )}

            {/* Ações finais */}
            {item.status !== 'won' && item.status !== 'lost' && item.status !== 'cancelled' && (
              <div className="flex gap-3">
                <button
                  onClick={handleMarkWon}
                  disabled={isPending || isDeleting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
                >
                  <Trophy className="h-5 w-5" />
                  {showWonForm ? 'Confirmar Ganho' : 'Marcar como Ganho'}
                </button>
                <button
                  onClick={handleMarkLost}
                  disabled={isPending || isDeleting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 font-medium transition-colors"
                >
                  <XCircle className="h-5 w-5" />
                  {showLostForm ? 'Confirmar Perda' : 'Marcar como Perdido'}
                </button>
              </div>
            )}

            <button
              onClick={onDelete}
              disabled={isPending || isDeleting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-xl hover:bg-red-50 disabled:opacity-50 font-medium transition-colors"
            >
              <X className="h-4 w-4" />
              {isDeleting ? 'Excluindo...' : 'Excluir Item'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

