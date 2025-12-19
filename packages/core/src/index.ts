// Core exports
export { Agent } from './agent.js';
export { AIClient, getAIClient } from './ai-client.js';
export { Notifier } from './notifier.js';
export { AgentScheduler, getScheduler } from './scheduler.js';

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
