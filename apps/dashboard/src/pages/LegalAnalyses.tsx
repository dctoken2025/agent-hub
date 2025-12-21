import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  Users,
  DollarSign,
  RefreshCw,
  Scale,
  FileWarning,
  ChevronRight,
  X,
  Shield,
  Gavel,
  Clock,
  Zap,
  Trash2,
  Check,
  RotateCcw,
  PlayCircle,
  Mail,
  ExternalLink
} from 'lucide-react';
import { useState } from 'react';
import { cn, apiRequest } from '@/lib/utils';
import { useDialog } from '@/components/Dialog';

interface LegalAnalysis {
  id: number;
  emailId: string;
  documentName: string;
  documentType: string;
  parties: string;
  summary: string;
  keyDates: Array<{ description: string; date: string }> | null;
  financialTerms: Array<{ description: string; value: string }> | null;
  criticalClauses: Array<{
    type: string;
    title: string;
    content: string;
    risk: string;
    analysis: string;
    suggestion?: string;
  }> | null;
  risks: Array<{
    level: string;
    description: string;
    clause: string;
    recommendation: string;
  }> | null;
  suggestions: string[] | null;
  overallRisk: string;
  requiresAttention: boolean;
  analyzedAt: string;
  // Campos para ações e responsáveis
  requiredAction?: 'approve' | 'sign' | 'review' | 'negotiate' | 'reject' | 'none';
  actionDescription?: string;
  responsibleParties?: Array<{
    name: string;
    role: string;
    action: string;
  }>;
  actionDeadline?: string;
  isUrgent?: boolean;
  nextSteps?: string[];
  // Campos de status/resolução
  status?: 'pending' | 'in_progress' | 'resolved';
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  threadId?: string;
  groupId?: string;
}

const actionConfig = {
  approve: { label: 'Aprovar', icon: '✅', color: 'bg-green-500', bgLight: 'bg-green-50 dark:bg-green-950' },
  sign: { label: 'Assinar', icon: '✍️', color: 'bg-blue-500', bgLight: 'bg-blue-50 dark:bg-blue-950' },
  review: { label: 'Revisar', icon: '👀', color: 'bg-yellow-500', bgLight: 'bg-yellow-50 dark:bg-yellow-950' },
  negotiate: { label: 'Negociar', icon: '🤝', color: 'bg-purple-500', bgLight: 'bg-purple-50 dark:bg-purple-950' },
  reject: { label: 'Rejeitar', icon: '❌', color: 'bg-red-500', bgLight: 'bg-red-50 dark:bg-red-950' },
  none: { label: 'Informativo', icon: '📄', color: 'bg-gray-500', bgLight: 'bg-gray-50 dark:bg-gray-950' },
};

interface AnalysesResponse {
  analyses: LegalAnalysis[];
  total: number;
}

interface StatsResponse {
  total: number;
  byRisk: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byStatus: {
    pending: number;
    in_progress: number;
    resolved: number;
  };
  requiresAttention: number;
}

const statusConfig = {
  pending: { 
    label: 'Pendente', 
    color: 'bg-amber-500', 
    textColor: 'text-amber-600',
    bgLight: 'bg-amber-50 dark:bg-amber-950',
  },
  in_progress: { 
    label: 'Em Andamento', 
    color: 'bg-blue-500', 
    textColor: 'text-blue-600',
    bgLight: 'bg-blue-50 dark:bg-blue-950',
  },
  resolved: { 
    label: 'Resolvido', 
    color: 'bg-green-500', 
    textColor: 'text-green-600',
    bgLight: 'bg-green-50 dark:bg-green-950',
  },
};

