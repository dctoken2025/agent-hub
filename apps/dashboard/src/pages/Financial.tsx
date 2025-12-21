import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Calendar,
  RefreshCw,
  Building2,
  Receipt,
  CreditCard,
  FileText,
  Clock,
  ChevronRight,
  X,
  Check,
  Filter,
  TrendingUp,
  Banknote,
  AlertCircle,
  Mail,
  ExternalLink,
  QrCode,
  Landmark,
  Repeat,
  FolderKanban,
  Copy,
  CheckCheck
} from 'lucide-react';
import { useState } from 'react';
import { cn, apiRequest } from '@/lib/utils';
import { useDialog } from '@/components/Dialog';

interface FinancialItem {
  id: number;
  emailId: string;
  threadId?: string;
  // Contexto do email original
  emailSubject?: string;
  emailFrom?: string;
  emailDate?: string;
  // Dados financeiros
  type: 'boleto' | 'fatura' | 'cobranca' | 'nota_fiscal' | 'recibo' | 'outro';
  status: 'pending' | 'paid' | 'overdue' | 'cancelled' | 'disputed';
  amount: number;
  currency: string;
  dueDate?: string;
  issueDate?: string;
  competenceDate?: string;
  paidAt?: string;
  creditor: string;
  creditorType?: 'fornecedor' | 'cliente' | 'governo' | 'banco' | 'servico' | 'outro';
  creditorDocument?: string;
  description: string;
  category?: string;
  reference?: string;
  installmentCurrent?: number;
  installmentTotal?: number;
  barcodeData?: string;
  // Formas de pagamento alternativas
  pixKey?: string;
  pixKeyType?: 'email' | 'phone' | 'cpf' | 'cnpj' | 'random';
  bankAccount?: {
    bank: string;
    agency: string;
    account: string;
    accountType?: 'corrente' | 'poupanca';
    holder?: string;
  };
  // Recorrência
  recurrence?: 'once' | 'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  notes?: string;
  relatedProject?: string;
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: string;
  confidence: number;
  analyzedAt: string;
  attachmentFilename?: string;
}

interface DashboardResponse {
  overdueItems: FinancialItem[];
  urgentItems: FinancialItem[];
  upcomingItems: FinancialItem[];
  recentItems: FinancialItem[];
  summary: {
    overdue: number;
    urgent: number;
    upcoming: number;
    pendingTotal: number;
  };
}

interface ItemsResponse {
  items: FinancialItem[];
  total: number;
}

interface StatsResponse {
  total: number;
  pending: number;
  overdue: number;
  paid: number;
  totalAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  paidAmount: number;
  byCategory: Record<string, { count: number; amount: number }>;
  byCreditorType: Record<string, { count: number; amount: number }>;
  upcoming: { count: number; amount: number };
}

const typeConfig = {
  boleto: { label: 'Boleto', icon: Receipt, color: 'text-blue-600 bg-blue-100' },
  fatura: { label: 'Fatura', icon: CreditCard, color: 'text-purple-600 bg-purple-100' },
  cobranca: { label: 'Cobrança', icon: DollarSign, color: 'text-orange-600 bg-orange-100' },
  nota_fiscal: { label: 'Nota Fiscal', icon: FileText, color: 'text-green-600 bg-green-100' },
  recibo: { label: 'Recibo', icon: Check, color: 'text-gray-600 bg-gray-100' },
  outro: { label: 'Outro', icon: FileText, color: 'text-gray-600 bg-gray-100' },
};

