// Main exports
export { LegalAgent } from './legal-agent.js';
export { DocumentExtractor } from './document-extractor.js';
export { LegalAnalyzer } from './legal-analyzer.js';

// Types
export type {
  DocumentAttachment,
  ExtractedDocument,
  LegalClause,
  ContractAnalysis,
  LegalAgentConfig,
} from './types.js';

// Schemas
export { LegalAgentConfigSchema, ContractAnalysisSchema } from './types.js';
