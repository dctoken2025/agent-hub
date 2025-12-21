import { z } from 'zod';
export type EmailPriority = 'urgent' | 'attention' | 'informative' | 'low' | 'cc_only';
export type EmailAction = 'respond_now' | 'respond_later' | 'read_only' | 'mark_read' | 'archive' | 'delegate';
export interface EmailClassification {
    priority: EmailPriority;
    action: EmailAction;
    confidence: number;
    reasoning: string;
    suggestedResponse?: string;
    tags: string[];
    sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
    isDirectedToMe: boolean;
    requiresAction: boolean;
    deadline?: string;
}
export interface Email {
    id: string;
    threadId: string;
    from: EmailAddress;
    to: EmailAddress[];
    cc?: EmailAddress[];
    subject: string;
    snippet: string;
    body: string;
    bodyHtml?: string;
    date: Date;
    labels: string[];
    isUnread: boolean;
    hasAttachments: boolean;
    attachments?: EmailAttachment[];
}
export interface EmailAddress {
    name?: string;
    email: string;
}
export interface EmailAttachment {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
}
export interface ClassifiedEmail extends Email {
    classification: EmailClassification;
    classifiedAt: Date;
}
export interface EmailAgentConfig {
    userEmail: string;
    vipSenders: string[];
    ignoreSenders: string[];
    labelsToProcess: string[];
    maxEmailsPerRun: number;
    startDate?: string | Date;
    lastProcessedAt?: string | Date;
    unreadOnly: boolean;
    gmailTokens?: Record<string, unknown>;
    customContext?: string;
}
export declare const EmailAgentConfigSchema: z.ZodObject<{
    userEmail: z.ZodString;
    vipSenders: z.ZodArray<z.ZodString, "many">;
    ignoreSenders: z.ZodArray<z.ZodString, "many">;
    labelsToProcess: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    maxEmailsPerRun: z.ZodDefault<z.ZodNumber>;
    unreadOnly: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    userEmail: string;
    vipSenders: string[];
    ignoreSenders: string[];
    labelsToProcess: string[];
    maxEmailsPerRun: number;
    unreadOnly: boolean;
}, {
    userEmail: string;
    vipSenders: string[];
    ignoreSenders: string[];
    labelsToProcess?: string[] | undefined;
    maxEmailsPerRun?: number | undefined;
    unreadOnly?: boolean | undefined;
}>;
export declare const EmailClassificationSchema: {
    name: string;
    description: string;
    input_schema: {
        type: "object";
        properties: {
            priority: {
                type: string;
                enum: string[];
                description: string;
            };
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            confidence: {
                type: string;
                description: string;
            };
            reasoning: {
                type: string;
                description: string;
            };
            suggestedResponse: {
                type: string;
                description: string;
            };
            tags: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            sentiment: {
                type: string;
                enum: string[];
                description: string;
            };
            isDirectedToMe: {
                type: string;
                description: string;
            };
            requiresAction: {
                type: string;
                description: string;
            };
            deadline: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
//# sourceMappingURL=types.d.ts.map