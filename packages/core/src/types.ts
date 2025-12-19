import { z } from 'zod';

// ===========================================
// Tipos Base para Agentes
// ===========================================

export type AgentStatus = 'idle' | 'running' | 'paused' | 'error';

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  schedule?: ScheduleConfig;
}

export interface ScheduleConfig {
  type: 'interval' | 'cron' | 'manual';
  value?: string | number; // minutos para interval, cron expression para cron, undefined para manual
}

export interface AgentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
  duration: number; // em ms
}

export interface AgentEvent {
  type: 'started' | 'completed' | 'failed' | 'paused' | 'resumed';
  agentId: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

// ===========================================
// Tipos para Notificações
// ===========================================

export type NotificationChannel = 'slack' | 'telegram' | 'email' | 'webhook';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Notification {
  id: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface NotifierConfig {
  slack?: {
    webhookUrl: string;
  };
  telegram?: {
    botToken: string;
    chatId: string;
  };
  email?: {
    from: string;
    to: string[];
  };
  webhook?: {
    url: string;
    headers?: Record<string, string>;
  };
}

// ===========================================
// Tipos para AI Client
// ===========================================

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AITool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface AIResponse {
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ===========================================
// Schemas Zod para Validação
// ===========================================

export const AgentConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  schedule: z.object({
    type: z.enum(['interval', 'cron', 'manual']),
    value: z.union([z.string(), z.number()]).optional(),
  }).optional(),
});

export const NotificationSchema = z.object({
  id: z.string(),
  channel: z.enum(['slack', 'telegram', 'email', 'webhook']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  title: z.string(),
  message: z.string(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.date(),
});