const riskConfig = {
  critical: { 
    label: 'Crítico', 
    color: 'bg-red-600', 
    textColor: 'text-red-600', 
    bgLight: 'bg-red-50 dark:bg-red-950',
    borderColor: 'border-red-200 dark:border-red-800',
    icon: XCircle 
  },
  high: { 
    label: 'Alto', 
    color: 'bg-orange-500', 
    textColor: 'text-orange-500', 
    bgLight: 'bg-orange-50 dark:bg-orange-950',
    borderColor: 'border-orange-200 dark:border-orange-800',
    icon: AlertTriangle 
  },
  medium: { 
    label: 'Médio', 
    color: 'bg-yellow-500', 
    textColor: 'text-yellow-500', 
    bgLight: 'bg-yellow-50 dark:bg-yellow-950',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    icon: FileWarning 
  },
  low: { 
    label: 'Baixo', 
    color: 'bg-green-500', 
    textColor: 'text-green-500', 
    bgLight: 'bg-green-50 dark:bg-green-950',
    borderColor: 'border-green-200 dark:border-green-800',
    icon: CheckCircle 
  },
};

export function LegalAnalyses() {
  const queryClient = useQueryClient();
  const dialog = useDialog();
  const [selectedAnalysis, setSelectedAnalysis] = useState<LegalAnalysis | null>(null);
  const [filterRisk, setFilterRisk] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('pending'); // Padrão: mostrar pendentes
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['legalAnalyses', filterStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterStatus && filterStatus !== 'all') {
        params.set('status', filterStatus);
      }
      const queryString = params.toString();
      return apiRequest<AnalysesResponse>(`/legal/analyses${queryString ? `?${queryString}` : ''}`);
    },
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ['legalStats'],
    queryFn: () => apiRequest<StatsResponse>('/legal/stats'),
    refetchInterval: 30000,
  });

  // Busca análises relacionadas por thread quando uma análise é selecionada
  const { data: relatedAnalyses } = useQuery({
    queryKey: ['relatedAnalyses', selectedAnalysis?.threadId],
    queryFn: () => {
      if (!selectedAnalysis?.threadId) return null;
      return apiRequest<{ analyses: LegalAnalysis[]; count: number }>(`/legal/analyses/thread/${selectedAnalysis.threadId}`);
    },
    enabled: !!selectedAnalysis?.threadId && showModal,
  });

  const reprocessMutation = useMutation({
    mutationFn: (limit: number) => 
      apiRequest<{ success: boolean; totalAnalysesGenerated: number }>('/emails/reprocess-contracts', {
        method: 'POST',
        body: JSON.stringify({ limit }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['legalAnalyses'] });
      queryClient.invalidateQueries({ queryKey: ['legalStats'] });
      dialog.success(`Processamento concluído! ${data.totalAnalysesGenerated} análise(s) gerada(s)`);
    },
    onError: (error: Error) => {
      dialog.error(error.message);
    },
  });

  const removeDuplicatesMutation = useMutation({
    mutationFn: () => 
      apiRequest<{ success: boolean; message: string; removed: number }>('/legal/duplicates', {
        method: 'DELETE',
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['legalAnalyses'] });
      queryClient.invalidateQueries({ queryKey: ['legalStats'] });
      if (data.removed > 0) {
        dialog.success(`${data.removed} registro(s) duplicado(s) removido(s) com sucesso!`);
      } else {
        dialog.alert('Nenhum registro duplicado encontrado para remover.', { type: 'info', title: 'Informação' });
      }
    },
    onError: (error: Error) => {
      dialog.error(error.message);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: number; status: string; notes?: string }) =>
      apiRequest<{ success: boolean }>(`/legal/analyses/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['legalAnalyses'] });
      queryClient.invalidateQueries({ queryKey: ['legalStats'] });
      const statusLabel = statusConfig[variables.status as keyof typeof statusConfig]?.label || variables.status;
      dialog.success(`Análise marcada como "${statusLabel}"!`);
      setShowModal(false);
    },
    onError: (error: Error) => {
      dialog.error(error.message);
    },
  });

  const analyses = data?.analyses || [];
  const filteredAnalyses = filterRisk
    ? analyses.filter(a => a.overallRisk === filterRisk)
    : analyses;

  const getRiskConfig = (risk: string) => {
    return riskConfig[risk as keyof typeof riskConfig] || riskConfig.medium;
  };

  const openDetail = (analysis: LegalAnalysis) => {
    setSelectedAnalysis(analysis);
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            Análises Jurídicas
          </h2>
          <p className="text-muted-foreground">
            Contratos e documentos analisados automaticamente pelo Agente Jurídico
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => reprocessMutation.mutate(5)}
            disabled={reprocessMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {reprocessMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {reprocessMutation.isPending ? 'Processando...' : 'Processar Contratos'}
          </button>
          <button
            onClick={async () => {
              const confirmed = await dialog.confirm(
                'Apenas a versão mais recente de cada documento será mantida.',
                { title: 'Remover registros duplicados?' }
              );
              if (confirmed) {
                removeDuplicatesMutation.mutate();
              }
            }}
            disabled={removeDuplicatesMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
            title="Remover duplicados"
          >
            {removeDuplicatesMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {removeDuplicatesMutation.isPending ? 'Removendo...' : 'Limpar Duplicados'}
          </button>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 bg-card rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{stats?.total || 0}</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-card rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Crítico</p>
              <p className="text-2xl font-bold text-red-600">{stats?.byRisk.critical || 0}</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-card rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Alto</p>
              <p className="text-2xl font-bold text-orange-600">{stats?.byRisk.high || 0}</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-card rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Atenção</p>
              <p className="text-2xl font-bold text-yellow-600">{stats?.requiresAttention || 0}</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-card rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Baixo</p>
              <p className="text-2xl font-bold text-green-600">{stats?.byRisk.low || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-lg w-fit">
        <button
          onClick={() => setFilterStatus('pending')}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-all",
            filterStatus === 'pending'
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          📋 Pendentes ({stats?.byStatus?.pending || 0})
        </button>
        <button
          onClick={() => setFilterStatus('in_progress')}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-all",
            filterStatus === 'in_progress'
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          🔄 Em Andamento ({stats?.byStatus?.in_progress || 0})
        </button>
        <button
          onClick={() => setFilterStatus('resolved')}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-all",
            filterStatus === 'resolved'
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          ✅ Resolvidos ({stats?.byStatus?.resolved || 0})
        </button>
        <button
          onClick={() => setFilterStatus('all')}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-all",
            filterStatus === 'all'
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Todos ({stats?.total || 0})
        </button>
      </div>

      {/* Risk Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground mr-2">Filtrar por risco:</span>
        <button
          onClick={() => setFilterRisk(null)}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
            !filterRisk
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          Todos ({analyses.length})
        </button>
        {Object.entries(riskConfig).map(([key, config]) => {
          const count = analyses.filter(a => a.overallRisk === key).length;
          return (
            <button
              key={key}
              onClick={() => setFilterRisk(key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5",
                filterRisk === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              <span className={`h-2 w-2 rounded-full ${config.color}`} />
              {config.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredAnalyses.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border">
          <Scale className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-xl font-semibold">Nenhuma análise encontrada</p>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Clique em "Processar Contratos" para analisar emails com anexos PDF/DOCX
          </p>
          <button
            onClick={() => reprocessMutation.mutate(10)}
            disabled={reprocessMutation.isPending}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {reprocessMutation.isPending ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <Zap className="h-5 w-5" />
            )}
            {reprocessMutation.isPending ? 'Processando...' : 'Processar Contratos Agora'}
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredAnalyses.map((analysis) => {
            const risk = getRiskConfig(analysis.overallRisk);
            const RiskIcon = risk.icon;
            
            return (
              <div
                key={analysis.id}
                onClick={() => openDetail(analysis)}
                className={cn(
                  "p-5 bg-card rounded-xl border cursor-pointer hover:shadow-lg transition-all group",
                  risk.borderColor
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Risk Icon */}
                  <div className={cn("p-3 rounded-xl", risk.bgLight)}>
                    <RiskIcon className={cn("h-6 w-6", risk.textColor)} />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-semibold text-white",
                        risk.color
                      )}>
                        Risco {risk.label}
                      </span>
                      {/* Ação necessária */}
                      {analysis.requiredAction && analysis.requiredAction !== 'none' && (
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-semibold text-white",
                          actionConfig[analysis.requiredAction]?.color || 'bg-gray-500'
                        )}>
                          {actionConfig[analysis.requiredAction]?.icon} {actionConfig[analysis.requiredAction]?.label}
                        </span>
                      )}
                      {analysis.isUrgent && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 animate-pulse">
                          🚨 URGENTE
                        </span>
                      )}
                      {analysis.requiresAttention && !analysis.isUrgent && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                          ⚠️ Atenção
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(analysis.analyzedAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    
                    <h3 className="font-semibold text-lg mt-2 group-hover:text-primary transition-colors">
                      {analysis.documentName}
                    </h3>
                    <p className="text-sm text-muted-foreground">{analysis.documentType}</p>
                    
                    {/* Descrição da ação */}
                    {analysis.actionDescription && (
                      <p className="text-sm mt-2 font-medium text-primary">
                        📋 {analysis.actionDescription}
                      </p>
                    )}
                    
                    <p className="text-sm mt-2 line-clamp-2 text-muted-foreground">
                      {analysis.summary}
                    </p>
                    
                    {/* Responsáveis */}
                    {analysis.responsibleParties && analysis.responsibleParties.length > 0 && (
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <span className="text-xs text-muted-foreground">👥 Responsáveis:</span>
                        {analysis.responsibleParties.slice(0, 3).map((party, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs">
                            {party.name} ({party.role})
                          </span>
                        ))}
                        {analysis.responsibleParties.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{analysis.responsibleParties.length - 3} mais
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* Quick Stats */}
                    <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                      {analysis.criticalClauses && analysis.criticalClauses.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Gavel className="h-3.5 w-3.5" />
                          {analysis.criticalClauses.length} cláusulas críticas
                        </span>
                      )}
                      {analysis.risks && analysis.risks.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Shield className="h-3.5 w-3.5" />
                          {analysis.risks.length} riscos
                        </span>
                      )}
                      {analysis.financialTerms && analysis.financialTerms.length > 0 && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5" />
                          {analysis.financialTerms.length} termos financeiros
                        </span>
                      )}
                      {analysis.actionDeadline && (
                        <span className="flex items-center gap-1 text-orange-600">
                          <Clock className="h-3.5 w-3.5" />
                          Prazo: {analysis.actionDeadline}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex flex-col items-end gap-2">
                    {/* Status Badge */}
                    {analysis.status === 'resolved' ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Resolvido
                      </span>
                    ) : analysis.status === 'in_progress' ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 flex items-center gap-1">
                        <PlayCircle className="h-3 w-3" /> Em Andamento
                      </span>
                    ) : null}
                    
                    {/* Quick Action Button */}
                    {(!analysis.status || analysis.status === 'pending') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateStatusMutation.mutate({ id: analysis.id, status: 'resolved' });
                        }}
                        disabled={updateStatusMutation.isPending}
                        className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100"
                      >
                        <Check className="h-3 w-3" />
                        Resolvido
                      </button>
                    )}
                    
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {showModal && selectedAnalysis && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl border shadow-2xl w-full max-w-4xl my-8 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className={cn("p-6 border-b rounded-t-2xl", getRiskConfig(selectedAnalysis.overallRisk).bgLight)}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={cn("p-3 rounded-xl bg-white dark:bg-gray-800 shadow-sm")}>
                    {(() => {
                      const RiskIcon = getRiskConfig(selectedAnalysis.overallRisk).icon;
                      return <RiskIcon className={cn("h-8 w-8", getRiskConfig(selectedAnalysis.overallRisk).textColor)} />;
                    })()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-sm font-semibold text-white",
                        getRiskConfig(selectedAnalysis.overallRisk).color
                      )}>
                        Risco {getRiskConfig(selectedAnalysis.overallRisk).label}
                      </span>
                      {selectedAnalysis.requiredAction && selectedAnalysis.requiredAction !== 'none' && (
                        <span className={cn(
                          "px-3 py-1 rounded-full text-sm font-semibold text-white",
                          actionConfig[selectedAnalysis.requiredAction]?.color || 'bg-gray-500'
                        )}>
                          {actionConfig[selectedAnalysis.requiredAction]?.icon} {actionConfig[selectedAnalysis.requiredAction]?.label}
                        </span>
                      )}
                      {selectedAnalysis.isUrgent && (
                        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-red-500 text-white animate-pulse">
                          🚨 URGENTE
                        </span>
                      )}
                      {selectedAnalysis.requiresAttention && !selectedAnalysis.isUrgent && (
                        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-amber-100 text-amber-800">
                          ⚠️ Atenção
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold">{selectedAnalysis.documentName}</h2>
                    <p className="text-muted-foreground">{selectedAnalysis.documentType}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-black/10 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {/* Modal Content */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Ação Necessária - Destaque */}
              {selectedAnalysis.requiredAction && selectedAnalysis.requiredAction !== 'none' && (
                <div className={cn(
                  "p-4 rounded-xl border-2",
                  selectedAnalysis.isUrgent 
                    ? "bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-700" 
                    : actionConfig[selectedAnalysis.requiredAction]?.bgLight + " border-primary/30"
                )}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold flex items-center gap-2 text-lg">
                      <span className="text-2xl">{actionConfig[selectedAnalysis.requiredAction]?.icon}</span>
                      Ação Necessária: {actionConfig[selectedAnalysis.requiredAction]?.label}
                    </h4>
                    {selectedAnalysis.isUrgent && (
                      <span className="px-3 py-1 rounded-full text-sm font-bold bg-red-500 text-white animate-pulse">
                        🚨 URGENTE
                      </span>
                    )}
                  </div>
                  {selectedAnalysis.actionDescription && (
                    <p className="text-sm font-medium mb-3">{selectedAnalysis.actionDescription}</p>
                  )}
                  {selectedAnalysis.actionDeadline && (
                    <p className="text-sm flex items-center gap-2 text-orange-600 dark:text-orange-400">
                      <Clock className="h-4 w-4" />
                      <strong>Prazo:</strong> {selectedAnalysis.actionDeadline}
                    </p>
                  )}
                </div>
              )}

              {/* Responsáveis */}
              {selectedAnalysis.responsibleParties && selectedAnalysis.responsibleParties.length > 0 && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-xl border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold flex items-center gap-2 mb-3 text-blue-800 dark:text-blue-200">
                    <Users className="h-4 w-4" />
                    Responsáveis pela Análise/Aprovação
                  </h4>
                  <div className="space-y-2">
                    {selectedAnalysis.responsibleParties.map((party, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-white/50 dark:bg-black/20 rounded-lg">
                        <div>
                          <span className="font-medium">{party.name}</span>
                          <span className="text-sm text-muted-foreground ml-2">({party.role})</span>
                        </div>
                        <span className="text-sm text-blue-600 dark:text-blue-400">{party.action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Próximos Passos */}
              {selectedAnalysis.nextSteps && selectedAnalysis.nextSteps.length > 0 && (
                <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-xl border border-purple-200 dark:border-purple-800">
                  <h4 className="font-semibold flex items-center gap-2 mb-3 text-purple-800 dark:text-purple-200">
                    📋 Próximos Passos
                  </h4>
                  <ol className="space-y-2">
                    {selectedAnalysis.nextSteps.map((step, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-200 dark:bg-purple-800 flex items-center justify-center text-xs font-bold">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Summary */}
              <div className="p-4 bg-secondary/30 rounded-xl">
                <h4 className="font-semibold flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-primary" />
                  Resumo Executivo
                </h4>
                <p className="text-sm leading-relaxed">{selectedAnalysis.summary}</p>
              </div>

              {/* Two Column Layout */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Parties */}
                {selectedAnalysis.parties && (
                  <div className="p-4 bg-secondary/30 rounded-xl">
                    <h4 className="font-semibold flex items-center gap-2 mb-4">
                      <Users className="h-4 w-4 text-primary" />
                      Partes Envolvidas
                    </h4>
                    <div className="space-y-2">
                      {selectedAnalysis.parties.split(/,\s*(?=[A-Z])/).map((party, i) => {
                        // Tenta extrair nome e papel da parte (ex: "Empresa X (Cedente)")
                        const match = party.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
                        const roleColors: Record<string, string> = {
                          'Emissora': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
                          'Securitizadora': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
                          'Cedente': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
                          'Agente de Cobrança': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
                          'Agente Fiduciário': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                          'Gestora': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
                          'Plataforma de Crowdfunding': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
                        };
                        
                        if (match) {
                          const [, name, role] = match;
                          const roleColor = Object.entries(roleColors).find(([key]) => 
                            role.toLowerCase().includes(key.toLowerCase())
                          )?.[1] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
                          
                          return (
                            <div key={i} className="p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-border/50">
                              <div className="flex flex-col gap-1.5">
                                <span className="font-medium text-sm leading-tight">{name.trim()}</span>
                                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium w-fit", roleColor)}>
                                  {role.trim()}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        
                        return (
                          <div key={i} className="p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-border/50">
                            <span className="text-sm">{party.trim()}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Key Dates */}
                {selectedAnalysis.keyDates && selectedAnalysis.keyDates.length > 0 && (
                  <div className="p-4 bg-secondary/30 rounded-xl">
                    <h4 className="font-semibold flex items-center gap-2 mb-4">
                      <Calendar className="h-4 w-4 text-primary" />
                      Datas Importantes
                    </h4>
                    <div className="space-y-2">
                      {selectedAnalysis.keyDates.map((date, i) => {
                        // Determina se é uma data de prazo ou valor específico
                        const isDeadline = date.description.toLowerCase().includes('prazo') || 
                                          date.description.toLowerCase().includes('período') ||
                                          date.description.toLowerCase().includes('intervalo');
                        const isEmission = date.description.toLowerCase().includes('emissão') ||
                                          date.description.toLowerCase().includes('vencimento');
                        
                        const iconBg = isDeadline 
                          ? 'bg-orange-100 dark:bg-orange-900' 
                          : isEmission 
                            ? 'bg-blue-100 dark:bg-blue-900'
                            : 'bg-gray-100 dark:bg-gray-800';
                        const iconColor = isDeadline 
                          ? 'text-orange-600 dark:text-orange-400' 
                          : isEmission 
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-600 dark:text-gray-400';
                        
                        return (
                          <div key={i} className="p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-border/50">
                            <div className="flex items-start gap-3">
                              <div className={cn("p-1.5 rounded-lg flex-shrink-0", iconBg)}>
                                {isDeadline ? (
                                  <Clock className={cn("h-3.5 w-3.5", iconColor)} />
                                ) : (
                                  <Calendar className={cn("h-3.5 w-3.5", iconColor)} />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground leading-tight mb-1">
                                  {date.description}
                                </p>
                                <p className="text-sm font-semibold text-foreground">
                                  {date.date}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Financial Terms */}
              {selectedAnalysis.financialTerms && selectedAnalysis.financialTerms.length > 0 && (
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-xl border border-green-200 dark:border-green-800">
                  <h4 className="font-semibold flex items-center gap-2 mb-3 text-green-800 dark:text-green-200">
                    <DollarSign className="h-4 w-4" />
                    Termos Financeiros
                  </h4>
                  <div className="grid md:grid-cols-2 gap-3">
                    {selectedAnalysis.financialTerms.map((term, i) => (
                      <div key={i} className="flex justify-between text-sm p-2 bg-white/50 dark:bg-black/20 rounded-lg">
                        <span className="text-muted-foreground">{term.description}</span>
                        <span className="font-semibold text-green-700 dark:text-green-300">{term.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Critical Clauses */}
              {selectedAnalysis.criticalClauses && selectedAnalysis.criticalClauses.length > 0 && (
                <div>
                  <h4 className="font-semibold flex items-center gap-2 mb-3">
                    <Gavel className="h-4 w-4 text-primary" />
                    Cláusulas Críticas ({selectedAnalysis.criticalClauses.length})
                  </h4>
                  <div className="space-y-3">
                    {selectedAnalysis.criticalClauses.map((clause, i) => {
                      const clauseRisk = getRiskConfig(clause.risk);
                      return (
                        <div key={i} className={cn("p-4 rounded-xl border", clauseRisk.borderColor, clauseRisk.bgLight)}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={cn("px-2 py-0.5 rounded text-xs font-semibold text-white", clauseRisk.color)}>
                              {clauseRisk.label}
                            </span>
                            <span className="font-medium text-sm">{clause.type}</span>
                          </div>
                          <p className="text-sm mb-2">{clause.content}</p>
                          <p className="text-xs text-muted-foreground mb-2">
                            <strong>Análise:</strong> {clause.analysis}
                          </p>
                          {clause.suggestion && (
                            <p className="text-xs text-primary font-medium">
                              💡 {clause.suggestion}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Risks */}
              {selectedAnalysis.risks && selectedAnalysis.risks.length > 0 && (
                <div>
                  <h4 className="font-semibold flex items-center gap-2 mb-3">
                    <Shield className="h-4 w-4 text-primary" />
                    Riscos Identificados ({selectedAnalysis.risks.length})
                  </h4>
                  <div className="grid md:grid-cols-2 gap-3">
                    {selectedAnalysis.risks.map((risk, i) => {
                      const riskCfg = getRiskConfig(risk.level);
                      return (
                        <div key={i} className={cn("p-4 rounded-xl border", riskCfg.borderColor, riskCfg.bgLight)}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={cn("px-2 py-0.5 rounded text-xs font-semibold text-white", riskCfg.color)}>
                              {riskCfg.label}
                            </span>
                          </div>
                          <p className="text-sm font-medium mb-1">{risk.description}</p>
                          <p className="text-xs text-muted-foreground">
                            <strong>Cláusula:</strong> {risk.clause}
                          </p>
                          <p className="text-xs text-primary font-medium mt-2">
                            💡 {risk.recommendation}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {selectedAnalysis.suggestions && selectedAnalysis.suggestions.length > 0 && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-xl border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold flex items-center gap-2 mb-3 text-blue-800 dark:text-blue-200">
                    💡 Sugestões e Recomendações
                  </h4>
                  <ul className="space-y-2">
                    {selectedAnalysis.suggestions.map((suggestion, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-blue-500 mt-1">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Related Analyses (same thread) */}
              {relatedAnalyses && relatedAnalyses.analyses && relatedAnalyses.analyses.length > 1 && (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950 rounded-xl border border-indigo-200 dark:border-indigo-800">
                  <h4 className="font-semibold flex items-center gap-2 mb-3 text-indigo-800 dark:text-indigo-200">
                    🔗 Análises Relacionadas ({relatedAnalyses.analyses.length - 1} outras)
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Documentos do mesmo thread de email
                  </p>
                  <div className="space-y-2">
                    {relatedAnalyses.analyses
                      .filter(a => a.id !== selectedAnalysis.id)
                      .map((related) => {
                        const relatedRisk = getRiskConfig(related.overallRisk);
                        return (
                          <div
                            key={related.id}
                            onClick={() => {
                              setSelectedAnalysis(related);
                            }}
                            className="p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-border/50 cursor-pointer hover:bg-white/80 dark:hover:bg-black/30 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{related.documentName}</p>
                                <p className="text-xs text-muted-foreground">{related.documentType}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-xs font-semibold text-white",
                                  relatedRisk.color
                                )}>
                                  {relatedRisk.label}
                                </span>
                                {related.status === 'resolved' && (
                                  <Check className="h-4 w-4 text-green-500" />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t bg-secondary/20 rounded-b-2xl flex justify-between">
              {/* Status Actions */}
              <div className="flex gap-2">
                {selectedAnalysis.status === 'resolved' ? (
                  <button
                    onClick={() => updateStatusMutation.mutate({ id: selectedAnalysis.id, status: 'pending' })}
                    disabled={updateStatusMutation.isPending}
                    className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reabrir
                  </button>
                ) : (
                  <>
                    {(!selectedAnalysis.status || selectedAnalysis.status === 'pending') && (
                      <button
                        onClick={() => updateStatusMutation.mutate({ id: selectedAnalysis.id, status: 'in_progress' })}
                        disabled={updateStatusMutation.isPending}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <PlayCircle className="h-4 w-4" />
                        Em Andamento
                      </button>
                    )}
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: selectedAnalysis.id, status: 'resolved' })}
                      disabled={updateStatusMutation.isPending}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      Marcar como Resolvido
                    </button>
                  </>
                )}
              </div>
              
              <div className="flex gap-2">
                {/* Botão Ver Email Original */}
                {selectedAnalysis.emailId && (
                  <a
                    href={`https://mail.google.com/mail/u/0/#inbox/${selectedAnalysis.threadId || selectedAnalysis.emailId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    Ver Email
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
