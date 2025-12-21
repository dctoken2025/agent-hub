import { useEffect, useState } from 'react';
import { Bot, Loader2, AlertCircle, Mail, FileText, DollarSign, TrendingUp, Zap, Clock, Shield, Brain, ArrowRight, CheckCircle2, Sparkles, Target, CheckSquare, GraduationCap, Users } from 'lucide-react';
import { API_URL } from '@/config';

const features = [
  {
    icon: Target,
    title: 'Briefing Diário Inteligente',
    description: 'Análise consolidada de tudo que importa: emails, tarefas, pagamentos e contratos. Comece o dia sabendo exatamente onde focar.',
    highlights: ['Priorização automática por urgência', 'Visão unificada de pendências', 'Briefings diários e semanais'],
    color: 'from-violet-500 to-fuchsia-500',
    isNew: true,
  },
  {
    icon: Mail,
    title: 'Triagem Inteligente de Emails',
    description: 'IA classifica seus emails por prioridade, detecta urgências, identifica documentos para assinar e filtra newsletters automaticamente.',
    highlights: ['Detecta contratos para assinar', 'Identifica remetentes VIP', 'Filtra spam e newsletters'],
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: CheckSquare,
    title: 'Extração de Tarefas',
    description: 'Detecta automaticamente perguntas, pendências e action items nos seus emails. Nunca mais esqueça de responder algo importante.',
    highlights: ['Identifica stakeholders e projetos', 'Calcula prioridade automática', 'Sugere respostas rápidas'],
    color: 'from-teal-500 to-emerald-500',
    isNew: true,
  },
  {
    icon: FileText,
    title: 'Análise de Contratos',
    description: 'Recebe um contrato por email? A IA lê, analisa riscos, identifica cláusulas críticas e lista os próximos passos.',
    highlights: ['Identifica riscos e cláusulas', 'Define responsáveis e ações', 'Extrai datas e valores'],
    color: 'from-purple-500 to-indigo-500',
  },
  {
    icon: DollarSign,
    title: 'Gestão Financeira',
    description: 'Extrai automaticamente boletos, faturas e cobranças dos seus emails. Organiza vencimentos e formas de pagamento.',
    highlights: ['Extrai dados de boletos e PIX', 'Alerta de vencimentos', 'Categoriza despesas'],
    color: 'from-emerald-500 to-green-500',
  },
  {
    icon: TrendingUp,
    title: 'Monitor de Stablecoins',
    description: 'Acompanha movimentações de USDT, USDC e outras stablecoins em tempo real. Detecta anomalias e grandes transferências.',
    highlights: ['Monitora mint/burn', 'Detecta anomalias', 'Multi-chain support'],
    color: 'from-amber-500 to-orange-500',
  },
];

const benefits = [
  { icon: Clock, text: 'Economize horas por semana em triagem de emails' },
  { icon: Shield, text: 'Nunca perca um deadline ou vencimento importante' },
  { icon: Brain, text: 'IA Claude analisa contexto e prioriza o que importa' },
  { icon: Zap, text: 'Agentes trabalham 24/7 automaticamente' },
  { icon: GraduationCap, text: 'Ensine os agentes sobre seu contexto específico' },
  { icon: Users, text: 'Agentes identificam stakeholders VIP automaticamente' },
];

