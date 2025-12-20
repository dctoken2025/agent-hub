import { Bot, ArrowLeft, Shield, Lock, Eye, Database, Mail, Trash2 } from 'lucide-react';
import { Link } from 'wouter';

const sections = [
  {
    icon: Database,
    title: 'Dados que Coletamos',
    content: [
      'Informações de conta do Google (nome, email, foto de perfil) quando você faz login',
      'Metadados dos emails (remetente, assunto, data) para classificação e triagem',
      'Conteúdo de emails processados pelos agentes de IA para análise',
      'Documentos anexados que você solicita análise (contratos, boletos, etc.)',
      'Logs de uso e interação com a plataforma',
    ],
  },
  {
    icon: Lock,
    title: 'Como Usamos seus Dados',
    content: [
      'Autenticação e identificação na plataforma',
      'Classificação e triagem automática de emails',
      'Análise de documentos jurídicos e financeiros',
      'Extração de dados de boletos e cobranças',
      'Melhoria contínua dos serviços e algoritmos de IA',
    ],
  },
  {
    icon: Shield,
    title: 'Segurança e Proteção',
    content: [
      'Dados transmitidos via HTTPS com criptografia TLS',
      'Tokens de acesso armazenados de forma segura no servidor',
      'Não compartilhamos dados com terceiros sem consentimento',
      'Acesso restrito apenas à equipe técnica autorizada',
      'Servidores hospedados em infraestrutura segura (Railway)',
    ],
  },
  {
    icon: Eye,
    title: 'Acesso aos seus Dados',
    content: [
      'Você pode visualizar todos os dados processados no dashboard',
      'Emails classificados ficam disponíveis para consulta',
      'Análises jurídicas e financeiras são armazenadas em seu perfil',
      'Você pode exportar seus dados a qualquer momento',
    ],
  },
  {
    icon: Trash2,
    title: 'Exclusão de Dados',
    content: [
      'Você pode solicitar a exclusão total dos seus dados',
      'Ao desconectar sua conta, revogamos o acesso ao Gmail',
      'Dados processados podem ser excluídos mediante solicitação',
      'Logs são mantidos por até 90 dias para fins de auditoria',
    ],
  },
  {
    icon: Mail,
    title: 'Contato',
    content: [
      'Para dúvidas sobre privacidade, entre em contato conosco',
      'Email: suporte@agenthub.com.br',
      'Respondemos em até 48 horas úteis',
    ],
  },
];

export function Privacy() {
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
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Política de{' '}
                <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                  Privacidade
                </span>
              </h1>
              <p className="text-slate-400 text-lg">
                Última atualização: {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </p>
            </div>

            {/* Intro */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 mb-8">
              <p className="text-slate-300 leading-relaxed">
                O Agent Hub ("nós", "nosso" ou "plataforma") está comprometido em proteger sua privacidade. 
                Esta Política de Privacidade explica como coletamos, usamos, armazenamos e protegemos suas 
                informações pessoais quando você usa nossos serviços de automação com IA.
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

            {/* LGPD Notice */}
            <div className="mt-12 bg-gradient-to-r from-blue-500/10 to-violet-500/10 border border-blue-500/20 rounded-2xl p-8">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-400" />
                Conformidade com a LGPD
              </h2>
              <p className="text-slate-300 leading-relaxed">
                Esta política está em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018). 
                Você tem direito a acessar, corrigir, excluir e portar seus dados pessoais. Para exercer esses 
                direitos ou esclarecer dúvidas, entre em contato conosco através dos canais indicados acima.
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

