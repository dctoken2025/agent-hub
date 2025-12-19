import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Settings, Mail, Scale, Plus, Trash2, Save, 
  Clock, Zap, AlertTriangle, CheckCircle, Edit2, X,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Coins
} from 'lucide-react';
import { useDialog } from '../components/Dialog';

const API_BASE = 'http://localhost:3001/api';

interface ClassificationRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: {
    field: 'subject' | 'body' | 'from' | 'all';
    operator: 'contains' | 'startsWith' | 'endsWith' | 'equals' | 'regex';
    value: string;
    caseSensitive?: boolean;
  };
  action: {
    priority: 'urgent' | 'attention' | 'informative' | 'low' | 'cc_only';
    tags?: string[];
    requiresAction?: boolean;
    reasoning?: string;
  };
}

interface EmailAgentSettings {
  enabled: boolean;
  intervalMinutes: number;
  maxEmailsPerRun: number;
  processContracts: boolean;
  unreadOnly: boolean;
  customRules: ClassificationRule[];
}

interface LegalAgentSettings {
  enabled: boolean;
  autoAnalyze: boolean;
  maxDocumentSizeMB: number;
  contractKeywords: string[];
  highRiskKeywords: string[];
}

interface StablecoinAgentSettings {
  enabled: boolean;
  checkInterval: number;
  thresholds: {
    largeMint: number;
    largeBurn: number;
    largeTransfer: number;
    supplyChangePercent: number;
    frequencyPerHour: number;
  };
}

interface AgentConfigResponse {
  emailAgent: EmailAgentSettings;
  legalAgent: LegalAgentSettings;
  stablecoinAgent: StablecoinAgentSettings;
}

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

const priorityConfig = {
  urgent: { label: 'Urgente', color: 'bg-red-500', icon: '🔴' },
  attention: { label: 'Atenção', color: 'bg-orange-500', icon: '🟠' },
  informative: { label: 'Informativo', color: 'bg-blue-500', icon: '🔵' },
  low: { label: 'Baixa', color: 'bg-gray-400', icon: '⚪' },
  cc_only: { label: 'Só CC', color: 'bg-purple-400', icon: '📋' },
};

const fieldLabels = {
  subject: 'Assunto',
  body: 'Corpo',
  from: 'Remetente',
  all: 'Tudo',
};

const operatorLabels = {
  contains: 'contém',
  startsWith: 'começa com',
  endsWith: 'termina com',
  equals: 'igual a',
  regex: 'regex',
};

