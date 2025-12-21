import { ChevronLeft, ChevronRight, X, Sparkles, Check } from 'lucide-react';

interface TooltipCardProps {
  title: string;
  description: string;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  isLastStep: boolean;
  isFirstStep: boolean;
}

export function TooltipCard({
  title,
  description,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  isLastStep,
  isFirstStep,
}: TooltipCardProps) {
  return (
    <div className="w-[380px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header com gradiente */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-white/90" />
            <span className="text-white/80 text-sm font-medium">
              Passo {currentStep + 1} de {totalSteps}
            </span>
          </div>
          <button
            onClick={onSkip}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="Pular tutorial"
          >
            <X className="h-4 w-4 text-white/70" />
          </button>
        </div>
        
        {/* Progress bar */}
        <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/90 rounded-full transition-all duration-500"
            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {title}
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {description}
        </p>
      </div>

      {/* Footer com navegação */}
      <div className="px-5 pb-5 flex items-center justify-between">
        <button
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Pular tutorial
        </button>
        
        <div className="flex items-center gap-2">
          {!isFirstStep && (
            <button
              onClick={onPrev}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>
          )}
          
          <button
            onClick={onNext}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg hover:from-violet-700 hover:to-purple-700 transition-all shadow-lg shadow-violet-500/25"
          >
            {isLastStep ? (
              <>
                <Check className="h-4 w-4" />
                Concluir
              </>
            ) : (
              <>
                Próximo
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

