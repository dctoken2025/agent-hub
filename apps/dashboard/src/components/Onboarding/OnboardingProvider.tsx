import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { ONBOARDING_STEPS, OnboardingStep } from './steps';
import { SpotlightOverlay } from './SpotlightOverlay';

interface OnboardingContextType {
  isActive: boolean;
  currentStep: number;
  currentStepData: OnboardingStep | null;
  totalSteps: number;
  startOnboarding: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipOnboarding: () => void;
  finishOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false); // Flag para evitar reinício durante skip/finish
  const [hasStartedOnce, setHasStartedOnce] = useState(false); // Flag para controlar se já iniciou nesta sessão
  const [location, setLocation] = useLocation();
  const { user, onboardingCompleted, completeOnboarding } = useAuth();

  const currentStepData = isActive ? ONBOARDING_STEPS[currentStep] : null;

  // Auto-inicia onboarding para novos usuários (apenas uma vez por sessão)
  useEffect(() => {
    // Não reinicia se:
    // - Já está ativo
    // - Já completou o onboarding
    // - Está em processo de completar/skip
    // - Já iniciou uma vez nesta sessão
    if (user && !onboardingCompleted && !isActive && !isCompleting && !hasStartedOnce) {
      // Pequeno delay para garantir que a página carregou
      const timer = setTimeout(() => {
        setIsActive(true);
        setCurrentStep(0);
        setHasStartedOnce(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, onboardingCompleted, isActive, isCompleting, hasStartedOnce]);

  // Navega para a página correta quando o passo muda
  useEffect(() => {
    if (isActive && currentStepData && location !== currentStepData.targetPage) {
      setLocation(currentStepData.targetPage);
    }
  }, [isActive, currentStepData, location, setLocation]);

  const startOnboarding = useCallback(() => {
    setIsActive(true);
    setCurrentStep(0);
  }, []);


  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const skipOnboarding = useCallback(async () => {
    setIsCompleting(true); // Marca como em processo de completar
    setIsActive(false);
    setCurrentStep(0);
    await completeOnboarding();
    // Não reseta isCompleting para garantir que nunca reinicie
  }, [completeOnboarding]);

  const finishOnboarding = useCallback(async () => {
    setIsCompleting(true); // Marca como em processo de completar
    setIsActive(false);
    setCurrentStep(0);
    await completeOnboarding();
    // Não reseta isCompleting para garantir que nunca reinicie
  }, [completeOnboarding]);

  // Handler para avançar passo (precisa ser após finishOnboarding)
  const handleNextStep = useCallback(() => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Último passo - finaliza
      finishOnboarding();
    }
  }, [currentStep, finishOnboarding]);

  return (
    <OnboardingContext.Provider
      value={{
        isActive,
        currentStep,
        currentStepData,
        totalSteps: ONBOARDING_STEPS.length,
        startOnboarding,
        nextStep: handleNextStep,
        prevStep,
        skipOnboarding,
        finishOnboarding,
      }}
    >
      {children}
      {isActive && currentStepData && (
        <SpotlightOverlay
          step={currentStepData}
          currentStep={currentStep}
          totalSteps={ONBOARDING_STEPS.length}
          onNext={handleNextStep}
          onPrev={prevStep}
          onSkip={skipOnboarding}
        />
      )}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}

