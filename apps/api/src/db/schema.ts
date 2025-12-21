import { pgTable, text, timestamp, boolean, integer, jsonb, serial, varchar, uuid } from 'drizzle-orm/pg-core';

// ===========================================
// Usuários
// ===========================================
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  role: varchar('role', { length: 20 }).notNull().default('user'), // 'admin' ou 'user'
  gmailTokens: jsonb('gmail_tokens'), // Tokens OAuth individuais do Gmail
  isActive: boolean('is_active').default(true),
  accountStatus: varchar('account_status', { length: 20 }).notNull().default('pending'), // 'pending', 'active', 'suspended', 'trial_expired'
  trialEndsAt: timestamp('trial_ends_at'), // Data de expiração do período de teste (7 dias após criação)
  onboardingCompleted: boolean('onboarding_completed').default(false), // Se o usuário já completou o tutorial de onboarding
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ===========================================
// Configurações Globais (só admin modifica)
// ===========================================
export const globalConfig = pgTable('global_config', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: text('value'),
  isSecret: boolean('is_secret').default(false),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ===========================================
// Configurações por Usuário
// ===========================================
export const userConfigs = pgTable('user_configs', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  
  // Preferências de email
  vipSenders: text('vip_senders').array(),
  ignoreSenders: text('ignore_senders').array(),
  
  // Configurações dos agentes (JSON)
  emailAgentConfig: jsonb('email_agent_config').default({
    enabled: true,
    intervalMinutes: 10,
    maxEmailsPerRun: 50,
    processContracts: true,
    unreadOnly: true,
    customRules: [],
  }),
  
  // Contexto personalizado de cada agente (gerado via "Ensinar Agente")
  agentContexts: jsonb('agent_contexts').default({
    email: null,
    legal: null,
    financial: null,
    stablecoin: null,
    task: null,
    focus: null,
  }),
  legalAgentConfig: jsonb('legal_agent_config').default({
    enabled: true,
    autoAnalyze: true,
    maxDocumentSizeMB: 10,
    contractKeywords: [
      'contrato', 'acordo', 'termo', 'aditivo', 'minuta', 'proposta',
      'procuração', 'estatuto', 'ata', 'cessão', 'licença',
      'empréstimo', 'mútuo', 'garantia', 'fiança', 'hipoteca',
      'prestação de serviços', 'parceria', 'confidencialidade', 'nda',
      'memorando', 'letter of intent', 'loi', 'term sheet'
    ],
    highRiskKeywords: [
      'multa', 'penalidade', 'indenização', 'perdas e danos',
      'exclusividade', 'não-competição', 'non-compete', 'não concorrência',
      'confidencialidade perpétua', 'prazo indeterminado',
      'rescisão imediata', 'vencimento antecipado', 'cross-default',
      'responsabilidade ilimitada', 'solidariamente responsável',
      'renúncia', 'irrevogável', 'irretratável',
      'foro de', 'arbitragem', 'cláusula penal',
      'renovação automática', 'reajuste', 'correção monetária'
    ],
  }),
  stablecoinAgentConfig: jsonb('stablecoin_agent_config').default({
    enabled: false,
    checkInterval: 60,
    thresholds: {
      largeMint: 10000000,
      largeBurn: 10000000,
      largeTransfer: 50000000,
      supplyChangePercent: 1,
      frequencyPerHour: 100,
    },
  }),
  financialAgentConfig: jsonb('financial_agent_config').default({
    enabled: true,
    autoAnalyze: true,
    urgentDaysBeforeDue: 3,
    approvalThreshold: 500000, // R$ 5.000 em centavos
    financialKeywords: [
      'boleto', 'fatura', 'invoice', 'cobrança', 'pagamento',
      'vencimento', 'vence em', 'pagar até', 'payment due',
      'nota fiscal', 'nf-e', 'nfe', 'danfe', 'recibo',
      'valor', 'parcela', 'mensalidade', 'anuidade',
      'total a pagar', 'amount due',
      'banco', 'pix', 'transferência',
      'efetuar pagamento', 'segue boleto', 'anexo boleto',
    ],
  }),
  
  // Notificações
  notificationConfig: jsonb('notification_config').default({
    slackWebhookUrl: '',
    telegramBotToken: '',
    telegramChatId: '',
  }),
  
  // Estado dos agentes (para auto-start após reinício do servidor)
  agentsActive: boolean('agents_active').default(false),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ===========================================
// Logs de Atividade dos Agentes (detalhado)
// ===========================================
export const agentActivityLogs = pgTable('agent_activity_logs', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  agentId: varchar('agent_id', { length: 100 }).notNull(),
  agentName: varchar('agent_name', { length: 100 }).notNull(),
  level: varchar('level', { length: 20 }).notNull().default('info'), // info, success, warning, error, debug
  emoji: varchar('emoji', { length: 10 }),
  message: text('message').notNull(),
  details: text('details'), // Detalhes adicionais (JSON ou texto)
  createdAt: timestamp('created_at').defaultNow(),
});

// ===========================================
// Configurações do Sistema (LEGADO - será migrado)
// ===========================================
export const appConfig = pgTable('app_config', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: text('value'),
  isSecret: boolean('is_secret').default(false),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ===========================================
// Emails Classificados
// ===========================================
export const classifiedEmails = pgTable('classified_emails', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  emailId: varchar('email_id', { length: 255 }).notNull(),
  threadId: varchar('thread_id', { length: 255 }),
  fromEmail: varchar('from_email', { length: 255 }).notNull(),
  fromName: varchar('from_name', { length: 255 }),
  toEmails: text('to_emails'), // JSON array
  ccEmails: text('cc_emails'), // JSON array
  subject: text('subject'),
  snippet: text('snippet'),
  body: text('body'),
  
  // Classificação
  priority: varchar('priority', { length: 50 }).notNull(), // urgent, attention, informative, low, cc_only
  action: varchar('action', { length: 50 }).notNull(), // respond_now, respond_later, read_only, mark_read, archive
  confidence: integer('confidence'),
  reasoning: text('reasoning'),
  suggestedResponse: text('suggested_response'),
  tags: text('tags'), // JSON array
  sentiment: varchar('sentiment', { length: 50 }), // positive, neutral, negative, urgent
  isDirectedToMe: boolean('is_directed_to_me').default(false),
  requiresAction: boolean('requires_action').default(false),
  deadline: varchar('deadline', { length: 50 }),
  
  // Metadata
  emailDate: timestamp('email_date'),
  classifiedAt: timestamp('classified_at').defaultNow(),
  isRead: boolean('is_read').default(false),
  isArchived: boolean('is_archived').default(false),
  hasAttachments: boolean('has_attachments').default(false),
});

// ===========================================
// Logs de Execução dos Agentes
// ===========================================
export const agentLogs = pgTable('agent_logs', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  agentId: varchar('agent_id', { length: 100 }).notNull(),
  agentName: varchar('agent_name', { length: 255 }),
  eventType: varchar('event_type', { length: 50 }).notNull(), // started, completed, failed, paused
  success: boolean('success'),
  duration: integer('duration'), // em ms
  processedCount: integer('processed_count'),
  details: jsonb('details'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ===========================================
// Análises Jurídicas
// ===========================================
export const legalAnalyses = pgTable('legal_analyses', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  emailId: varchar('email_id', { length: 255 }).notNull(),
  documentName: varchar('document_name', { length: 500 }).notNull(),
  documentType: varchar('document_type', { length: 100 }),
  parties: text('parties'), // texto simples com as partes (CSV ou descritivo)
  summary: text('summary'),
  keyDates: jsonb('key_dates'), // JSON flexível
  financialTerms: jsonb('financial_terms'), // JSON flexível
  criticalClauses: jsonb('critical_clauses'), // JSON flexível
  risks: jsonb('risks'), // JSON flexível
  suggestions: jsonb('suggestions'), // JSON flexível
  overallRisk: varchar('overall_risk', { length: 20 }).notNull(), // low, medium, high, critical
  requiresAttention: boolean('requires_attention').default(false),
  analyzedAt: timestamp('analyzed_at').defaultNow(),
  
  // Novos campos para ações e responsáveis
  requiredAction: varchar('required_action', { length: 20 }), // approve, sign, review, negotiate, reject, none
  actionDescription: text('action_description'),
  responsibleParties: jsonb('responsible_parties'), // JSON array
  actionDeadline: varchar('action_deadline', { length: 50 }),
  isUrgent: boolean('is_urgent').default(false),
  nextSteps: jsonb('next_steps'), // JSON array de strings
  
  // Status de resolução
  status: varchar('status', { length: 20 }).default('pending'), // pending, in_progress, resolved
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: varchar('resolved_by', { length: 255 }),
  resolutionNotes: text('resolution_notes'),
  
  // Agrupamento por thread/tema
  threadId: varchar('thread_id', { length: 255 }), // threadId do email para agrupar
  groupId: varchar('group_id', { length: 255 }), // ID de grupo para análises relacionadas
});

// ===========================================
// Itens Financeiros (Cobranças, Boletos, Faturas)
// ===========================================
export const financialItems = pgTable('financial_items', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  emailId: varchar('email_id', { length: 255 }).notNull(),
  threadId: varchar('thread_id', { length: 255 }),
  
  // Contexto do email original
  emailSubject: text('email_subject'),
  emailFrom: varchar('email_from', { length: 255 }),
  emailDate: timestamp('email_date'),

  // Tipo e status
  type: varchar('type', { length: 20 }).notNull(), // boleto, fatura, cobranca, nota_fiscal, recibo, outro
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, paid, overdue, cancelled, disputed
  
  // Valores
  amount: integer('amount').notNull(), // Valor em centavos
  currency: varchar('currency', { length: 10 }).default('BRL'),
  
  // Datas
  dueDate: timestamp('due_date'),
  issueDate: timestamp('issue_date'),
  competenceDate: varchar('competence_date', { length: 7 }), // YYYY-MM
  paidAt: timestamp('paid_at'),
  
  // Credor
  creditor: varchar('creditor', { length: 255 }).notNull(),
  creditorType: varchar('creditor_type', { length: 20 }), // fornecedor, cliente, governo, banco, servico, outro
  creditorDocument: varchar('creditor_document', { length: 20 }), // CNPJ/CPF
  
  // Detalhes
  description: text('description').notNull(),
  category: varchar('category', { length: 20 }), // operacional, imposto, folha, servico, produto, aluguel, utilidade, marketing, juridico, outro
  reference: varchar('reference', { length: 255 }), // Número de referência, NF, pedido
  installmentCurrent: integer('installment_current'),
  installmentTotal: integer('installment_total'),
  
  // Dados do boleto
  barcodeData: varchar('barcode_data', { length: 60 }),
  barcodeType: varchar('barcode_type', { length: 20 }), // boleto, concessionaria, arrecadacao
  bankCode: varchar('bank_code', { length: 10 }),
  
  // Formas de pagamento alternativas
  pixKey: varchar('pix_key', { length: 255 }),
  pixKeyType: varchar('pix_key_type', { length: 10 }), // email, phone, cpf, cnpj, random
  bankAccount: jsonb('bank_account'), // { bank, agency, account, accountType, holder }
  
  // Recorrência
  recurrence: varchar('recurrence', { length: 20 }), // once, weekly, monthly, quarterly, semiannual, annual
  
  // Anexo
  attachmentId: varchar('attachment_id', { length: 255 }),
  attachmentFilename: varchar('attachment_filename', { length: 500 }),
  
  // Análise
  priority: varchar('priority', { length: 10 }).default('normal'), // urgent, high, normal, low
  notes: text('notes'),
  relatedProject: varchar('related_project', { length: 255 }),
  requiresApproval: boolean('requires_approval').default(false),
  
  // Aprovação
  approvedBy: varchar('approved_by', { length: 255 }),
  approvedAt: timestamp('approved_at'),
  
  // Metadados
  confidence: integer('confidence'), // 0-100
  analyzedAt: timestamp('analyzed_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ===========================================
// Stablecoins Monitoradas
// ===========================================
export const stablecoins = pgTable('stablecoins', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  address: varchar('address', { length: 42 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  symbol: varchar('symbol', { length: 10 }).notNull(),
  decimals: integer('decimals').notNull().default(18),
  network: varchar('network', { length: 50 }).notNull(), // ethereum, polygon, arbitrum, optimism, base
  isActive: boolean('is_active').default(true),
  lastSupply: text('last_supply'), // bigint como string
  lastCheckedAt: timestamp('last_checked_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ===========================================
// Eventos de Stablecoin (Mint/Burn/Transfer)
// ===========================================
export const stablecoinEvents = pgTable('stablecoin_events', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  stablecoinId: integer('stablecoin_id').notNull(),
  txHash: varchar('tx_hash', { length: 66 }).notNull(),
  blockNumber: integer('block_number').notNull(),
  logIndex: integer('log_index').default(0),
  eventType: varchar('event_type', { length: 20 }).notNull(), // mint, burn, transfer
  fromAddress: varchar('from_address', { length: 42 }),
  toAddress: varchar('to_address', { length: 42 }),
  amount: text('amount').notNull(), // bigint como string
  amountFormatted: text('amount_formatted'),
  isAnomaly: boolean('is_anomaly').default(false),
  anomalyReason: text('anomaly_reason'),
  timestamp: timestamp('timestamp').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ===========================================
// Alertas de Anomalias
// ===========================================
export const stablecoinAnomalies = pgTable('stablecoin_anomalies', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  stablecoinId: integer('stablecoin_id'),
  eventId: integer('event_id'),
  alertType: varchar('alert_type', { length: 50 }).notNull(), // large_mint, large_burn, large_transfer, supply_change, frequency_spike
  severity: varchar('severity', { length: 20 }).notNull(), // low, medium, high, critical
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  metadata: jsonb('metadata'),
  isAcknowledged: boolean('is_acknowledged').default(false),
  acknowledgedAt: timestamp('acknowledged_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ===========================================
// Snapshots de Supply
// ===========================================
export const supplySnapshots = pgTable('supply_snapshots', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  stablecoinId: integer('stablecoin_id').notNull(),
  supply: text('supply').notNull(), // bigint como string
  supplyFormatted: text('supply_formatted'),
  blockNumber: integer('block_number'),
  changePercent: text('change_percent'),
  timestamp: timestamp('timestamp').defaultNow(),
});

// ===========================================
// Action Items (Tarefas extraídas de emails)
// ===========================================
export const actionItems = pgTable('action_items', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  emailId: varchar('email_id', { length: 255 }).notNull(),
  threadId: varchar('thread_id', { length: 255 }),
  
  // Contexto do email
  emailSubject: text('email_subject').notNull(),
  emailFrom: varchar('email_from', { length: 255 }).notNull(),
  emailDate: timestamp('email_date'),
  
  // Stakeholder
  stakeholderName: varchar('stakeholder_name', { length: 255 }).notNull(),
  stakeholderCompany: varchar('stakeholder_company', { length: 255 }),
  stakeholderRole: varchar('stakeholder_role', { length: 255 }),
  stakeholderEmail: varchar('stakeholder_email', { length: 255 }),
  stakeholderPhone: varchar('stakeholder_phone', { length: 50 }),
  stakeholderImportance: varchar('stakeholder_importance', { length: 20 }).default('normal'), // vip, high, normal
  
  // Projeto
  projectName: varchar('project_name', { length: 255 }),
  projectCode: varchar('project_code', { length: 100 }),
  projectType: varchar('project_type', { length: 100 }),
  
  // A tarefa
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  originalText: text('original_text').notNull(),
  category: varchar('category', { length: 30 }).notNull(), // confirmation, status_update, deadline, document, approval, action, question, information, followup
  
  // Prazo
  deadlineDate: timestamp('deadline_date'),
  deadlineRelative: varchar('deadline_relative', { length: 255 }),
  deadlineIsExplicit: boolean('deadline_is_explicit').default(false),
  deadlineDependsOn: text('deadline_depends_on'),
  deadlineUrgency: varchar('deadline_urgency', { length: 20 }), // immediate, soon, normal, flexible
  
  // Status
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, in_progress, waiting, done, cancelled
  
  // Resposta
  responseText: text('response_text'),
  respondedAt: timestamp('responded_at'),
  respondedBy: varchar('responded_by', { length: 255 }),
  
  // Prioridade
  priority: varchar('priority', { length: 20 }).notNull().default('medium'), // critical, high, medium, low
  priorityReason: varchar('priority_reason', { length: 255 }),
  
  // Sugestões da IA
  suggestedResponse: text('suggested_response'),
  suggestedAction: text('suggested_action'),
  relatedDocuments: text('related_documents'), // JSON array
  blockedByExternal: varchar('blocked_by_external', { length: 255 }),
  
  // Confiança
  confidence: integer('confidence'), // 0-100
  
  // Metadados
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// ===========================================
// Logs de Uso da AI (Anthropic/OpenAI)
// ===========================================
export const aiUsageLogs = pgTable('ai_usage_logs', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  
  // Provider e Modelo
  provider: varchar('provider', { length: 20 }).notNull(), // 'anthropic' ou 'openai'
  model: varchar('model', { length: 50 }).notNull(),
  
  // Contexto
  agentId: varchar('agent_id', { length: 50 }),
  operation: varchar('operation', { length: 100 }),
  
  // Tokens e Custo
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  estimatedCost: integer('estimated_cost'), // em microdólares (1 USD = 1.000.000)
  
  // Metadata
  durationMs: integer('duration_ms'),
  success: boolean('success').default(true),
  errorMessage: text('error_message'),
  
  createdAt: timestamp('created_at').defaultNow(),
});

// ===========================================
// Focus Briefings (Análises de Foco da IA)
// ===========================================
export const focusBriefings = pgTable('focus_briefings', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  scope: varchar('scope', { length: 10 }).notNull(), // 'today' ou 'week'
  
  // Briefing gerado pela IA
  briefingText: text('briefing_text').notNull(),
  keyHighlights: jsonb('key_highlights'), // array de destaques
  
  // Itens priorizados (IDs + scores)
  prioritizedItems: jsonb('prioritized_items').notNull(),
  
  // Contadores
  totalItems: integer('total_items').default(0),
  urgentCount: integer('urgent_count').default(0),
  
  // Metadata
  generatedAt: timestamp('generated_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
});

// ===========================================
// Estatísticas Diárias
// ===========================================
export const dailyStats = pgTable('daily_stats', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  date: varchar('date', { length: 10 }).notNull(), // YYYY-MM-DD
  totalEmails: integer('total_emails').default(0),
  urgentCount: integer('urgent_count').default(0),
  attentionCount: integer('attention_count').default(0),
  informativeCount: integer('informative_count').default(0),
  lowCount: integer('low_count').default(0),
  ccOnlyCount: integer('cc_only_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// ===========================================
// Types para uso no código
// ===========================================

// Usuários
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// Configurações
export type GlobalConfig = typeof globalConfig.$inferSelect;
export type NewGlobalConfig = typeof globalConfig.$inferInsert;

export type UserConfig = typeof userConfigs.$inferSelect;
export type NewUserConfig = typeof userConfigs.$inferInsert;

// Legado
export type AppConfig = typeof appConfig.$inferSelect;
export type NewAppConfig = typeof appConfig.$inferInsert;

// Emails
export type ClassifiedEmail = typeof classifiedEmails.$inferSelect;
export type NewClassifiedEmail = typeof classifiedEmails.$inferInsert;

// Logs
export type AgentLog = typeof agentLogs.$inferSelect;
export type NewAgentLog = typeof agentLogs.$inferInsert;

// Stats
export type DailyStat = typeof dailyStats.$inferSelect;
export type NewDailyStat = typeof dailyStats.$inferInsert;

// Legal
export type LegalAnalysis = typeof legalAnalyses.$inferSelect;
export type NewLegalAnalysis = typeof legalAnalyses.$inferInsert;

// Financial
export type FinancialItem = typeof financialItems.$inferSelect;
export type NewFinancialItem = typeof financialItems.$inferInsert;

// Stablecoins
export type Stablecoin = typeof stablecoins.$inferSelect;
export type NewStablecoin = typeof stablecoins.$inferInsert;

export type StablecoinEvent = typeof stablecoinEvents.$inferSelect;
export type NewStablecoinEvent = typeof stablecoinEvents.$inferInsert;

export type StablecoinAnomaly = typeof stablecoinAnomalies.$inferSelect;
export type NewStablecoinAnomaly = typeof stablecoinAnomalies.$inferInsert;

export type SupplySnapshot = typeof supplySnapshots.$inferSelect;
export type NewSupplySnapshot = typeof supplySnapshots.$inferInsert;

// AI Usage
export type AIUsageLog = typeof aiUsageLogs.$inferSelect;
export type NewAIUsageLog = typeof aiUsageLogs.$inferInsert;

// Action Items
export type ActionItemDB = typeof actionItems.$inferSelect;
export type NewActionItemDB = typeof actionItems.$inferInsert;

// Focus Briefings
export type FocusBriefingDB = typeof focusBriefings.$inferSelect;
export type NewFocusBriefingDB = typeof focusBriefings.$inferInsert;
