import { Bot, ArrowLeft, FileText, CheckCircle2, AlertTriangle, Scale, Zap, Ban, RefreshCw } from 'lucide-react';
import { Link } from 'wouter';

const sections = [
  {
    icon: CheckCircle2,
    title: 'Aceitação dos Termos',
    content: [
      'Ao acessar ou usar o Agent Hub, você concorda com estes Termos de Serviço',
      'Se você não concordar com qualquer parte, não poderá usar nossos serviços',
      'Reservamos o direito de atualizar estes termos a qualquer momento',
      'Alterações significativas serão comunicadas por email ou notificação na plataforma',
    ],
  },
  {
    icon: Zap,
    title: 'Descrição do Serviço',
    content: [
      'O Agent Hub é uma plataforma de automação com IA para gestão de emails e documentos',
      'Oferecemos agentes especializados: Email, Jurídico, Financeiro e Stablecoins',
      'Os agentes processam dados usando modelos de IA (Claude da Anthropic)',
      'O serviço requer autorização de acesso ao Gmail para funcionar',
      'Funcionalidades podem ser adicionadas, modificadas ou removidas sem aviso prévio',
    ],
  },
  {
    icon: Scale,
    title: 'Uso Aceitável',
    content: [
      'Use o serviço apenas para fins legais e autorizados',
      'Não tente acessar contas ou dados de outros usuários',
      'Não use o serviço para enviar spam ou conteúdo malicioso',
      'Não tente burlar limitações ou medidas de segurança',
      'Respeite os limites de uso da API e recursos do sistema',
    ],
  },
  {
    icon: Ban,
    title: 'Restrições',
    content: [
      'Não é permitido revender ou redistribuir o acesso ao serviço',
      'Não é permitido usar engenharia reversa ou tentar extrair código-fonte',
      'Não é permitido usar bots ou automação externa para acessar o serviço',
      'Não é permitido usar o serviço para atividades ilegais ou fraudulentas',
      'Violações podem resultar em suspensão ou encerramento da conta',
    ],
  },
  {
    icon: AlertTriangle,
    title: 'Limitação de Responsabilidade',
    content: [
      'O serviço é fornecido "como está" sem garantias de qualquer tipo',
      'Não garantimos precisão, completude ou utilidade das análises de IA',
      'Decisões baseadas nas análises são de responsabilidade do usuário',
      'Não somos responsáveis por perdas decorrentes do uso do serviço',
      'Análises jurídicas não substituem consultoria profissional de advogados',
      'Análises financeiras não constituem aconselhamento financeiro',
    ],
  },
  {
    icon: RefreshCw,
    title: 'Disponibilidade e Suporte',
    content: [
      'Nos esforçamos para manter o serviço disponível 24/7, mas não garantimos uptime',
      'Manutenções programadas serão comunicadas com antecedência quando possível',
      'Suporte técnico disponível por email em horário comercial',
      'Tempo de resposta pode variar de acordo com a demanda',
    ],
  },
];

export function Terms() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzIwMjAzMCIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />
      </div>

      <div className="relative">
        {/* Header */}
        <header className="py-6 px-4 border-b border-white/5">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Link href="/">
              <a className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
                <span>Voltar</span>
              </a>
            </Link>
            <div className="flex items-center gap-2">
              <Bot className="w-6 h-6 text-blue-500" />
              <span className="font-semibold">Agent Hub</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            {/* Title */}
            <div className="text-center mb-16">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl mb-6 shadow-lg shadow-blue-500/25">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Termos de{' '}
                <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                  Serviço
                </span>
              </h1>
              <p className="text-slate-400 text-lg">
                Última atualização: {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </p>
            </div>

            {/* Intro */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 mb-8">
              <p className="text-slate-300 leading-relaxed">
                Bem-vindo ao Agent Hub. Estes Termos de Serviço ("Termos") regem o uso da nossa plataforma 
                de automação com inteligência artificial. Por favor, leia atentamente antes de utilizar 
                nossos serviços.
              </p>
            </div>

            {/* Sections */}
            <div className="space-y-6">
              {sections.map((section, index) => (
                <div
                  key={index}
                  className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 hover:bg-white/[0.04] transition-all"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center">
                      <section.icon className="w-6 h-6 text-blue-400" />
                    </div>
                    <h2 className="text-xl font-bold">{section.title}</h2>
                  </div>
                  <ul className="space-y-3">
                    {section.content.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Contact */}
            <div className="mt-12 bg-gradient-to-r from-blue-500/10 to-violet-500/10 border border-blue-500/20 rounded-2xl p-8">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Scale className="w-5 h-5 text-blue-400" />
                Foro e Legislação Aplicável
              </h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Estes Termos são regidos pelas leis da República Federativa do Brasil. Qualquer disputa 
                será resolvida no foro da comarca de São Paulo, SP, com renúncia a qualquer outro, 
                por mais privilegiado que seja.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Para dúvidas ou esclarecimentos sobre estes Termos, entre em contato pelo email: 
                <span className="text-blue-400 ml-1">suporte@agenthub.com.br</span>
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="py-8 px-4 border-t border-white/5">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <span>Agent Hub</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/privacy">
                <a className="hover:text-white transition-colors">Privacidade</a>
              </Link>
              <Link href="/terms">
                <a className="hover:text-white transition-colors">Termos de Serviço</a>
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

