import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { 
  Mail, 
  Bell, 
  Key,
  CheckCircle,
  XCircle,
  ExternalLink,
  Save,
  TestTube,
  Loader2,
  User,
  Coins
} from 'lucide-react';
import { apiRequest } from '@/lib/utils';

interface ConfigResponse {
  config: {
    anthropic: { apiKey: string };
    gmail: { clientId: string; clientSecret: string; redirectUri: string };
    alchemy: { apiKey: string };
    user: { email: string; vipSenders: string[]; ignoreSenders: string[] };
    notifications: { slackWebhookUrl: string; telegramBotToken: string; telegramChatId: string };
    settings: { emailCheckInterval: number; stablecoinCheckInterval: number };
    stablecoin: { thresholds: { largeMint: number; largeBurn: number; largeTransfer: number; supplyChangePercent: number } };
  };
  isConfigured: {
    anthropic: boolean;
    gmail: boolean;
    alchemy: boolean;
    userEmail: boolean;
    slack: boolean;
    telegram: boolean;
  };
}

export function Settings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'anthropic' | 'gmail' | 'alchemy' | 'user' | 'notifications'>('anthropic');
  
  // Form states
  const [anthropicKey, setAnthropicKey] = useState('');
  const [gmailClientId, setGmailClientId] = useState('');
  const [gmailClientSecret, setGmailClientSecret] = useState('');
  const [alchemyKey, setAlchemyKey] = useState('');
  const [stablecoinInterval, setStablecoinInterval] = useState(60);
  const [userEmail, setUserEmail] = useState('');
  const [vipSenders, setVipSenders] = useState('');
  const [ignoreSenders, setIgnoreSenders] = useState('');
  const [slackWebhook, setSlackWebhook] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const result = await apiRequest<ConfigResponse>('/config');
      // Preenche os campos com valores atuais
      setUserEmail(result.config.user.email);
      setVipSenders(result.config.user.vipSenders.join(', '));
      setIgnoreSenders(result.config.user.ignoreSenders.join(', '));
      setStablecoinInterval(result.config.settings.stablecoinCheckInterval || 60);
      return result;
    },
  });

  const saveAnthropicMutation = useMutation({
    mutationFn: (apiKey: string) => 
      apiRequest('/config/anthropic', { method: 'POST', body: JSON.stringify({ apiKey }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      setAnthropicKey('');
    },
  });

  const saveGmailMutation = useMutation({
    mutationFn: (data: { clientId: string; clientSecret: string }) =>
      apiRequest('/config/gmail', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      setGmailClientId('');
      setGmailClientSecret('');
    },
  });

  const saveUserMutation = useMutation({
    mutationFn: (data: { email: string; vipSenders: string[]; ignoreSenders: string[] }) =>
      apiRequest('/config/user', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['config'] }),
  });

  const saveNotificationsMutation = useMutation({
    mutationFn: (data: { slackWebhookUrl: string }) =>
      apiRequest('/config/notifications', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      setSlackWebhook('');
    },
  });

  const testAnthropicMutation = useMutation({
    mutationFn: async () => {
      console.log('[Test Anthropic] Iniciando teste...');
      const result = await apiRequest<{ success: boolean; message?: string; error?: string }>('/config/test/anthropic', { method: 'POST' });
      console.log('[Test Anthropic] Resultado:', result);
      return result;
    },
    onSuccess: (result) => {
      console.log('[Test Anthropic] onSuccess:', result);
      setTestResult({ 
        success: result.success, 
        message: result.success ? 'Conexão com Anthropic OK!' : (result.error || 'Erro') 
      });
    },
    onError: (error) => {
      console.error('[Test Anthropic] onError:', error);
      setTestResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    },
  });

  const saveAlchemyMutation = useMutation({
    mutationFn: (apiKey: string) =>
      apiRequest('/config/alchemy', { method: 'POST', body: JSON.stringify({ apiKey }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      setAlchemyKey('');
    },
  });

  const saveStablecoinConfigMutation = useMutation({
    mutationFn: (data: { checkInterval: number }) =>
      apiRequest('/config/stablecoin', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
    },
  });

  const testAlchemyMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest<{ success: boolean; message?: string; error?: string }>('/config/test/alchemy', { method: 'POST' });
      return result;
    },
    onSuccess: (result) => {
      setTestResult({ 
        success: result.success, 
        message: result.success ? (result.message || 'Conexão com Alchemy OK!') : (result.error || 'Erro') 
      });
    },
    onError: (error) => {
      setTestResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    },
  });

  const isConfigured = data?.isConfigured;

  const tabs = [
    { id: 'anthropic', label: 'Claude AI', icon: Key, configured: isConfigured?.anthropic },
    { id: 'gmail', label: 'Gmail', icon: Mail, configured: isConfigured?.gmail },
    { id: 'alchemy', label: 'Alchemy', icon: Coins, configured: isConfigured?.alchemy },
    { id: 'user', label: 'Usuário', icon: User, configured: isConfigured?.userEmail },
    { id: 'notifications', label: 'Notificações', icon: Bell, configured: isConfigured?.slack || isConfigured?.telegram },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Configurações</h2>
        <p className="text-muted-foreground">
          Configure as integrações e preferências do Agent Hub
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`p-4 rounded-xl border transition-all ${
              activeTab === tab.id 
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                : 'bg-card hover:border-primary/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <tab.icon className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium text-sm">{tab.label}</p>
                <p className={`text-xs ${tab.configured ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {tab.configured ? '✓ Configurado' : 'Pendente'}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Anthropic Config */}
      {activeTab === 'anthropic' && (
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Key className="h-5 w-5" />
              Configuração do Claude (Anthropic)
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              A API Key é necessária para classificar emails com IA
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">API Key</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder={isConfigured?.anthropic ? '••• Já configurado (insira nova para alterar)' : 'sk-ant-...'}
                  className="flex-1 px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={() => saveAnthropicMutation.mutate(anthropicKey)}
                  disabled={!anthropicKey || saveAnthropicMutation.isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {saveAnthropicMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setTestResult(null);
                  testAnthropicMutation.mutate();
                }}
                disabled={testAnthropicMutation.isPending || !isConfigured?.anthropic}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 disabled:opacity-50 flex items-center gap-2"
              >
                {testAnthropicMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                Testar Conexão
              </button>
              {testResult && (
                <span className={`text-sm flex items-center gap-1 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {testResult.message}
                </span>
              )}
              {!isConfigured?.anthropic && (
                <span className="text-sm text-muted-foreground">
                  Salve a API Key primeiro para testar
                </span>
              )}
            </div>

            <div className="p-4 bg-secondary/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Como obter:</strong> Acesse{' '}
                <a href="https://console.anthropic.com/settings/keys" target="_blank" className="text-primary hover:underline">
                  console.anthropic.com <ExternalLink className="h-3 w-3 inline" />
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Gmail Config */}
      {activeTab === 'gmail' && (
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Configuração do Gmail OAuth
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Permite que o agente leia e classifique seus emails
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Client ID</label>
              <input
                type="text"
                value={gmailClientId}
                onChange={(e) => setGmailClientId(e.target.value)}
                placeholder={isConfigured?.gmail ? '••• Já configurado' : 'xxxxx.apps.googleusercontent.com'}
                className="w-full px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Client Secret</label>
              <input
                type="password"
                value={gmailClientSecret}
                onChange={(e) => setGmailClientSecret(e.target.value)}
                placeholder={isConfigured?.gmail ? '••• Já configurado' : 'GOCSPX-...'}
                className="w-full px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={() => saveGmailMutation.mutate({ clientId: gmailClientId, clientSecret: gmailClientSecret })}
              disabled={(!gmailClientId || !gmailClientSecret) || saveGmailMutation.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {saveGmailMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Configuração
            </button>

            {isConfigured?.gmail && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Gmail configurado! Agora você precisa autorizar o acesso.
                </p>
                <a
                  href="/api/auth/gmail/url"
                  target="_blank"
                  className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Autorizar Gmail <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}

            <div className="p-4 bg-secondary/50 rounded-lg space-y-2">
              <p className="text-sm font-medium">Como configurar:</p>
              <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                <li>Acesse <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="text-primary hover:underline">Google Cloud Console <ExternalLink className="h-3 w-3 inline" /></a></li>
                <li>Crie ou selecione um projeto</li>
                <li>Ative a <strong>Gmail API</strong></li>
                <li>Vá em <strong>Credenciais → Criar credenciais → ID do cliente OAuth</strong></li>
                <li>Tipo: <strong>Aplicativo da Web</strong></li>
                <li>Adicione URI de redirecionamento: <code className="bg-secondary px-1 rounded">http://localhost:3001/api/auth/gmail/callback</code></li>
                <li>Copie o Client ID e Client Secret aqui</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Alchemy Config */}
      {activeTab === 'alchemy' && (
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Configuração do Alchemy
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Necessário para monitorar transações de stablecoins na blockchain
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">API Key</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={alchemyKey}
                  onChange={(e) => setAlchemyKey(e.target.value)}
                  placeholder={isConfigured?.alchemy ? '••• Já configurado (insira nova para alterar)' : 'Sua API Key do Alchemy'}
                  className="flex-1 px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={() => saveAlchemyMutation.mutate(alchemyKey)}
                  disabled={!alchemyKey || saveAlchemyMutation.isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {saveAlchemyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setTestResult(null);
                  testAlchemyMutation.mutate();
                }}
                disabled={testAlchemyMutation.isPending || !isConfigured?.alchemy}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 disabled:opacity-50 flex items-center gap-2"
              >
                {testAlchemyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                Testar Conexão
              </button>
              {testResult && (
                <span className={`text-sm flex items-center gap-1 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {testResult.message}
                </span>
              )}
              {!isConfigured?.alchemy && (
                <span className="text-sm text-muted-foreground">
                  Salve a API Key primeiro para testar
                </span>
              )}
            </div>

            <div className="border-t pt-4 mt-4">
              <label className="block text-sm font-medium mb-2">Intervalo de Verificação</label>
              <div className="flex items-center gap-4">
                <select
                  value={stablecoinInterval}
                  onChange={(e) => setStablecoinInterval(Number(e.target.value))}
                  className="px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value={30}>30 minutos</option>
                  <option value={60}>60 minutos (1 hora)</option>
                  <option value={120}>120 minutos (2 horas)</option>
                </select>
                <button
                  onClick={() => saveStablecoinConfigMutation.mutate({ checkInterval: stablecoinInterval })}
                  disabled={saveStablecoinConfigMutation.isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {saveStablecoinConfigMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Define a cada quanto tempo o Stablecoin Agent verifica novos eventos
              </p>
            </div>

            <div className="p-4 bg-secondary/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Como obter:</strong> Acesse{' '}
                <a href="https://dashboard.alchemy.com" target="_blank" className="text-primary hover:underline">
                  dashboard.alchemy.com <ExternalLink className="h-3 w-3 inline" />
                </a>
                {' '}→ Crie um App → Copie a API Key
              </p>
            </div>
          </div>
        </div>
      )}

      {/* User Config */}
      {activeTab === 'user' && (
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <User className="h-5 w-5" />
              Configuração do Usuário
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Seu Email</label>
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Usado para identificar quando você é o destinatário principal
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Remetentes VIP (sempre prioridade alta)</label>
              <input
                type="text"
                value={vipSenders}
                onChange={(e) => setVipSenders(e.target.value)}
                placeholder="ceo@empresa.com, diretoria@empresa.com"
                className="w-full px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Separe por vírgula. Emails desses remetentes sempre serão marcados como urgentes.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Remetentes para Ignorar (baixa prioridade)</label>
              <input
                type="text"
                value={ignoreSenders}
                onChange={(e) => setIgnoreSenders(e.target.value)}
                placeholder="newsletter, marketing, noreply"
                className="w-full px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Separe por vírgula. Pode ser parte do email (ex: "newsletter" pega qualquer email que contenha essa palavra).
              </p>
            </div>
            <button
              onClick={() => saveUserMutation.mutate({
                email: userEmail,
                vipSenders: vipSenders.split(',').map(s => s.trim()).filter(Boolean),
                ignoreSenders: ignoreSenders.split(',').map(s => s.trim()).filter(Boolean),
              })}
              disabled={!userEmail || saveUserMutation.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {saveUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Configurações
            </button>
          </div>
        </div>
      )}

      {/* Notifications Config */}
      {activeTab === 'notifications' && (
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificações
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Receba alertas quando houver emails urgentes
            </p>
          </div>
          <div className="p-6 space-y-6">
            {/* Slack */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <span className="h-8 w-8 bg-[#4A154B] rounded flex items-center justify-center text-white text-xs font-bold">S</span>
                Slack
              </h4>
              <div>
                <label className="block text-sm font-medium mb-2">Webhook URL</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={slackWebhook}
                    onChange={(e) => setSlackWebhook(e.target.value)}
                    placeholder={isConfigured?.slack ? '••• Já configurado' : 'https://hooks.slack.com/services/...'}
                    className="flex-1 px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={() => saveNotificationsMutation.mutate({ slackWebhookUrl: slackWebhook })}
                    disabled={!slackWebhook || saveNotificationsMutation.isPending}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 bg-secondary/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Como obter Webhook do Slack:</strong> Crie um app no Slack, ative Incoming Webhooks e copie a URL.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success Messages */}
      {(saveAnthropicMutation.isSuccess || saveGmailMutation.isSuccess || saveAlchemyMutation.isSuccess || saveStablecoinConfigMutation.isSuccess || saveUserMutation.isSuccess || saveNotificationsMutation.isSuccess) && (
        <div className="fixed bottom-4 right-4 p-4 bg-green-600 text-white rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom">
          <CheckCircle className="h-5 w-5" />
          Configuração salva com sucesso!
        </div>
      )}
    </div>
  );
}