export function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingConfig, setIsCheckingConfig] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  // Verifica se o Google OAuth está configurado
  useEffect(() => {
    async function checkConfig() {
      try {
        const response = await fetch(`${API_URL}/auth/status`);
        const data = await response.json();
        setIsConfigured(data.googleLogin?.configured || false);
      } catch (err) {
        console.error('Erro ao verificar config:', err);
        setIsConfigured(false);
      } finally {
        setIsCheckingConfig(false);
      }
    }
    checkConfig();
  }, []);

  // Verifica se há erro na URL (retorno do OAuth)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      // Limpa a URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleGoogleLogin = () => {
    setIsLoading(true);
    setError(null);
    // Redireciona para o endpoint de login do Google
    window.location.href = `${API_URL}/auth/google/url`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzIwMjAzMCIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />
      </div>

      <div className="relative">
        {/* Hero Section */}
        <section className="min-h-screen flex flex-col items-center justify-center px-4 py-20">
          <div className="max-w-5xl mx-auto text-center">
            {/* Logo */}
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl mb-8 shadow-lg shadow-blue-500/25 animate-float">
              <Bot className="w-10 h-10 text-white" />
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
              <span className="bg-gradient-to-r from-white via-white to-slate-400 bg-clip-text text-transparent">
                Agentes de IA
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                trabalhando por você
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-slate-400 mb-12 max-w-3xl mx-auto leading-relaxed">
              Automatize a triagem de emails, análise de contratos, gestão financeira e monitoramento de crypto. 
              <span className="text-white font-medium"> Sua equipe de IA opera 24/7.</span>
            </p>

            {/* CTA Card */}
            <div className="max-w-md mx-auto">
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl">
                {isCheckingConfig ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  </div>
                ) : !isConfigured ? (
                  <div className="text-center py-4">
                    <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8 text-amber-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Configuração Necessária
                    </h3>
                    <p className="text-slate-400 text-sm">
                      O administrador precisa configurar o Google OAuth para habilitar o login.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Erro */}
                    {error && (
                      <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm mb-6">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    {/* Botão Google */}
                    <button
                      onClick={handleGoogleLogin}
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white hover:bg-gray-50 text-gray-800 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                      )}
                      <span>{isLoading ? 'Conectando...' : 'Começar com Google'}</span>
                      {!isLoading && <ArrowRight className="w-4 h-4 ml-1" />}
                    </button>

                    <p className="text-center text-slate-500 text-xs mt-6">
                      Ao entrar, você autoriza o acesso ao seu Gmail para classificação de emails
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Scroll indicator */}
            <div className="mt-16 animate-bounce">
              <div className="w-8 h-12 border-2 border-slate-600 rounded-full mx-auto flex items-start justify-center p-2">
                <div className="w-1.5 h-3 bg-slate-500 rounded-full animate-scroll" />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" />
                Powered by Claude AI
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                Seis agentes,{' '}
                <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                  infinitas possibilidades
                </span>
              </h2>
              <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                Cada agente é especializado em uma área, trabalhando em conjunto para otimizar seu dia a dia.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="group relative bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-2xl p-8 hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300"
                >
                  {/* Gradient accent */}
                  <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${feature.color} rounded-t-2xl opacity-60`} />
                  
                  {/* New badge */}
                  {feature.isNew && (
                    <div className="absolute top-4 right-4 px-2 py-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-xs font-bold rounded-full">
                      NOVO
                    </div>
                  )}
                  
                  <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} mb-6 shadow-lg`}>
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>

                  <h3 className="text-xl font-bold mb-3 text-white group-hover:text-blue-100 transition-colors">
                    {feature.title}
                  </h3>
                  
                  <p className="text-slate-400 mb-6 leading-relaxed">
                    {feature.description}
                  </p>

                  <ul className="space-y-2">
                    {feature.highlights.map((highlight, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Teach Agents Section */}
        <section className="py-24 px-4 border-t border-white/5">
          <div className="max-w-5xl mx-auto">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 border border-violet-500/20 p-8 md:p-12">
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-violet-500/20 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              
              <div className="relative grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-500/20 border border-violet-500/30 rounded-full text-violet-400 text-sm font-medium mb-6">
                    <GraduationCap className="w-4 h-4" />
                    Personalização Avançada
                  </div>
                  
                  <h2 className="text-3xl md:text-4xl font-bold mb-4">
                    Ensine seus agentes sobre{' '}
                    <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                      seu contexto
                    </span>
                  </h2>
                  
                  <p className="text-lg text-slate-400 mb-6 leading-relaxed">
                    Responda 5 perguntas rápidas e a IA cria um perfil personalizado para cada agente. 
                    Eles aprendem sobre sua área de atuação, stakeholders VIP, preferências e prioridades.
                  </p>
                  
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-slate-300">
                      <CheckCircle2 className="w-5 h-5 text-violet-400 flex-shrink-0" />
                      Cada agente com contexto específico
                    </li>
                    <li className="flex items-center gap-3 text-slate-300">
                      <CheckCircle2 className="w-5 h-5 text-violet-400 flex-shrink-0" />
                      Análises mais precisas e relevantes
                    </li>
                    <li className="flex items-center gap-3 text-slate-300">
                      <CheckCircle2 className="w-5 h-5 text-violet-400 flex-shrink-0" />
                      Atualize ou refaça a qualquer momento
                    </li>
                  </ul>
                </div>
                
                <div className="relative">
                  {/* Mock teaching UI */}
                  <div className="bg-[#12121a] rounded-2xl border border-white/10 p-6 shadow-2xl">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
                        <GraduationCap className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">Ensinar Agente de Email</p>
                        <p className="text-xs text-slate-500">Pergunta 2 de 5</p>
                      </div>
                    </div>
                    
                    <div className="h-1.5 bg-white/10 rounded-full mb-6 overflow-hidden">
                      <div className="h-full w-2/5 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full" />
                    </div>
                    
                    <p className="text-slate-300 mb-4">Quem são seus stakeholders mais importantes?</p>
                    
                    <div className="space-y-2">
                      <div className="p-3 bg-violet-500/10 border border-violet-500/30 rounded-lg text-sm text-violet-300">
                        Clientes e investidores
                      </div>
                      <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-400">
                        Equipe interna
                      </div>
                      <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-400">
                        Fornecedores e parceiros
                      </div>
                    </div>
                  </div>
                  
                  {/* Floating badge */}
                  <div className="absolute -bottom-4 -right-4 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full text-white text-sm font-semibold shadow-lg shadow-emerald-500/25">
                    ~2 minutos
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-24 px-4 border-t border-white/5">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
              Porque usar o{' '}
              <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                Agent Hub
              </span>
            </h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-6 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-all"
                >
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <benefit.icon className="w-6 h-6 text-blue-400" />
                  </div>
                  <p className="text-slate-300 font-medium">{benefit.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 px-4 border-t border-white/5">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Pronto para automatizar?
            </h2>
            <p className="text-xl text-slate-400 mb-8">
              Comece agora e deixe os agentes trabalharem por você.
            </p>
            
            {isConfigured && (
              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Bot className="w-5 h-5" />
                )}
                <span>{isLoading ? 'Conectando...' : 'Começar Gratuitamente'}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-4 border-t border-white/5">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <span>Agent Hub</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="/privacy" className="hover:text-white transition-colors">Política de Privacidade</a>
              <a href="/terms" className="hover:text-white transition-colors">Termos de Serviço</a>
            </div>
            <p className="hidden md:block">Desenvolvido com ❤️ usando Claude AI</p>
          </div>
        </footer>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes scroll {
          0%, 100% { opacity: 1; transform: translateY(0); }
          50% { opacity: 0.5; transform: translateY(6px); }
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        .animate-scroll {
          animation: scroll 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
