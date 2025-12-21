import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { OnboardingStep } from './steps';
import { TooltipCard } from './TooltipCard';

interface SpotlightOverlayProps {
  step: OnboardingStep;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function SpotlightOverlay({
  step,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
}: SpotlightOverlayProps) {
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const observerRef = useRef<MutationObserver | null>(null);

  // Encontra e rastreia o elemento alvo
  useEffect(() => {
    const findTarget = () => {
      const target = document.querySelector(step.targetSelector);
      if (target) {
        const rect = target.getBoundingClientRect();
        setTargetRect({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        });
        setIsVisible(true);

        // Scroll suave para o elemento se necessário
        const viewportHeight = window.innerHeight;
        const elementCenter = rect.top + rect.height / 2;
        if (elementCenter < 100 || elementCenter > viewportHeight - 100) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        // Elemento não encontrado - mostra no centro
        setTargetRect(null);
        setIsVisible(true);
      }
    };

    // Delay inicial para garantir que a página renderizou
    const timer = setTimeout(findTarget, 300);

    // Observa mudanças no DOM para re-encontrar o elemento
    observerRef.current = new MutationObserver(() => {
      findTarget();
    });

    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Atualiza ao redimensionar
    window.addEventListener('resize', findTarget);
    window.addEventListener('scroll', findTarget, true);

    return () => {
      clearTimeout(timer);
      observerRef.current?.disconnect();
      window.removeEventListener('resize', findTarget);
      window.removeEventListener('scroll', findTarget, true);
    };
  }, [step.targetSelector]);

  if (!isVisible) return null;

  const padding = 8;

  // Calcula posição do recorte (spotlight)
  const spotlightStyle = targetRect
    ? {
        top: targetRect.top - padding,
        left: targetRect.left - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
      }
    : null;

  // Calcula posição do tooltip
  const getTooltipPosition = (): React.CSSProperties => {
    if (!targetRect) {
      // Centro da tela
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const tooltipWidth = 380;
    const tooltipHeight = 200;
    const gap = 16;

    switch (step.position) {
      case 'top':
        return {
          position: 'absolute' as const,
          top: targetRect.top - tooltipHeight - gap,
          left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
        };
      case 'bottom':
        return {
          position: 'absolute' as const,
          top: targetRect.top + targetRect.height + gap,
          left: Math.max(16, Math.min(
            targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
            window.innerWidth - tooltipWidth - 16
          )),
        };
      case 'left':
        return {
          position: 'absolute' as const,
          top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
          left: targetRect.left - tooltipWidth - gap,
        };
      case 'right':
        return {
          position: 'absolute' as const,
          top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
          left: targetRect.left + targetRect.width + gap,
        };
      default:
        return {
          position: 'fixed' as const,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: 'none' }}>
      {/* Backdrop escurecido com recorte */}
      <svg
        className="absolute inset-0 w-full h-full transition-opacity duration-300"
        style={{ pointerEvents: 'auto' }}
      >
        <defs>
          <mask id="spotlight-mask">
            {/* Fundo branco (visível) */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Recorte preto (transparente) */}
            {spotlightStyle && (
              <rect
                x={spotlightStyle.left}
                y={spotlightStyle.top}
                width={spotlightStyle.width}
                height={spotlightStyle.height}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.75)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Borda de destaque ao redor do elemento */}
      {spotlightStyle && step.highlight && (
        <div
          className="absolute rounded-xl border-2 border-violet-500 shadow-[0_0_0_4px_rgba(139,92,246,0.3)] transition-all duration-300 animate-pulse"
          style={{
            top: spotlightStyle.top,
            left: spotlightStyle.left,
            width: spotlightStyle.width,
            height: spotlightStyle.height,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Tooltip Card */}
      <div style={{ ...getTooltipPosition(), pointerEvents: 'auto' }}>
        <TooltipCard
          title={step.title}
          description={step.description}
          currentStep={currentStep}
          totalSteps={totalSteps}
          onNext={onNext}
          onPrev={onPrev}
          onSkip={onSkip}
          isLastStep={currentStep === totalSteps - 1}
          isFirstStep={currentStep === 0}
        />
      </div>
    </div>,
    document.body
  );
}

