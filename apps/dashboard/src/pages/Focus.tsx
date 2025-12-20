import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Target,
  RefreshCw,
  Mail,
  CheckSquare,
  DollarSign,
  Scale,
  Calendar,
  AlertCircle,
  Clock,
  Star,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { apiRequest } from '@/lib/utils';
import { cn } from '@/lib/utils';

// Tipos
interface FocusItem {
  id: number;
  type: 'email' | 'task' | 'financial' | 'legal';
  title: string;
  description: string;
  urgencyScore: number;
  urgencyLevel: 'critical' | 'high' | 'medium' | 'low';
  urgencyReason: string;
  deadline?: string;
  amount?: number;
  stakeholder?: string;
  isVip?: boolean;
  riskLevel?: string;
  originalData: Record<string, unknown>;
}

interface FocusBriefing {
  scope: 'today' | 'week';
  briefingText: string;
  keyHighlights: string[];
  prioritizedItems: FocusItem[];
  totalItems: number;
  urgentCount: number;
  generatedAt: string;
  expiresAt: string;
}

interface FocusResponse {
  cached: boolean;
  data: FocusBriefing;
}

// Componente principal
export function Focus() {
  const [activeTab, setActiveTab] = useState<'today' | 'week'>('today');
  const queryClient = useQueryClient();

  // Query para buscar briefing
  const { data: focusData, isLoading, error } = useQuery({
    queryKey: ['focus', activeTab],
    queryFn: () => apiRequest<FocusResponse>(`/focus/${activeTab}`),
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  // Mutation para refresh
  const refreshMutation = useMutation({
    mutationFn: () => apiRequest<{ success: boolean; data: FocusBriefing }>('/focus/refresh', {
      method: 'POST',
      body: JSON.stringify({ scope: activeTab }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['focus', activeTab] });
    },
  });

  const briefing = focusData?.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
            <Target className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Foco</h1>
            <p className="text-sm text-muted-foreground">
              Análise inteligente das suas prioridades
            </p>
          </div>
        </div>
        
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
            "bg-gradient-to-r from-violet-500 to-purple-600 text-white",
            "hover:from-violet-600 hover:to-purple-700",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "shadow-lg shadow-violet-500/25"
          )}
        >
          <RefreshCw className={cn("h-4 w-4", refreshMutation.isPending && "animate-spin")} />
          {refreshMutation.isPending ? 'Gerando...' : 'Atualizar'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('today')}
          className={cn(
            "px-6 py-2 rounded-md font-medium transition-all",
            activeTab === 'today' 
              ? "bg-background text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Hoje
          </span>
        </button>
        <button
          onClick={() => setActiveTab('week')}
          className={cn(
            "px-6 py-2 rounded-md font-medium transition-all",
            activeTab === 'week' 
              ? "bg-background text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Esta Semana
          </span>
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full blur-xl opacity-20 animate-pulse" />
            <Sparkles className="h-12 w-12 animate-pulse relative" />
          </div>
          <p className="mt-4 font-medium">Analisando suas prioridades...</p>
          <p className="text-sm">A IA está processando seus dados</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-500 font-medium">Erro ao carregar briefing</p>
          <p className="text-sm text-muted-foreground mt-1">
            {error instanceof Error ? error.message : 'Tente novamente mais tarde'}
          </p>
        </div>
      )}

      {/* Content */}
      {briefing && !isLoading && (
        <div className="space-y-6">
          {/* Briefing Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 border border-violet-500/20">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-violet-500/20 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            
            <div className="relative p-6 space-y-4">
              <div className="flex items-center gap-2 text-violet-400">
                <Sparkles className="h-5 w-5" />
                <span className="text-sm font-medium uppercase tracking-wider">Briefing da IA</span>
                {focusData?.cached && (
                  <span className="text-xs px-2 py-0.5 bg-violet-500/20 rounded-full">
                    cache
                  </span>
                )}
              </div>
              
              <p className="text-lg leading-relaxed whitespace-pre-wrap">
                {briefing.briefingText}
              </p>

              {/* Highlights */}
              {briefing.keyHighlights.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {briefing.keyHighlights.map((highlight, i) => (
                    <span 
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/20 text-violet-300 rounded-full text-sm"
                    >
                      <TrendingUp className="h-3.5 w-3.5" />
                      {highlight}
                    </span>
                  ))}
                </div>
              )}

              {/* Stats */}
              <div className="flex gap-6 pt-4 border-t border-violet-500/20">
                <div>
                  <p className="text-2xl font-bold">{briefing.totalItems}</p>
                  <p className="text-sm text-muted-foreground">itens pendentes</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-400">{briefing.urgentCount}</p>
                  <p className="text-sm text-muted-foreground">urgentes</p>
                </div>
                <div className="ml-auto text-right text-sm text-muted-foreground">
                  <p>Gerado em</p>
                  <p>{new Date(briefing.generatedAt).toLocaleString('pt-BR')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Items List */}
          {briefing.prioritizedItems.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Target className="h-5 w-5 text-violet-500" />
                Itens Priorizados
              </h2>
              
              <div className="space-y-2">
                {briefing.prioritizedItems.map((item) => (
                  <FocusItemCard key={`${item.type}-${item.id}`} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {briefing.prioritizedItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-green-500/10 rounded-full mb-4">
                <CheckSquare className="h-10 w-10 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Tudo em dia!</h3>
              <p className="text-muted-foreground max-w-md">
                Você não tem itens pendentes para {activeTab === 'today' ? 'hoje' : 'esta semana'}.
                Continue assim!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Componente de item individual
function FocusItemCard({ item }: { item: FocusItem }) {
  const typeConfig = {
    email: {
      icon: Mail,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      label: 'Email',
    },
    task: {
      icon: CheckSquare,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
      label: 'Tarefa',
    },
    financial: {
      icon: DollarSign,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      label: 'Financeiro',
    },
    legal: {
      icon: Scale,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      label: 'Jurídico',
    },
  };

  const urgencyConfig = {
    critical: {
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      label: 'Crítico',
    },
    high: {
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/30',
      label: 'Alto',
    },
    medium: {
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30',
      label: 'Médio',
    },
    low: {
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      label: 'Baixo',
    },
  };

  const config = typeConfig[item.type];
  const urgency = urgencyConfig[item.urgencyLevel];
  const Icon = config.icon;

  return (
    <div className={cn(
      "p-4 rounded-xl border bg-card transition-all hover:shadow-md",
      urgency.borderColor
    )}>
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={cn("p-2.5 rounded-lg shrink-0", config.bgColor)}>
          <Icon className={cn("h-5 w-5", config.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-medium truncate">{item.title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                {item.description}
              </p>
            </div>
            
            {/* Urgency Badge */}
            <div className={cn(
              "shrink-0 px-2.5 py-1 rounded-full text-xs font-medium",
              urgency.bgColor,
              urgency.color
            )}>
              {item.urgencyScore}%
            </div>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
            <span className={cn("px-2 py-0.5 rounded", config.bgColor, config.color)}>
              {config.label}
            </span>
            
            <span className={cn("px-2 py-0.5 rounded", urgency.bgColor, urgency.color)}>
              {urgency.label}
            </span>

            {item.deadline && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {new Date(item.deadline).toLocaleDateString('pt-BR')}
              </span>
            )}

            {item.amount && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" />
                {(item.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            )}

            {item.stakeholder && (
              <span className="flex items-center gap-1">
                {item.isVip && <Star className="h-3.5 w-3.5 text-amber-500" />}
                {item.stakeholder}
              </span>
            )}

            {item.riskLevel && (
              <span className="flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                Risco: {item.riskLevel}
              </span>
            )}
          </div>

          {/* Urgency Reason */}
          <p className="mt-2 text-xs text-muted-foreground italic">
            {item.urgencyReason}
          </p>
        </div>

        {/* Arrow */}
        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
      </div>
    </div>
  );
}

