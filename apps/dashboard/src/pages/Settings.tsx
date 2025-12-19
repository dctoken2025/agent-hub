import { useQuery } from '@tanstack/react-query';
import { 
  Settings as SettingsIcon, 
  Mail, 
  Bell, 
  Key,
  CheckCircle,
  XCircle,
  ExternalLink
} from 'lucide-react';
import { cn, apiRequest } from '@/lib/utils';

interface AuthStatus {
  gmail: {
    configured: boolean;
    authenticated: boolean;
  };
  slack: {
    configured: boolean;
  };
  telegram: {
    configured: boolean;
  };
}

export function Settings() {
  const { data: authStatus } = useQuery({
    queryKey: ['authStatus'],
    queryFn: () => apiRequest<AuthStatus>('/auth/status'),
  });

  const { data: gmailAuth } = useQuery({
    queryKey: ['gmailAuthUrl'],
    queryFn: () => apiRequest<{ authUrl: string }>('/auth/gmail/url'),
    enabled: authStatus?.gmail.configured && !authStatus?.gmail.authenticated,
  });

  const integrations = [
    {
      name: 'Gmail',
      description: 'Leitura e classificação de emails',
      icon: Mail,
      configured: authStatus?.gmail.configured || false,
      authenticated: authStatus?.gmail.authenticated || false,
      authUrl: gmailAuth?.authUrl,
    },
    {
      name: 'Slack',
      description: 'Notificações de emails urgentes',
      icon: Bell,
      configured: authStatus?.slack.configured || false,
      authenticated: authStatus?.slack.configured || false,
    },
    {
      name: 'Telegram',
      description: 'Notificações via Telegram Bot',
      icon: Bell,
      configured: authStatus?.telegram.configured || false,
      authenticated: authStatus?.telegram.configured || false,
    },
  ];

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Configurações</h2>
        <p className="text-muted-foreground">
          Gerencie integrações e preferências
        </p>
      </div>

      {/* Integrations */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Key className="h-5 w-5" />
            Integrações
          </h3>
        </div>
        <div className="divide-y">
          {integrations.map((integration) => (
            <div 
              key={integration.name}
              className="p-6 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-secondary rounded-lg">
                  <integration.icon className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-medium">{integration.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {integration.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {!integration.configured ? (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <XCircle className="h-4 w-4" />
                    Não configurado
                  </span>
                ) : integration.authenticated ? (
                  <span className="flex items-center gap-1.5 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Conectado
                  </span>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5 text-sm text-orange-500">
                      <XCircle className="h-4 w-4" />
                      Não autenticado
                    </span>
                    {integration.authUrl && (
                      <a
                        href={integration.authUrl}
                        className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
                      >
                        Conectar
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Environment Variables Guide */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Variáveis de Ambiente
          </h3>
        </div>
        <div className="p-6">
          <p className="text-sm text-muted-foreground mb-4">
            Configure as seguintes variáveis no arquivo <code className="bg-secondary px-1.5 py-0.5 rounded">.env</code>:
          </p>
          <div className="bg-secondary rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <pre className="text-muted-foreground">
{`# API do Claude (obrigatório)
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Gmail OAuth (obrigatório para email agent)
GMAIL_CLIENT_ID=xxxxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=xxxxx
USER_EMAIL=seu@email.com

# Remetentes prioritários (separados por vírgula)
VIP_SENDERS=ceo@empresa.com,diretoria@empresa.com

# Notificações (opcional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
TELEGRAM_BOT_TOKEN=xxxxx
TELEGRAM_CHAT_ID=xxxxx`}
            </pre>
          </div>
        </div>
      </div>

      {/* Gmail Setup Guide */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Como configurar o Gmail</h3>
        </div>
        <div className="p-6 space-y-4">
          <ol className="list-decimal list-inside space-y-3 text-sm">
            <li>
              Acesse o{' '}
              <a 
                href="https://console.cloud.google.com/apis/credentials" 
                target="_blank"
                className="text-primary hover:underline"
              >
                Google Cloud Console
              </a>
            </li>
            <li>Crie um novo projeto ou selecione um existente</li>
            <li>Ative a Gmail API</li>
            <li>Crie credenciais OAuth 2.0 (Tipo: Aplicativo Web)</li>
            <li>Adicione <code className="bg-secondary px-1.5 py-0.5 rounded">http://localhost:3001/api/auth/gmail/callback</code> como URI de redirecionamento</li>
            <li>Copie o Client ID e Client Secret para o .env</li>
            <li>Clique em "Conectar" na seção Gmail acima</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
