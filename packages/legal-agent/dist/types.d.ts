import { z } from 'zod';
export interface DocumentAttachment {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    content?: Buffer;
}
export interface ExtractedDocument {
    filename: string;
    mimeType: string;
    text: string;
    pageCount?: number;
    extractedAt: Date;
}
export interface LegalClause {
    type: string;
    title: string;
    content: string;
    risk: 'low' | 'medium' | 'high' | 'critical';
    analysis: string;
    suggestion?: string;
}
export interface ContractAnalysis {
    emailId?: string;
    threadId?: string;
    documentName: string;
    documentType: string;
    parties: string[];
    summary: string;
    keyDates: Array<{
        description: string;
        date: string;
    }>;
    financialTerms: Array<{
        description: string;
        value: string;
    }>;
    criticalClauses: LegalClause[];
    risks: Array<{
        level: 'low' | 'medium' | 'high' | 'critical';
        description: string;
        clause: string;
        recommendation: string;
    }>;
    suggestions: string[];
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    requiresAttention: boolean;
    analyzedAt: Date;
    requiredAction: 'approve' | 'sign' | 'review' | 'negotiate' | 'reject' | 'none';
    actionDescription: string;
    responsibleParties: Array<{
        name: string;
        role: string;
        action: string;
    }>;
    actionDeadline?: string;
    isUrgent: boolean;
    nextSteps: string[];
}
export interface LegalAgentConfig {
    supportedMimeTypes: string[];
    maxDocumentSize: number;
    contractKeywords: string[];
    customContext?: string;
}
export declare const LegalAgentConfigSchema: z.ZodObject<{
    supportedMimeTypes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    maxDocumentSize: z.ZodDefault<z.ZodNumber>;
    contractKeywords: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    supportedMimeTypes: string[];
    maxDocumentSize: number;
    contractKeywords: string[];
}, {
    supportedMimeTypes?: string[] | undefined;
    maxDocumentSize?: number | undefined;
    contractKeywords?: string[] | undefined;
}>;
export declare const ContractAnalysisSchema: {
    name: string;
    description: string;
    input_schema: {
        type: "object";
        properties: {
            documentName: {
                type: string;
                description: string;
            };
            documentType: {
                type: string;
                description: string;
            };
            parties: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            summary: {
                type: string;
                description: string;
            };
            keyDates: {
                type: string;
                items: {
                    type: string;
                    properties: {
                        description: {
                            type: string;
                        };
                        date: {
                            type: string;
                        };
                    };
                };
                description: string;
            };
            financialTerms: {
                type: string;
                items: {
                    type: string;
                    properties: {
                        description: {
                            type: string;
                        };
                        value: {
                            type: string;
                        };
                    };
                };
                description: string;
            };
            criticalClauses: {
                type: string;
                items: {
                    type: string;
                    properties: {
                        type: {
                            type: string;
                        };
                        title: {
                            type: string;
                        };
                        content: {
                            type: string;
                        };
                        risk: {
                            type: string;
                            enum: string[];
                        };
                        analysis: {
                            type: string;
                        };
                        suggestion: {
                            type: string;
                        };
                    };
                };
                description: string;
            };
            risks: {
                type: string;
                items: {
                    type: string;
                    properties: {
                        level: {
                            type: string;
                            enum: string[];
                        };
                        description: {
                            type: string;
                        };
                        clause: {
                            type: string;
                        };
                        recommendation: {
                            type: string;
                        };
                    };
                };
                description: string;
            };
            suggestions: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            overallRisk: {
                type: string;
                enum: string[];
                description: string;
            };
            requiresAttention: {
                type: string;
                description: string;
            };
            requiredAction: {
                type: string;
                enum: string[];
                description: string;
            };
            actionDescription: {
                type: string;
                description: string;
            };
            responsibleParties: {
                type: string;
                items: {
                    type: string;
                    properties: {
                        name: {
                            type: string;
                            description: string;
                        };
                        role: {
                            type: string;
                            description: string;
                        };
                        action: {
                            type: string;
                            description: string;
                        };
                    };
                };
                description: string;
            };
            actionDeadline: {
                type: string;
                description: string;
            };
            isUrgent: {
                type: string;
                description: string;
            };
            nextSteps: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
        required: string[];
    };
};
//# sourceMappingURL=types.d.ts.map