const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  paid: { label: 'Pago', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  overdue: { label: 'Vencido', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
  cancelled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800', icon: X },
  disputed: { label: 'Contestado', color: 'bg-purple-100 text-purple-800', icon: AlertCircle },
};

const categoryLabels: Record<string, string> = {
  operacional: 'Operacional',
  imposto: 'Impostos',
  folha: 'Folha de Pagamento',
  servico: 'Serviços',
  produto: 'Produtos',
  aluguel: 'Aluguel',
  utilidade: 'Utilidades',
  marketing: 'Marketing',
  juridico: 'Jurídico',
  outro: 'Outros',
};

const recurrenceLabels: Record<string, { label: string; color: string }> = {
  once: { label: 'Pagamento único', color: 'bg-gray-100 text-gray-700' },
  weekly: { label: 'Semanal', color: 'bg-blue-100 text-blue-700' },
  monthly: { label: 'Mensal', color: 'bg-green-100 text-green-700' },
  quarterly: { label: 'Trimestral', color: 'bg-amber-100 text-amber-700' },
  semiannual: { label: 'Semestral', color: 'bg-orange-100 text-orange-700' },
  annual: { label: 'Anual', color: 'bg-purple-100 text-purple-700' },
};

const pixKeyTypeLabels: Record<string, string> = {
  email: 'E-mail',
  phone: 'Telefone',
  cpf: 'CPF',
  cnpj: 'CNPJ',
  random: 'Chave aleatória',
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

function getDaysUntilDue(dueDate: string | undefined): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function Financial() {
  const queryClient = useQueryClient();
  const dialog = useDialog();
  const [selectedItem, setSelectedItem] = useState<FinancialItem | null>(null);
  const [filter, setFilter] = useState<{ status?: string; type?: string; category?: string }>({});
  const [view, setView] = useState<'dashboard' | 'list'>('dashboard');

  // Busca dashboard
  const { data: dashboard, isLoading: loadingDashboard } = useQuery({
    queryKey: ['financial-dashboard'],
    queryFn: () => apiRequest<DashboardResponse>('/financial/dashboard'),
  });

  // Busca stats
  const { data: stats } = useQuery({
    queryKey: ['financial-stats'],
    queryFn: () => apiRequest<StatsResponse>('/financial/stats'),
  });

  // Busca itens com filtros
  const { data: items, isLoading: loadingItems, refetch } = useQuery({
    queryKey: ['financial-items', filter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter.status) params.append('status', filter.status);
      if (filter.type) params.append('type', filter.type);
      if (filter.category) params.append('category', filter.category);
      const query = params.toString();
      return apiRequest<ItemsResponse>(`/financial/items${query ? `?${query}` : ''}`);
    },
    enabled: view === 'list',
  });

  // Atualiza status de itens vencidos
  const updateOverdue = useMutation({
    mutationFn: () => apiRequest('/financial/update-overdue', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['financial-items'] });
      queryClient.invalidateQueries({ queryKey: ['financial-stats'] });
    },
  });

  // Marca item como pago
  const markAsPaid = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/financial/items/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'paid' }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['financial-items'] });
      queryClient.invalidateQueries({ queryKey: ['financial-stats'] });
      dialog.success('Item marcado como pago!');
      setSelectedItem(null);
    },
    onError: () => dialog.error('Erro ao atualizar status'),
  });

  // Exclui item
  const deleteItem = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/financial/items/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['financial-items'] });
      queryClient.invalidateQueries({ queryKey: ['financial-stats'] });
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
            <DollarSign className="h-6 w-6 text-green-600" />
            Financeiro
          </h2>
          <p className="text-muted-foreground">
            Cobranças e pagamentos detectados pelo agente
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
            onClick={() => {
              updateOverdue.mutate();
              refetch();
            }}
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
            <div className="text-2xl font-bold">{stats.pending}</div>
            <div className="text-sm text-muted-foreground">{formatCurrency(stats.pendingAmount)}</div>
          </div>
          <div className="bg-card rounded-xl border p-4 border-red-200 dark:border-red-900">
            <div className="flex items-center gap-2 text-sm text-red-600 mb-1">
              <AlertTriangle className="h-4 w-4" />
              Vencidos
            </div>
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
            <div className="text-sm text-red-600">{formatCurrency(stats.overdueAmount)}</div>
          </div>
          <div className="bg-card rounded-xl border p-4 border-green-200 dark:border-green-900">
            <div className="flex items-center gap-2 text-sm text-green-600 mb-1">
              <CheckCircle className="h-4 w-4" />
              Pagos
            </div>
            <div className="text-2xl font-bold text-green-600">{stats.paid}</div>
            <div className="text-sm text-green-600">{formatCurrency(stats.paidAmount)}</div>
          </div>
          <div className="bg-card rounded-xl border p-4 border-amber-200 dark:border-amber-900">
            <div className="flex items-center gap-2 text-sm text-amber-600 mb-1">
              <Calendar className="h-4 w-4" />
              Próx. 7 dias
            </div>
            <div className="text-2xl font-bold text-amber-600">{stats.upcoming?.count || 0}</div>
            <div className="text-sm text-amber-600">{formatCurrency(stats.upcoming?.amount || 0)}</div>
          </div>
        </div>
      )}

      {view === 'dashboard' ? (
        /* Dashboard View */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Vencidos */}
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-red-50 dark:bg-red-950">
              <h3 className="font-semibold flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
                Vencidos ({dashboard?.summary.overdue || 0})
              </h3>
            </div>
            <div className="divide-y max-h-80 overflow-y-auto">
              {dashboard?.overdueItems.length === 0 && (
                <p className="p-4 text-center text-muted-foreground">Nenhum item vencido</p>
              )}
              {dashboard?.overdueItems.map((item) => (
                <ItemRow key={item.id} item={item} onClick={() => setSelectedItem(item)} />
              ))}
            </div>
          </div>

          {/* Urgentes (vence em até 3 dias) */}
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-amber-50 dark:bg-amber-950">
              <h3 className="font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <Clock className="h-5 w-5" />
                Vence em até 3 dias ({dashboard?.summary.urgent || 0})
              </h3>
            </div>
            <div className="divide-y max-h-80 overflow-y-auto">
              {dashboard?.urgentItems.length === 0 && (
                <p className="p-4 text-center text-muted-foreground">Nenhum item urgente</p>
              )}
              {dashboard?.urgentItems.map((item) => (
                <ItemRow key={item.id} item={item} onClick={() => setSelectedItem(item)} />
              ))}
            </div>
          </div>

          {/* Próximos vencimentos */}
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Próximos Vencimentos
              </h3>
            </div>
            <div className="divide-y max-h-80 overflow-y-auto">
              {dashboard?.upcomingItems.length === 0 && (
                <p className="p-4 text-center text-muted-foreground">Nenhum item próximo</p>
              )}
              {dashboard?.upcomingItems.map((item) => (
                <ItemRow key={item.id} item={item} onClick={() => setSelectedItem(item)} />
              ))}
            </div>
          </div>

          {/* Recentes */}
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <Banknote className="h-5 w-5" />
                Detectados Recentemente
              </h3>
            </div>
            <div className="divide-y max-h-80 overflow-y-auto">
              {dashboard?.recentItems.length === 0 && (
                <p className="p-4 text-center text-muted-foreground">Nenhum item recente</p>
              )}
              {dashboard?.recentItems.map((item) => (
                <ItemRow key={item.id} item={item} onClick={() => setSelectedItem(item)} />
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
              <option value="pending">Pendentes</option>
              <option value="overdue">Vencidos</option>
              <option value="paid">Pagos</option>
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
              value={filter.category || ''}
              onChange={(e) => setFilter({ ...filter, category: e.target.value || undefined })}
              className="px-3 py-2 border rounded-lg bg-background"
            >
              <option value="">Todas as categorias</option>
              {Object.entries(categoryLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            {(filter.status || filter.type || filter.category) && (
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

      {/* Modal de Detalhes Melhorado */}
      {selectedItem && (
        <FinancialDetailsModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onMarkAsPaid={() => markAsPaid.mutate(selectedItem.id)}
          onDelete={() => deleteItem.mutate(selectedItem.id)}
          isPending={markAsPaid.isPending}
          isDeleting={deleteItem.isPending}
        />
      )}
    </div>
  );
}

// Componente de linha de item
function ItemRow({ item, onClick, showStatus }: { item: FinancialItem; onClick: () => void; showStatus?: boolean }) {
  const TypeIcon = typeConfig[item.type]?.icon || FileText;
  const daysUntil = getDaysUntilDue(item.dueDate);

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
          <p className="font-medium truncate">{item.creditor}</p>
          {item.recurrence && item.recurrence !== 'once' && (
            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", recurrenceLabels[item.recurrence]?.color || 'bg-gray-100 text-gray-700')}>
              {recurrenceLabels[item.recurrence]?.label || item.recurrence}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">{item.description}</p>
        {item.relatedProject && (
          <p className="text-xs text-blue-600 truncate">📁 {item.relatedProject}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="font-semibold">{formatCurrency(item.amount)}</p>
        {item.dueDate && (
          <p className={cn(
            "text-xs",
            daysUntil !== null && daysUntil < 0 ? "text-red-600" :
            daysUntil !== null && daysUntil <= 3 ? "text-amber-600" :
            "text-muted-foreground"
          )}>
            {daysUntil !== null && daysUntil < 0 
              ? `Vencido há ${Math.abs(daysUntil)} dia(s)` 
              : daysUntil === 0 
              ? 'Vence hoje'
              : daysUntil === 1
              ? 'Vence amanhã'
              : `Vence em ${daysUntil} dias`}
          </p>
        )}
        {showStatus && (
          <span className={cn("text-xs px-1.5 py-0.5 rounded", statusConfig[item.status]?.color || 'bg-gray-100 text-gray-800')}>
            {statusConfig[item.status]?.label || item.status}
          </span>
        )}
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </button>
  );
}

// Modal de detalhes completo
function FinancialDetailsModal({ 
  item, 
  onClose, 
  onMarkAsPaid,
  onDelete,
  isPending,
  isDeleting
}: { 
  item: FinancialItem; 
  onClose: () => void; 
  onMarkAsPaid: () => void;
  onDelete: () => void;
  isPending: boolean;
  isDeleting: boolean;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl border shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-card z-10">
          <h3 className="font-semibold text-lg">Detalhes da Cobrança</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Status, Tipo, Categoria e Recorrência */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("px-2 py-1 rounded text-xs font-medium", statusConfig[item.status]?.color || 'bg-gray-100 text-gray-800')}>
              {statusConfig[item.status]?.label || item.status}
            </span>
            <span className={cn("px-2 py-1 rounded text-xs font-medium", typeConfig[item.type]?.color || 'text-gray-600 bg-gray-100')}>
              {typeConfig[item.type]?.label || item.type}
            </span>
            {item.category && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-muted">
                {categoryLabels[item.category] || item.category}
              </span>
            )}
            {item.recurrence && (
              <span className={cn("px-2 py-1 rounded text-xs font-medium flex items-center gap-1", recurrenceLabels[item.recurrence]?.color || 'bg-gray-100 text-gray-700')}>
                <Repeat className="h-3 w-3" />
                {recurrenceLabels[item.recurrence]?.label || item.recurrence}
              </span>
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
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(item.emailDate)}
                    </p>
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

          {/* Valor Principal */}
          <div className="text-center py-5 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-xl border border-green-200 dark:border-green-800">
            <p className="text-sm text-muted-foreground">Valor</p>
            <p className="text-4xl font-bold text-green-700 dark:text-green-400">{formatCurrency(item.amount)}</p>
            {item.installmentCurrent && item.installmentTotal && (
              <p className="text-sm text-muted-foreground mt-1">
                Parcela {item.installmentCurrent} de {item.installmentTotal}
              </p>
            )}
          </div>

          {/* Grid Principal: Credor + Datas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Credor */}
            <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-xl">
              <Building2 className="h-8 w-8 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-lg">{item.creditor}</p>
                {item.creditorDocument && (
                  <p className="text-sm text-muted-foreground font-mono">{item.creditorDocument}</p>
                )}
                {item.creditorType && (
                  <p className="text-xs text-muted-foreground capitalize mt-1">{item.creditorType}</p>
                )}
              </div>
            </div>

            {/* Datas */}
            <div className="p-4 bg-muted/30 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Vencimento</span>
                </div>
                <span className={cn(
                  "font-semibold",
                  item.status === 'overdue' && "text-red-600"
                )}>
                  {formatDate(item.dueDate)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Emissão</span>
                </div>
                <span className="font-medium">{formatDate(item.issueDate)}</span>
              </div>
              {item.competenceDate && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Competência</span>
                  </div>
                  <span className="font-medium">{item.competenceDate}</span>
                </div>
              )}
            </div>
          </div>

          {/* Descrição */}
          <div className="p-4 bg-muted/20 rounded-xl">
            <p className="text-sm text-muted-foreground mb-1">Descrição</p>
            <p className="text-base">{item.description}</p>
          </div>

          {/* Projeto Relacionado */}
          {item.relatedProject && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <FolderKanban className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Projeto/Operação</p>
                <p className="font-medium">{item.relatedProject}</p>
              </div>
            </div>
          )}

          {/* Formas de Pagamento */}
          {(item.barcodeData || item.pixKey || item.bankAccount) && (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Formas de Pagamento
              </h4>

              {/* Código de Barras */}
              {item.barcodeData && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-slate-600" />
                      <p className="text-sm font-medium">Código de Barras / Linha Digitável</p>
                    </div>
                    <CopyButton text={item.barcodeData} field="barcode" />
                  </div>
                  <code className="block p-3 bg-white dark:bg-slate-800 rounded-lg text-sm font-mono break-all border">
                    {item.barcodeData}
                  </code>
                </div>
              )}

              {/* PIX */}
              {item.pixKey && (
                <div className="p-4 bg-teal-50 dark:bg-teal-950 rounded-xl border border-teal-200 dark:border-teal-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <QrCode className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                      <p className="text-sm font-medium text-teal-800 dark:text-teal-200">Chave PIX</p>
                      {item.pixKeyType && (
                        <span className="text-xs px-2 py-0.5 bg-teal-100 dark:bg-teal-900 rounded text-teal-700 dark:text-teal-300">
                          {pixKeyTypeLabels[item.pixKeyType] || item.pixKeyType}
                        </span>
                      )}
                    </div>
                    <CopyButton text={item.pixKey} field="pix" />
                  </div>
                  <code className="block p-3 bg-white dark:bg-teal-900/50 rounded-lg text-sm font-mono break-all border border-teal-200 dark:border-teal-700">
                    {item.pixKey}
                  </code>
                </div>
              )}

              {/* Dados Bancários */}
              {item.bankAccount && (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950 rounded-xl border border-indigo-200 dark:border-indigo-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Landmark className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <p className="text-sm font-medium text-indigo-800 dark:text-indigo-200">Transferência Bancária</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Banco</p>
                      <p className="font-medium">{item.bankAccount.bank}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Agência</p>
                      <p className="font-mono font-medium">{item.bankAccount.agency}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Conta</p>
                      <p className="font-mono font-medium">{item.bankAccount.account}</p>
                    </div>
                    {item.bankAccount.accountType && (
                      <div>
                        <p className="text-muted-foreground text-xs">Tipo</p>
                        <p className="font-medium capitalize">{item.bankAccount.accountType}</p>
                      </div>
                    )}
                    {item.bankAccount.holder && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground text-xs">Titular</p>
                        <p className="font-medium">{item.bankAccount.holder}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Informações Adicionais */}
          {(item.reference || item.notes || item.attachmentFilename) && (
            <div className="space-y-3 pt-2">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Informações Adicionais
              </h4>

              {item.reference && (
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm text-muted-foreground">Referência</span>
                  <span className="font-medium font-mono">{item.reference}</span>
                </div>
              )}

              {item.attachmentFilename && (
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm text-muted-foreground">Anexo analisado</span>
                  <span className="font-medium text-sm">{item.attachmentFilename}</span>
                </div>
              )}

              {item.notes && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-1">Observações</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">{item.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Metadados */}
          <div className="text-xs text-muted-foreground flex items-center justify-between pt-2 border-t">
            <span>Analisado em {formatDate(item.analyzedAt)}</span>
            <span>Confiança: {item.confidence}%</span>
          </div>

          {/* Ações */}
          <div className="pt-4 border-t flex gap-3">
            {item.status !== 'paid' && (
              <button
                onClick={onMarkAsPaid}
                disabled={isPending || isDeleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
              >
                <CheckCircle className="h-5 w-5" />
                {isPending ? 'Salvando...' : 'Marcar como Pago'}
              </button>
            )}
            <button
              onClick={onDelete}
              disabled={isPending || isDeleting}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 font-medium transition-colors"
            >
              <X className="h-5 w-5" />
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

