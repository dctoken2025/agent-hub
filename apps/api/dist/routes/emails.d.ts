import type { FastifyPluginAsync } from 'fastify';
import type { ClassifiedEmail, ContractAnalysis } from '@agent-hub/email-agent';
import type { FinancialItem } from '@agent-hub/financial-agent';
import type { ActionItem } from '@agent-hub/task-agent';
import type { CommercialItem } from '@agent-hub/commercial-agent';
declare function saveEmailsToDatabase(emails: ClassifiedEmail[], userId: string): Promise<void>;
declare function saveLegalAnalysesToDatabase(analyses: ContractAnalysis[], userId: string): Promise<void>;
declare function saveFinancialItemsToDatabase(items: FinancialItem[], userId: string): Promise<void>;
declare function saveActionItemsToDatabase(items: ActionItem[], userId: string): Promise<void>;
declare function saveCommercialItemsToDatabase(items: CommercialItem[], userId: string): Promise<void>;
export declare const emailRoutes: FastifyPluginAsync;
export { saveEmailsToDatabase, saveLegalAnalysesToDatabase, saveFinancialItemsToDatabase, saveActionItemsToDatabase, saveCommercialItemsToDatabase };
//# sourceMappingURL=emails.d.ts.map