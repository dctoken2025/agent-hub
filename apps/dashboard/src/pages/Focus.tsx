import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
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
  Brain,
  Search,
  ListChecks,
  BarChart3,
  X,
} from 'lucide-react';
import { apiRequest } from '@/lib/utils';
import { cn } from '@/lib/utils';

// Componente de Loading Interativo
function InteractiveLoading() {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);

  const steps = [
    { icon: Search, text: 'Buscando seus dados...', color: 'text-blue-500' },
    { icon: Mail, text: 'Analisando emails...', color: 'text-cyan-500' },
    { icon: ListChecks, text: 'Verificando tarefas...', color: 'text-emerald-500' },
    { icon: DollarSign, text: 'Processando financeiro...', color: 'text-amber-500' },
    { icon: Brain, text: 'IA priorizando itens...', color: 'text-violet-500' },
    { icon: BarChart3, text: 'Gerando briefing...', color: 'text-purple-500' },
  ];

  const tips = [
    '💡 O Foco analisa todos os seus dados para criar um briefing personalizado',
    '⚡ Itens urgentes aparecem primeiro, ordenados por prioridade',
    '🎯 A IA considera prazos, valores e contatos VIP na priorização',
    '📊 Cada análise leva em conta emails, tarefas e pendências financeiras',
    '🔄 Você pode atualizar o briefing a qualquer momento',
  ];

  useEffect(() => {
    // Avança as etapas progressivamente
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < steps.length - 1) return prev + 1;
        return prev;
      });
    }, 2500);

    // Atualiza o progresso suavemente
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const target = ((currentStep + 1) / steps.length) * 100;
        const increment = (target - prev) * 0.1;
        if (Math.abs(target - prev) < 1) return target;
        return prev + increment;
      });
    }, 100);

    // Troca as dicas
    const tipInterval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
    }, 4000);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
      clearInterval(tipInterval);
    };
  }, [currentStep, steps.length, tips.length]);

  const CurrentIcon = steps[currentStep].icon;

  return (
    <div className="py-12">
      <div className="max-w-md mx-auto">
        {/* Card principal */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/5 via-purple-500/5 to-fuchsia-500/5 border border-violet-500/20 p-8">
          {/* Efeito de fundo animado */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-violet-500/10 to-transparent rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-purple-500/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          </div>

          <div className="relative space-y-6">
            {/* Ícone central animado */}
            <div className="flex justify-center">
              <div className="relative">
                {/* Círculos de fundo animados */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 blur-xl opacity-30 animate-pulse scale-150" />
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 opacity-20 animate-ping" />
                
                {/* Container do ícone */}
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                  <CurrentIcon className="h-10 w-10 text-white animate-pulse" />
                </div>
                
                {/* Sparkles decorativos */}
                <Sparkles className="absolute -top-2 -right-2 h-6 w-6 text-violet-400 animate-bounce" style={{ animationDelay: '0.5s' }} />
                <Sparkles className="absolute -bottom-1 -left-3 h-5 w-5 text-purple-400 animate-bounce" style={{ animationDelay: '1s' }} />
              </div>
            </div>

            {/* Texto da etapa atual */}
            <div className="text-center">
              <p className={cn(
                "text-lg font-semibold transition-all duration-500",
                steps[currentStep].color
              )}>
                {steps[currentStep].text}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                A IA está processando seus dados
              </p>
            </div>

            {/* Barra de progresso */}
            <div className="space-y-2">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 rounded-full transition-all duration-500 ease-out relative"
                  style={{ width: `${progress}%` }}
                >
                  {/* Efeito de brilho na barra */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                </div>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Etapa {currentStep + 1} de {steps.length}
              </p>
            </div>

            {/* Indicadores das etapas */}
            <div className="flex justify-center gap-2">
              {steps.map((step, index) => {
                const StepIcon = step.icon;
                return (
                  <div
                    key={index}
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                      index < currentStep 
                        ? "bg-violet-500 text-white" 
                        : index === currentStep 
                          ? "bg-violet-500/20 text-violet-500 ring-2 ring-violet-500 ring-offset-2 ring-offset-background" 
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {index < currentStep ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <StepIcon className="h-4 w-4" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Dica rotativa */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-full text-sm text-muted-foreground transition-all duration-500">
            <span className="transition-opacity duration-500">
              {tips[tipIndex]}
            </span>
          </div>
        </div>
      </div>

      {/* Estilos CSS para animação shimmer */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }
      `}</style>
    </div>
  );
}

// Modal de Loading para atualização
function LoadingModal({ isOpen, onClose }: { isOpen: boolean; onClose?: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 animate-in zoom-in-95 fade-in duration-300">
        <div className="bg-background rounded-2xl shadow-2xl border overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-violet-500/10 to-purple-500/10">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
                <RefreshCw className="h-4 w-4 text-white animate-spin" />
              </div>
              <span className="font-semibold">Atualizando Briefing</span>
            </div>
            {onClose && (
              <button 
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
          
          {/* Content - Loading Interativo */}
          <div className="p-2">
            <InteractiveLoadingCompact />
          </div>
        </div>
      </div>
    </div>
  );
}

// Versão compacta do loading para o modal
function InteractiveLoadingCompact() {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);

  const steps = [
    { icon: Search, text: 'Buscando dados atualizados...', color: 'text-blue-500' },
    { icon: Mail, text: 'Reanalisando emails...', color: 'text-cyan-500' },
    { icon: ListChecks, text: 'Atualizando tarefas...', color: 'text-emerald-500' },
    { icon: DollarSign, text: 'Recalculando financeiro...', color: 'text-amber-500' },
    { icon: Brain, text: 'IA repriorizando itens...', color: 'text-violet-500' },
    { icon: BarChart3, text: 'Gerando novo briefing...', color: 'text-purple-500' },
  ];

  const tips = [
    '💡 O novo briefing incluirá as últimas atualizações',
    '⚡ Novos emails e tarefas serão considerados',
    '🎯 A priorização será recalculada do zero',
    '📊 Alterações recentes impactam o resultado',
    '✨ Quase lá! Finalizando análise...',
  ];

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < steps.length - 1) return prev + 1;
        return prev;
      });
    }, 2000);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const target = ((currentStep + 1) / steps.length) * 100;
        const increment = (target - prev) * 0.15;
        if (Math.abs(target - prev) < 1) return target;
        return prev + increment;
      });
    }, 80);

    const tipInterval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
    }, 3000);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
      clearInterval(tipInterval);
    };
  }, [currentStep, steps.length, tips.length]);

  const CurrentIcon = steps[currentStep].icon;

  return (
    <div className="py-6 px-4">
      <div className="space-y-5">
        {/* Ícone central */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 blur-lg opacity-40 animate-pulse scale-125" />
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <CurrentIcon className="h-8 w-8 text-white" />
            </div>
            <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-violet-400 animate-bounce" />
          </div>
        </div>

        {/* Texto da etapa */}
        <div className="text-center">
          <p className={cn(
            "text-base font-semibold transition-all duration-500",
            steps[currentStep].color
          )}>
            {steps[currentStep].text}
          </p>
        </div>

        {/* Barra de progresso */}
        <div className="space-y-2">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 rounded-full transition-all duration-300 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Etapa {currentStep + 1} de {steps.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Indicadores das etapas - versão compacta */}
        <div className="flex justify-center gap-1.5">
          {steps.map((_, index) => (
            <div
              key={index}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                index < currentStep 
                  ? "bg-violet-500" 
                  : index === currentStep 
                    ? "bg-violet-500 ring-2 ring-violet-500/30 ring-offset-1 ring-offset-background" 
                    : "bg-muted"
              )}
            />
          ))}
        </div>

        {/* Dica */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground transition-all duration-500">
            {tips[tipIndex]}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }
      `}</style>
    </div>
  );
}

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
    <>
      {/* Modal de Loading para Atualização */}
      <LoadingModal isOpen={refreshMutation.isPending} />
      
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
      {isLoading && <InteractiveLoading />}

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
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 border border-violet-500/20" data-onboarding="focus-card">
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
                    <a 
                      key={i}
                      href="#"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-full text-sm font-medium shadow-sm transition-colors"
                    >
                      <TrendingUp className="h-3.5 w-3.5" />
                      {highlight}
                    </a>
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
    </>
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