export default function AgentConfig() {
  const queryClient = useQueryClient();
  const dialog = useDialog();
  const [expandedSection, setExpandedSection] = useState<'email' | 'legal' | 'stablecoin' | null>('email');
  const [editingRule, setEditingRule] = useState<ClassificationRule | null>(null);
  const [showNewRule, setShowNewRule] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['agentConfig'],
    queryFn: () => apiRequest<AgentConfigResponse>('/config/agents'),
  });

  const updateEmailAgent = useMutation({
    mutationFn: (settings: Partial<EmailAgentSettings>) =>
      apiRequest('/config/agents/email', {
        method: 'PUT',
        body: JSON.stringify(settings),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentConfig'] });
      dialog.success('Configurações do Email Agent salvas!');
    },
    onError: (error: Error) => dialog.error(error.message),
  });

  const updateLegalAgent = useMutation({
    mutationFn: (settings: Partial<LegalAgentSettings>) =>
      apiRequest('/config/agents/legal', {
        method: 'PUT',
        body: JSON.stringify(settings),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentConfig'] });
      dialog.success('Configurações do Legal Agent salvas!');
    },
    onError: (error: Error) => dialog.error(error.message),
  });

  const updateStablecoinAgent = useMutation({
    mutationFn: (settings: Partial<StablecoinAgentSettings>) =>
      apiRequest('/config/agents/stablecoin', {
        method: 'PUT',
        body: JSON.stringify(settings),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentConfig'] });
      dialog.success('Configurações do Stablecoin Agent salvas!');
    },
    onError: (error: Error) => dialog.error(error.message),
  });

  const addRule = useMutation({
    mutationFn: (rule: ClassificationRule) =>
      apiRequest('/config/agents/email/rules', {
        method: 'POST',
        body: JSON.stringify(rule),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentConfig'] });
      setShowNewRule(false);
      dialog.success('Regra adicionada!');
    },
    onError: (error: Error) => dialog.error(error.message),
  });

  const updateRule = useMutation({
    mutationFn: ({ id, rule }: { id: string; rule: Partial<ClassificationRule> }) =>
      apiRequest(`/config/agents/email/rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(rule),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentConfig'] });
      setEditingRule(null);
      dialog.success('Regra atualizada!');
    },
    onError: (error: Error) => dialog.error(error.message),
  });

  const deleteRule = useMutation({
    mutationFn: (ruleId: string) =>
      apiRequest(`/config/agents/email/rules/${ruleId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentConfig'] });
      dialog.success('Regra removida!');
    },
    onError: (error: Error) => dialog.error(error.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const emailConfig = data?.emailAgent;
  const legalConfig = data?.legalAgent;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Configuração de Agentes
        </h2>
        <p className="text-muted-foreground">
          Personalize o comportamento dos agentes com regras customizadas
        </p>
      </div>

      {/* Email Agent Config */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'email' ? null : 'email')}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold">Email Agent</h3>
              <p className="text-sm text-muted-foreground">
                {emailConfig?.customRules?.length || 0} regras personalizadas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-1 rounded text-xs font-medium ${emailConfig?.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {emailConfig?.enabled ? 'Ativo' : 'Inativo'}
            </span>
            {expandedSection === 'email' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </div>
        </button>

        {expandedSection === 'email' && emailConfig && (
          <div className="p-4 border-t space-y-6">
            {/* Configurações Gerais */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Clock className="h-4 w-4" /> Intervalo (min)
                </label>
                <input
                  type="number"
                  value={emailConfig.intervalMinutes}
                  onChange={(e) => updateEmailAgent.mutate({ intervalMinutes: parseInt(e.target.value) || 10 })}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                  min={1}
                  max={60}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Emails por execução</label>
                <input
                  type="number"
                  value={emailConfig.maxEmailsPerRun}
                  onChange={(e) => updateEmailAgent.mutate({ maxEmailsPerRun: parseInt(e.target.value) || 50 })}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                  min={10}
                  max={200}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Processar contratos</label>
                <button
                  onClick={() => updateEmailAgent.mutate({ processContracts: !emailConfig.processContracts })}
                  className={`w-full px-3 py-2 border rounded-lg flex items-center justify-center gap-2 transition-colors ${
                    emailConfig.processContracts ? 'bg-green-100 border-green-300 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {emailConfig.processContracts ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                  {emailConfig.processContracts ? 'Sim' : 'Não'}
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Apenas não lidos</label>
                <button
                  onClick={() => updateEmailAgent.mutate({ unreadOnly: !emailConfig.unreadOnly })}
                  className={`w-full px-3 py-2 border rounded-lg flex items-center justify-center gap-2 transition-colors ${
                    emailConfig.unreadOnly ? 'bg-green-100 border-green-300 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {emailConfig.unreadOnly ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                  {emailConfig.unreadOnly ? 'Sim' : 'Não'}
                </button>
              </div>
            </div>

            {/* Regras de Classificação */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Regras de Classificação Personalizadas
                </h4>
                <button
                  onClick={() => setShowNewRule(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  Nova Regra
                </button>
              </div>

              {/* Nova Regra Form */}
              {showNewRule && (
                <RuleForm
                  onSave={(rule) => addRule.mutate(rule)}
                  onCancel={() => setShowNewRule(false)}
                  isLoading={addRule.isPending}
                />
              )}

              {/* Lista de Regras */}
              <div className="space-y-2">
                {(emailConfig.customRules || []).map((rule) => (
                  <div key={rule.id}>
                    {editingRule?.id === rule.id ? (
                      <RuleForm
                        rule={editingRule}
                        onSave={(updated) => updateRule.mutate({ id: rule.id, rule: updated })}
                        onCancel={() => setEditingRule(null)}
                        isLoading={updateRule.isPending}
                      />
                    ) : (
                      <div className={`p-3 border rounded-lg flex items-center justify-between ${rule.enabled ? 'bg-muted/30' : 'bg-muted/10 opacity-60'}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{priorityConfig[rule.action.priority]?.icon}</span>
                          <div>
                            <p className="font-medium">{rule.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Se <span className="font-mono text-xs bg-muted px-1 rounded">{fieldLabels[rule.condition.field]}</span>
                              {' '}{operatorLabels[rule.condition.operator]}{' '}
                              "<span className="font-semibold">{rule.condition.value}</span>"
                              {' → '}<span className={`px-1.5 py-0.5 rounded text-xs text-white ${priorityConfig[rule.action.priority]?.color}`}>
                                {priorityConfig[rule.action.priority]?.label}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateRule.mutate({ id: rule.id, rule: { enabled: !rule.enabled } })}
                            className={`p-1.5 rounded ${rule.enabled ? 'text-green-600' : 'text-gray-400'}`}
                            title={rule.enabled ? 'Desativar' : 'Ativar'}
                          >
                            {rule.enabled ? <CheckCircle className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => setEditingRule(rule)}
                            className="p-1.5 rounded text-blue-600 hover:bg-blue-100"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={async () => {
                              if (await dialog.confirm(`Remover regra "${rule.name}"?`)) {
                                deleteRule.mutate(rule.id);
                              }
                            }}
                            className="p-1.5 rounded text-red-600 hover:bg-red-100"
                            title="Remover"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {(emailConfig.customRules || []).length === 0 && !showNewRule && (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhuma regra personalizada. Clique em "Nova Regra" para adicionar.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legal Agent Config */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'legal' ? null : 'legal')}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Scale className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold">Legal Agent</h3>
              <p className="text-sm text-muted-foreground">
                Análise automática de contratos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-1 rounded text-xs font-medium ${legalConfig?.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {legalConfig?.enabled ? 'Ativo' : 'Inativo'}
            </span>
            {expandedSection === 'legal' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </div>
        </button>

        {expandedSection === 'legal' && legalConfig && (
          <div className="p-4 border-t space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Análise automática</label>
                <button
                  onClick={() => updateLegalAgent.mutate({ autoAnalyze: !legalConfig.autoAnalyze })}
                  className={`w-full px-3 py-2 border rounded-lg flex items-center justify-center gap-2 transition-colors ${
                    legalConfig.autoAnalyze ? 'bg-green-100 border-green-300 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {legalConfig.autoAnalyze ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                  {legalConfig.autoAnalyze ? 'Ativada' : 'Desativada'}
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tamanho máx. (MB)</label>
                <input
                  type="number"
                  value={legalConfig.maxDocumentSizeMB}
                  onChange={(e) => updateLegalAgent.mutate({ maxDocumentSizeMB: parseInt(e.target.value) || 10 })}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                  min={1}
                  max={50}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                Palavras-chave de contrato
                <span className="text-xs text-muted-foreground">(uma por linha)</span>
              </label>
              <textarea
                value={(legalConfig.contractKeywords || []).join('\n')}
                onChange={(e) => updateLegalAgent.mutate({ 
                  contractKeywords: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) 
                })}
                className="w-full px-3 py-2 border rounded-lg bg-background h-24 font-mono text-sm"
                placeholder="contrato&#10;acordo&#10;termo"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Palavras-chave de alto risco
                <span className="text-xs text-muted-foreground">(uma por linha)</span>
              </label>
              <textarea
                value={(legalConfig.highRiskKeywords || []).join('\n')}
                onChange={(e) => updateLegalAgent.mutate({ 
                  highRiskKeywords: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) 
                })}
                className="w-full px-3 py-2 border rounded-lg bg-background h-24 font-mono text-sm"
                placeholder="penalidade&#10;multa&#10;rescisão"
              />
            </div>
          </div>
        )}
      </div>

      {/* Stablecoin Agent Config */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'stablecoin' ? null : 'stablecoin')}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
              <Coins className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold">Stablecoin Agent</h3>
              <p className="text-sm text-muted-foreground">
                Monitoramento de stablecoins na blockchain
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-1 rounded text-xs font-medium ${data?.stablecoinAgent?.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {data?.stablecoinAgent?.enabled ? 'Ativo' : 'Inativo'}
            </span>
            {expandedSection === 'stablecoin' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </div>
        </button>

        {expandedSection === 'stablecoin' && data?.stablecoinAgent && (
          <div className="p-4 border-t space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Clock className="h-4 w-4" /> Intervalo (min)
                </label>
                <input
                  type="number"
                  value={data.stablecoinAgent.checkInterval}
                  onChange={(e) => updateStablecoinAgent.mutate({ checkInterval: parseInt(e.target.value) || 60 })}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                  min={1}
                  max={1440}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Agente ativo</label>
                <button
                  onClick={() => updateStablecoinAgent.mutate({ enabled: !data.stablecoinAgent.enabled })}
                  className={`w-full px-3 py-2 border rounded-lg flex items-center justify-center gap-2 transition-colors ${
                    data.stablecoinAgent.enabled ? 'bg-green-100 border-green-300 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {data.stablecoinAgent.enabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                  {data.stablecoinAgent.enabled ? 'Sim' : 'Não'}
                </button>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Limites de Alerta
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mint grande (USD)</label>
                  <input
                    type="number"
                    value={data.stablecoinAgent.thresholds?.largeMint || 10000000}
                    onChange={(e) => updateStablecoinAgent.mutate({ 
                      thresholds: { 
                        ...data.stablecoinAgent.thresholds, 
                        largeMint: parseInt(e.target.value) || 10000000 
                      } 
                    })}
                    className="w-full px-3 py-2 border rounded-lg bg-background"
                    min={1000}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Burn grande (USD)</label>
                  <input
                    type="number"
                    value={data.stablecoinAgent.thresholds?.largeBurn || 10000000}
                    onChange={(e) => updateStablecoinAgent.mutate({ 
                      thresholds: { 
                        ...data.stablecoinAgent.thresholds, 
                        largeBurn: parseInt(e.target.value) || 10000000 
                      } 
                    })}
                    className="w-full px-3 py-2 border rounded-lg bg-background"
                    min={1000}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Transfer grande (USD)</label>
                  <input
                    type="number"
                    value={data.stablecoinAgent.thresholds?.largeTransfer || 50000000}
                    onChange={(e) => updateStablecoinAgent.mutate({ 
                      thresholds: { 
                        ...data.stablecoinAgent.thresholds, 
                        largeTransfer: parseInt(e.target.value) || 50000000 
                      } 
                    })}
                    className="w-full px-3 py-2 border rounded-lg bg-background"
                    min={1000}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mudança supply (%)</label>
                  <input
                    type="number"
                    value={data.stablecoinAgent.thresholds?.supplyChangePercent || 1}
                    onChange={(e) => updateStablecoinAgent.mutate({ 
                      thresholds: { 
                        ...data.stablecoinAgent.thresholds, 
                        supplyChangePercent: parseFloat(e.target.value) || 1 
                      } 
                    })}
                    className="w-full px-3 py-2 border rounded-lg bg-background"
                    min={0.1}
                    step={0.1}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Frequência/hora</label>
                  <input
                    type="number"
                    value={data.stablecoinAgent.thresholds?.frequencyPerHour || 100}
                    onChange={(e) => updateStablecoinAgent.mutate({ 
                      thresholds: { 
                        ...data.stablecoinAgent.thresholds, 
                        frequencyPerHour: parseInt(e.target.value) || 100 
                      } 
                    })}
                    className="w-full px-3 py-2 border rounded-lg bg-background"
                    min={1}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente de formulário de regra
function RuleForm({ 
  rule, 
  onSave, 
  onCancel, 
  isLoading 
}: { 
  rule?: ClassificationRule; 
  onSave: (rule: ClassificationRule) => void; 
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState<ClassificationRule>(rule || {
    id: `rule-${Date.now()}`,
    name: '',
    enabled: true,
    condition: {
      field: 'all',
      operator: 'contains',
      value: '',
      caseSensitive: false,
    },
    action: {
      priority: 'urgent',
      tags: [],
      requiresAction: true,
      reasoning: '',
    },
  });

  return (
    <div className="p-4 border rounded-lg bg-muted/20 space-y-4 mb-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Nome da regra</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg bg-background"
            placeholder="Ex: Emails sobre atraso"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Prioridade resultante</label>
          <select
            value={form.action.priority}
            onChange={(e) => setForm({ 
              ...form, 
              action: { ...form.action, priority: e.target.value as ClassificationRule['action']['priority'] } 
            })}
            className="w-full px-3 py-2 border rounded-lg bg-background"
          >
            {Object.entries(priorityConfig).map(([key, config]) => (
              <option key={key} value={key}>{config.icon} {config.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Campo</label>
          <select
            value={form.condition.field}
            onChange={(e) => setForm({ 
              ...form, 
              condition: { ...form.condition, field: e.target.value as ClassificationRule['condition']['field'] } 
            })}
            className="w-full px-3 py-2 border rounded-lg bg-background"
          >
            {Object.entries(fieldLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Operador</label>
          <select
            value={form.condition.operator}
            onChange={(e) => setForm({ 
              ...form, 
              condition: { ...form.condition, operator: e.target.value as ClassificationRule['condition']['operator'] } 
            })}
            className="w-full px-3 py-2 border rounded-lg bg-background"
          >
            {Object.entries(operatorLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Valor</label>
          <input
            type="text"
            value={form.condition.value}
            onChange={(e) => setForm({ 
              ...form, 
              condition: { ...form.condition, value: e.target.value } 
            })}
            className="w-full px-3 py-2 border rounded-lg bg-background"
            placeholder="Ex: atraso"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Justificativa (opcional)</label>
        <input
          type="text"
          value={form.action.reasoning || ''}
          onChange={(e) => setForm({ 
            ...form, 
            action: { ...form.action, reasoning: e.target.value } 
          })}
          className="w-full px-3 py-2 border rounded-lg bg-background"
          placeholder="Ex: Email menciona atraso - requer atenção imediata"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 border rounded-lg hover:bg-muted"
          disabled={isLoading}
        >
          <X className="h-4 w-4 inline mr-1" />
          Cancelar
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={!form.name || !form.condition.value || isLoading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4 inline mr-1" />
          {isLoading ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

