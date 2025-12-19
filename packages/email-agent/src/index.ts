// Main exports
export { EmailAgent } from './email-agent.js';
export { GmailClient } from './gmail-client.js';
export { EmailClassifier } from './email-classifier.js';

// Types
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

// Schemas
export { EmailAgentConfigSchema, EmailClassificationSchema } from './types.js';
