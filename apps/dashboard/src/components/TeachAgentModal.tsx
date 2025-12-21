import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  X, 
  GraduationCap, 
  ChevronRight, 
  ChevronLeft,
  Sparkles,
  Check,
  Loader2,
  MessageSquare,
  Brain,
  Trash2
} from 'lucide-react';
import { cn, apiRequest } from '@/lib/utils';

interface Question {
  id: number;
  question: string;
  options: string[];
}

interface TeachAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
}

export function TeachAgentModal({ isOpen, onClose, agentId, agentName }: TeachAgentModalProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'intro' | 'questions' | 'generating' | 'complete'>('intro');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  // Agora suporta múltiplas respostas por pergunta (array de strings)
  const [answers, setAnswers] = useState<{ questionId: number; answers: string[] }[]>([]);
  const [customAnswer, setCustomAnswer] = useState('');
  const [generatedContext, setGeneratedContext] = useState('');

  // Busca contexto existente
  const { data: existingContext, isLoading: loadingContext } = useQuery({
    queryKey: ['agent-context', agentId],
    queryFn: () => apiRequest<{ context: string | null; hasContext: boolean }>(
      `/agent-teaching/context/${agentId}`
    ),
    enabled: isOpen,
  });

  // Gera perguntas
  const generateQuestionsMutation = useMutation({
    mutationFn: () => apiRequest<{ questions: Question[] }>(
      '/agent-teaching/generate-questions',
      {
        method: 'POST',
        body: JSON.stringify({ agentId }),
      }
    ),
    onSuccess: (data) => {
      if (data.questions && data.questions.length > 0) {
        setStep('questions');
      }
    },
  });

  // Salva contexto
  const saveContextMutation = useMutation({
    mutationFn: (data: { agentId: string; answers: { questionId: number; answer: string }[] }) =>
      apiRequest<{ context: string; success: boolean }>(
        '/agent-teaching/save-context',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      ),
    onSuccess: (data) => {
      setGeneratedContext(data.context);
      setStep('complete');
      queryClient.invalidateQueries({ queryKey: ['agent-context', agentId] });
    },
  });

  // Remove contexto
  const deleteContextMutation = useMutation({
    mutationFn: () => apiRequest(`/agent-teaching/context/${agentId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-context', agentId] });
      resetModal();
    },
  });

  const questions = generateQuestionsMutation.data?.questions || [];
  const currentQuestion = questions[currentQuestionIndex];

  // Reset quando fecha
  useEffect(() => {
    if (!isOpen) {
      resetModal();
    }
  }, [isOpen]);

  const resetModal = () => {
    setStep('intro');
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setCustomAnswer('');
    setGeneratedContext('');
    generateQuestionsMutation.reset();
    saveContextMutation.reset();
  };

  const handleStartTeaching = () => {
    generateQuestionsMutation.mutate();
  };

  // Toggle seleção de opção (permite múltiplas)
  const handleSelectOption = (option: string) => {
    setAnswers(prev => {
      const existing = prev.find(a => a.questionId === currentQuestion.id);
      if (existing) {
        // Toggle: adiciona ou remove da lista
        const isSelected = existing.answers.includes(option);
        const newSelectedAnswers = isSelected
          ? existing.answers.filter(a => a !== option)
          : [...existing.answers, option];
        
        return prev.map(a => 
          a.questionId === currentQuestion.id 
            ? { ...a, answers: newSelectedAnswers }
            : a
        );
      } else {
        // Primeira seleção para esta pergunta
        return [...prev, { questionId: currentQuestion.id, answers: [option] }];
      }
    });
  };

  const handleCustomAnswer = () => {
    if (customAnswer.trim()) {
      setAnswers(prev => {
        const existing = prev.find(a => a.questionId === currentQuestion.id);
        if (existing) {
          // Adiciona resposta customizada se não existir
          if (!existing.answers.includes(customAnswer.trim())) {
            return prev.map(a => 
              a.questionId === currentQuestion.id 
                ? { ...a, answers: [...a.answers, customAnswer.trim()] }
                : a
            );
          }
          return prev;
        } else {
          return [...prev, { questionId: currentQuestion.id, answers: [customAnswer.trim()] }];
        }
      });
    }
  };

  const handleNext = () => {
    // Se tem resposta customizada pendente, adiciona às respostas
    if (customAnswer.trim()) {
      handleCustomAnswer();
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setCustomAnswer('');
    } else {
      // Última pergunta - gera contexto
      setStep('generating');
      
      // Converte para o formato esperado pela API (junta respostas com vírgula)
      const formattedAnswers = answers.map(a => ({
        questionId: a.questionId,
        answer: a.answers.join(', ')
      }));
      
      // Adiciona resposta customizada se houver
      const existingAnswer = answers.find(a => a.questionId === currentQuestion.id);
      if (customAnswer.trim() && (!existingAnswer || !existingAnswer.answers.includes(customAnswer.trim()))) {
        const existingIndex = formattedAnswers.findIndex(a => a.questionId === currentQuestion.id);
        if (existingIndex >= 0) {
          formattedAnswers[existingIndex].answer += ', ' + customAnswer.trim();
        } else {
          formattedAnswers.push({ questionId: currentQuestion.id, answer: customAnswer.trim() });
        }
      }
      
      saveContextMutation.mutate({ agentId, answers: formattedAnswers });
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setCustomAnswer('');
    }
  };

  // Retorna array de respostas selecionadas para a pergunta atual
  const getCurrentAnswers = (): string[] => {
    return answers.find(a => a.questionId === currentQuestion?.id)?.answers || [];
  };

  // Verifica se uma opção está selecionada
  const isOptionSelected = (option: string): boolean => {
    return getCurrentAnswers().includes(option);
  };

  // Verifica se tem pelo menos uma resposta para a pergunta atual
  const hasCurrentAnswer = (): boolean => {
    const currentAnswers = getCurrentAnswers();
    return currentAnswers.length > 0 || customAnswer.trim().length > 0;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-card rounded-2xl border shadow-2xl w-full max-w-2xl mx-4 animate-in zoom-in-95 fade-in duration-200 overflow-hidden">
        {/* Header */}
        <div className="relative p-6 border-b bg-gradient-to-r from-violet-600/10 via-purple-600/10 to-fuchsia-600/10">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
              <GraduationCap className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Ensinar {agentName}</h2>
              <p className="text-sm text-muted-foreground">
                Personalize o agente para seu contexto
              </p>
            </div>
          </div>

          {/* Progress bar */}
          {step === 'questions' && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>Pergunta {currentQuestionIndex + 1} de {questions.length}</span>
                <span>{Math.round(((currentQuestionIndex + 1) / questions.length) * 100)}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-violet-500 to-purple-600 transition-all duration-300"
                  style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 min-h-[300px]">
          {/* Loading Context */}
          {loadingContext && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
            </div>
          )}

          {/* Intro Step */}
          {!loadingContext && step === 'intro' && (
            <div className="space-y-6">
              {existingContext?.hasContext ? (
                // Já tem contexto
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-green-600 dark:text-green-400">
                        Este agente já foi ensinado!
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Você pode refazer o ensino para atualizar o contexto.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-secondary/50 rounded-xl">
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Brain className="h-4 w-4 text-violet-500" />
                      Contexto atual:
                    </p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {existingContext.context}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleStartTeaching}
                      disabled={generateQuestionsMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 font-medium"
                    >
                      {generateQuestionsMutation.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Sparkles className="h-5 w-5" />
                      )}
                      Refazer Ensino
                    </button>
                    <button
                      onClick={() => deleteContextMutation.mutate()}
                      disabled={deleteContextMutation.isPending}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 text-red-600 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-all disabled:opacity-50"
                    >
                      {deleteContextMutation.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Trash2 className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                // Sem contexto
                <>
                  <div className="text-center space-y-4">
                    <div className="inline-flex p-4 bg-violet-500/10 rounded-full">
                      <MessageSquare className="h-10 w-10 text-violet-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">
                        Vamos personalizar o {agentName}!
                      </h3>
                      <p className="text-muted-foreground">
                        Responda 5 perguntas rápidas para que a IA entenda melhor seu contexto 
                        e possa tomar decisões mais alinhadas com suas necessidades.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 py-4">
                    <div className="text-center p-4 bg-secondary/50 rounded-xl">
                      <p className="text-2xl font-bold text-violet-500">5</p>
                      <p className="text-xs text-muted-foreground">Perguntas</p>
                    </div>
                    <div className="text-center p-4 bg-secondary/50 rounded-xl">
                      <p className="text-2xl font-bold text-violet-500">~2</p>
                      <p className="text-xs text-muted-foreground">Minutos</p>
                    </div>
                    <div className="text-center p-4 bg-secondary/50 rounded-xl">
                      <p className="text-2xl font-bold text-violet-500">∞</p>
                      <p className="text-xs text-muted-foreground">Benefícios</p>
                    </div>
                  </div>

                  <button
                    onClick={handleStartTeaching}
                    disabled={generateQuestionsMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 font-medium text-lg"
                  >
                    {generateQuestionsMutation.isPending ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Gerando perguntas...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" />
                        Começar Ensino
                      </>
                    )}
                  </button>
                </>
              )}

              {generateQuestionsMutation.isError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 text-sm">
                  Erro ao gerar perguntas. Tente novamente.
                </div>
              )}
            </div>
          )}

          {/* Questions Step */}
          {step === 'questions' && currentQuestion && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-start gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-500 text-white text-sm font-bold flex-shrink-0">
                    {currentQuestionIndex + 1}
                  </span>
                  <span className="pt-1">{currentQuestion.question}</span>
                </h3>
              </div>

              {/* Options - Múltipla seleção */}
              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => {
                  const isSelected = isOptionSelected(option);
                  return (
                    <button
                      key={index}
                      onClick={() => handleSelectOption(option)}
                      className={cn(
                        "w-full p-4 text-left rounded-xl border-2 transition-all",
                        isSelected 
                          ? "border-violet-500 bg-violet-500/10" 
                          : "border-secondary hover:border-violet-500/50 hover:bg-secondary/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {/* Checkbox style em vez de radio */}
                        <div className={cn(
                          "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                          isSelected ? "border-violet-500 bg-violet-500" : "border-muted-foreground/30"
                        )}>
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <span className={cn(
                          "font-medium",
                          isSelected && "text-violet-600 dark:text-violet-400"
                        )}>
                          {option}
                        </span>
                      </div>
                    </button>
                  );
                })}

                {/* Custom answer - pode ser adicional às opções */}
                <div className="pt-2">
                  <p className="text-sm text-muted-foreground mb-2">
                    Ou adicione sua própria resposta:
                  </p>
                  <input
                    type="text"
                    value={customAnswer}
                    onChange={(e) => setCustomAnswer(e.target.value)}
                    placeholder="Digite aqui..."
                    className={cn(
                      "w-full p-4 rounded-xl border-2 bg-background transition-all",
                      customAnswer.trim()
                        ? "border-violet-500 bg-violet-500/5"
                        : "border-secondary focus:border-violet-500/50"
                    )}
                  />
                </div>

                {/* Mostrar respostas selecionadas */}
                {getCurrentAnswers().length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-2">
                      Selecionadas ({getCurrentAnswers().length}):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {getCurrentAnswers().map((answer, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-full text-sm"
                        >
                          {answer}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-4">
                <button
                  onClick={handlePrevious}
                  disabled={currentQuestionIndex === 0}
                  className="flex items-center gap-2 px-4 py-2 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                  Anterior
                </button>
                <button
                  onClick={handleNext}
                  disabled={!hasCurrentAnswer()}
                  className="flex items-center gap-2 px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {currentQuestionIndex === questions.length - 1 ? 'Finalizar' : 'Próxima'}
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {/* Generating Step */}
          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="relative">
                <div className="absolute inset-0 animate-ping bg-violet-500/20 rounded-full" />
                <div className="relative p-6 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full">
                  <Brain className="h-12 w-12 text-white animate-pulse" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">Gerando contexto...</h3>
                <p className="text-muted-foreground">
                  A IA está analisando suas respostas e criando um perfil personalizado
                </p>
              </div>
              <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <div className="inline-flex p-4 bg-green-500/10 rounded-full">
                  <Check className="h-10 w-10 text-green-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    {agentName} foi ensinado com sucesso!
                  </h3>
                  <p className="text-muted-foreground">
                    O agente agora tem contexto personalizado para suas análises.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-secondary/50 rounded-xl">
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Brain className="h-4 w-4 text-violet-500" />
                  Contexto gerado:
                </p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {generatedContext}
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all font-medium"
              >
                <Sparkles className="h-5 w-5" />
                Concluído
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

