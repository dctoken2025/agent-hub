// Core exports
export { Agent } from './agent.js';
export { AIClient, getAIClient } from './ai-client.js';
export { Notifier } from './notifier.js';
export { AgentScheduler, getScheduler } from './scheduler.js';

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
