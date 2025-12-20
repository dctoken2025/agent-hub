import { z } from 'zod';

// ===========================================
// Tipos de Itens para Análise
// ===========================================

export type FocusItemType = 'email' | 'task' | 'financial' | 'legal';

export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low';

export interface FocusItem {
  id: number;
  type: FocusItemType;
  title: string;
  description: string;
  urgencyScore: number; // 0-100
  urgencyLevel: UrgencyLevel;
  urgencyReason: string;
  deadline?: Date;
  amount?: number; // Para itens financeiros (em centavos)
  stakeholder?: string;
  isVip?: boolean;
  riskLevel?: string; // Para itens jurídicos
  originalData: Record<string, unknown>;
}

// ===========================================
// Input para o Focus Agent
// ===========================================

export interface FocusAgentInput {
  scope: 'today' | 'week';
  forceRefresh?: boolean;
}

// ===========================================
// Output do Focus Agent
// ===========================================

export interface FocusBriefing {
  scope: 'today' | 'week';
  briefingText: string;
  keyHighlights: string[];
  prioritizedItems: FocusItem[];
  totalItems: number;
  urgentCount: number;
  generatedAt: Date;
  expiresAt: Date;
}

// ===========================================
// Dados Coletados para Análise
// ===========================================

export interface CollectedData {
  emails: EmailData[];
  tasks: TaskData[];
  financialItems: FinancialData[];
  legalItems: LegalData[];
}

export interface EmailData {
  id: number;
  emailId: string;
  subject: string;
  fromEmail: string;
  fromName?: string;
  priority: string;
  action: string;
  requiresAction: boolean;
  deadline?: string;
  emailDate: Date;
  isRead: boolean;
  snippet?: string;
}

export interface TaskData {
  id: number;
  title: string;
  description: string;
  category: string;
  deadlineDate?: Date;
  deadlineUrgency?: string;
  status: string;
  priority: string;
  stakeholderName: string;
  stakeholderCompany?: string;
  stakeholderImportance: string;
  emailSubject: string;
  emailFrom: string;
}

export interface FinancialData {
  id: number;
  type: string;
  description: string;
  creditor: string;
  amount: number;
  dueDate?: Date;
  status: string;
  priority: string;
  requiresApproval: boolean;
  emailSubject?: string;
}

export interface LegalData {
  id: number;
  documentName: string;
  documentType?: string;
  summary?: string;
  overallRisk: string;
  requiredAction?: string;
  actionDeadline?: string;
  isUrgent: boolean;
  status: string;
  parties?: string;
}

// ===========================================
// Configuração do Focus Agent
// ===========================================

export interface FocusAgentConfig {
  // Horário para geração automática (formato HH:MM, horário Brasil)
  dailyGenerationTime?: string;
  
  // Configurações de urgência
  urgentDaysThreshold?: number; // Dias antes do vencimento para considerar urgente
  highValueThreshold?: number; // Valor em centavos para considerar alto
  
  // VIP senders para priorização
  vipSenders?: string[];
}

// ===========================================
// Schema Zod para validação
// ===========================================

export const FocusAgentConfigSchema = z.object({
  dailyGenerationTime: z.string().optional(),
  urgentDaysThreshold: z.number().optional(),
  highValueThreshold: z.number().optional(),
  vipSenders: z.array(z.string()).optional(),
});

export const FocusItemSchema = z.object({
  id: z.number(),
  type: z.enum(['email', 'task', 'financial', 'legal']),
  title: z.string(),
  description: z.string(),
  urgencyScore: z.number(),
  urgencyLevel: z.enum(['critical', 'high', 'medium', 'low']),
  urgencyReason: z.string(),
  deadline: z.date().optional(),
  amount: z.number().optional(),
  stakeholder: z.string().optional(),
  isVip: z.boolean().optional(),
  riskLevel: z.string().optional(),
  originalData: z.record(z.unknown()),
});

export const FocusBriefingSchema = z.object({
  scope: z.enum(['today', 'week']),
  briefingText: z.string(),
  keyHighlights: z.array(z.string()),
  prioritizedItems: z.array(FocusItemSchema),
  totalItems: z.number(),
  urgentCount: z.number(),
  generatedAt: z.date(),
  expiresAt: z.date(),
});

