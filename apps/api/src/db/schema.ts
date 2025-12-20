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
  
  // Notificações
  notificationConfig: jsonb('notification_config').default({
    slackWebhookUrl: '',
    telegramBotToken: '',
    telegramChatId: '',
  }),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
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

// Stablecoins
export type Stablecoin = typeof stablecoins.$inferSelect;
export type NewStablecoin = typeof stablecoins.$inferInsert;

export type StablecoinEvent = typeof stablecoinEvents.$inferSelect;
export type NewStablecoinEvent = typeof stablecoinEvents.$inferInsert;

export type StablecoinAnomaly = typeof stablecoinAnomalies.$inferSelect;
export type NewStablecoinAnomaly = typeof stablecoinAnomalies.$inferInsert;

export type SupplySnapshot = typeof supplySnapshots.$inferSelect;
export type NewSupplySnapshot = typeof supplySnapshots.$inferInsert;
