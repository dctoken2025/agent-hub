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
  ExternalLink
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
  priority: 'urgent' | 'high' | 'normal' | 'low';
  notes?: string;
  relatedProject?: string;
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: string;
  confidence: number;
  analyzedAt: string;
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

      {/* Modal de Detalhes */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-card">
              <h3 className="font-semibold text-lg">Detalhes da Cobrança</h3>
              <button onClick={() => setSelectedItem(null)} className="p-1 hover:bg-muted rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Status e Tipo */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("px-2 py-1 rounded text-xs font-medium", statusConfig[selectedItem.status]?.color || 'bg-gray-100 text-gray-800')}>
                  {statusConfig[selectedItem.status]?.label || selectedItem.status}
                </span>
                <span className={cn("px-2 py-1 rounded text-xs font-medium", typeConfig[selectedItem.type]?.color || 'text-gray-600 bg-gray-100')}>
                  {typeConfig[selectedItem.type]?.label || selectedItem.type}
                </span>
                {selectedItem.category && (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-muted">
                    {categoryLabels[selectedItem.category] || selectedItem.category}
                  </span>
                )}
              </div>

              {/* Email de origem */}
              {(selectedItem.emailSubject || selectedItem.emailFrom) && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Detectado no email:</p>
                      {selectedItem.emailSubject && (
                        <p className="font-medium text-sm truncate">{selectedItem.emailSubject}</p>
                      )}
                      {selectedItem.emailFrom && (
                        <p className="text-sm text-muted-foreground">De: {selectedItem.emailFrom}</p>
                      )}
                      {selectedItem.emailDate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(selectedItem.emailDate)}
                        </p>
                      )}
                    </div>
                    <a
                      href={`/emails?id=${selectedItem.emailId}`}
                      className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900 rounded text-blue-600 dark:text-blue-400"
                      title="Ver email"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              )}

              {/* Valor */}
              <div className="text-center py-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Valor</p>
                <p className="text-3xl font-bold">{formatCurrency(selectedItem.amount)}</p>
                {selectedItem.installmentCurrent && selectedItem.installmentTotal && (
                  <p className="text-sm text-muted-foreground">
                    Parcela {selectedItem.installmentCurrent} de {selectedItem.installmentTotal}
                  </p>
                )}
              </div>

              {/* Credor */}
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <Building2 className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{selectedItem.creditor}</p>
                  {selectedItem.creditorDocument && (
                    <p className="text-sm text-muted-foreground">{selectedItem.creditorDocument}</p>
                  )}
                  {selectedItem.creditorType && (
                    <p className="text-xs text-muted-foreground capitalize">{selectedItem.creditorType}</p>
                  )}
                </div>
              </div>

              {/* Descrição */}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Descrição</p>
                <p>{selectedItem.description}</p>
              </div>

              {/* Datas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Vencimento</p>
                  <p className="font-medium">{formatDate(selectedItem.dueDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Emissão</p>
                  <p className="font-medium">{formatDate(selectedItem.issueDate)}</p>
                </div>
              </div>

              {/* Código de Barras */}
              {selectedItem.barcodeData && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Código de Barras</p>
                  <code className="block p-2 bg-muted rounded text-xs break-all">{selectedItem.barcodeData}</code>
                </div>
              )}

              {/* Referência */}
              {selectedItem.reference && (
                <div>
                  <p className="text-sm text-muted-foreground">Referência</p>
                  <p className="font-medium">{selectedItem.reference}</p>
                </div>
              )}

              {/* Notas */}
              {selectedItem.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Observações</p>
                  <p className="text-sm">{selectedItem.notes}</p>
                </div>
              )}

              {/* Ações */}
              {selectedItem.status !== 'paid' && (
                <div className="pt-4 border-t flex gap-2">
                  <button
                    onClick={() => markAsPaid.mutate(selectedItem.id)}
                    disabled={markAsPaid.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {markAsPaid.isPending ? 'Salvando...' : 'Marcar como Pago'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
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
        <p className="font-medium truncate">{item.creditor}</p>
        <p className="text-sm text-muted-foreground truncate">{item.description}</p>
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
