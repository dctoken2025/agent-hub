// Main exports
export { EmailAgent } from './email-agent.js';
export { GmailClient } from './gmail-client.js';
export { EmailClassifier } from './email-classifier.js';

// Types from types.ts
export type {
  Email,
  EmailAddress,
  EmailAttachment,
  EmailPriority,
  EmailAction,
  EmailClassification,
  ClassifiedEmail,
  EmailAgentConfig,
} from './types.js';

// Types from email-agent.ts
export type { 
  EmailAgentResult, 
  EmailProgressEvent, 
  ProgressCallback, 
  EmailSaveCallback 
} from './email-agent.js';

// Re-export from legal-agent for convenience
export type { ContractAnalysis } from '@agent-hub/legal-agent';

// Re-export from commercial-agent for convenience
export type { CommercialItem } from '@agent-hub/commercial-agent';

// Schemas
export { EmailAgentConfigSchema, EmailClassificationSchema } from './types.js';
