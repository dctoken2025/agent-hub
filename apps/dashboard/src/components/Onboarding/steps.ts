// Definição dos passos do tutorial de onboarding

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string; // Seletor CSS do elemento a destacar
  targetPage: string; // Rota onde o elemento está
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  highlight?: boolean; // Se deve destacar o elemento com borda
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao Agent Hub!',
    description: 'Seus agentes de IA trabalham 24/7 para organizar seus emails, analisar contratos, detectar cobranças e muito mais. Vamos fazer um tour rápido pelo sistema.',
    targetSelector: '[data-onboarding="logo"]',
    targetPage: '/',
    position: 'right',
    highlight: true,
  },
  {
    id: 'dashboard-stats',
    title: 'Seu Painel de Controle',
    description: 'Aqui você vê o resumo geral: quantos emails foram processados, quantos são urgentes, e o status de cada agente.',
    targetSelector: '[data-onboarding="stats"]',
    targetPage: '/',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'agents-overview',
    title: 'Conheça seus Agentes',
    description: 'Estes são seus agentes de IA. Cada um tem uma função específica: classificar emails, analisar contratos, detectar cobranças, monitorar stablecoins e extrair tarefas.',
    targetSelector: '[data-onboarding="agents-list"]',
    targetPage: '/agents',
    position: 'top',
    highlight: true,
  },
  {
    id: 'teach-agent',
    title: 'Ensine seu Contexto',
    description: 'Clique em "Ensinar Agente" para explicar sobre você, sua empresa e suas preferências. Quanto mais contexto, mais inteligentes ficam as análises!',
    targetSelector: '[data-onboarding="teach-button"]',
    targetPage: '/agents',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'start-agents',
    title: 'Inicie os Agentes',
    description: 'Quando estiver pronto, clique aqui para iniciar todos os agentes de uma vez. Eles começarão a trabalhar automaticamente.',
    targetSelector: '[data-onboarding="start-all"]',
    targetPage: '/agents',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'agent-config',
    title: 'Configure os Detalhes',
    description: 'Aqui você pode ajustar intervalos de execução, regras de classificação, palavras-chave e outras preferências de cada agente.',
    targetSelector: '[data-onboarding="config-section"]',
    targetPage: '/agent-config',
    position: 'top',
    highlight: true,
  },
  {
    id: 'focus-briefing',
    title: 'Sua Visão Executiva',
    description: 'A página Foco gera um briefing inteligente com as prioridades do dia. A IA analisa tudo e destaca o que realmente precisa da sua atenção.',
    targetSelector: '[data-onboarding="focus-card"]',
    targetPage: '/focus',
    position: 'bottom',
    highlight: true,
  },
];

