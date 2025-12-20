// Core exports
export { Agent } from './agent.js';
export { AIClient, getAIClient, configureAIClient, recreateAIClient } from './ai-client.js';
export type { ProviderType } from './ai-client.js';
export { Notifier } from './notifier.js';
export { AgentScheduler, getScheduler } from './scheduler.js';

// AI Context (para rastreamento de uso)
export { runWithAIContext, getAIContext, setAIContextValue } from './ai-context.js';
export type { AIContext } from './ai-context.js';

// Usage Tracker
export { trackUsage, setUsageSaveFunction, forceFlushUsage } from './usage-tracker.js';
export type { UsageRecord } from './usage-tracker.js';

// Providers
export { AnthropicProvider } from './providers/anthropic.js';
export { OpenAIProvider } from './providers/openai.js';
export { calculateCost, formatCost, MODEL_PRICING, AVAILABLE_MODELS } from './providers/pricing.js';
export type { AIProvider, ProviderOptions } from './providers/base.js';
export type { ModelPricing } from './providers/pricing.js';

// Timezone utilities (Brasil - America/Sao_Paulo)
export {
  BRAZIL_TIMEZONE,
  nowBrazil,
  nowBrazilISO,
  formatDateBrazil,
  formatDateOnlyBrazil,
  formatTimeBrazil,
  formatRelativeBrazil,
  toStartOfDayBrazil,
  isTodayBrazil,
  minutesAgoBrazil,
} from './timezone.js';

// Types
export type {
  AgentConfig,
  AgentStatus,
  AgentResult,
  AgentEvent,
  ScheduleConfig,
  Notification,
  NotificationChannel,
  NotificationPriority,
  NotifierConfig,
  AIMessage,
  AITool,
  AIResponse,
} from './types.js';

// Schemas
export { AgentConfigSchema, NotificationSchema } from './types.js';
