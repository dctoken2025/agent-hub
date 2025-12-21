import { z } from 'zod';
export type CommercialItemType = 'quote_request' | 'proposal' | 'negotiation' | 'order' | 'follow_up' | 'complaint' | 'renewal' | 'opportunity' | 'outro';
export type CommercialItemStatus = 'new' | 'in_progress' | 'quoted' | 'negotiating' | 'won' | 'lost' | 'cancelled' | 'on_hold';
export type CommercialPriority = 'critical' | 'high' | 'normal' | 'low';
export type ClientType = 'prospect' | 'new_client' | 'existing_client' | 'strategic_client' | 'partner' | 'distributor' | 'other';
export interface CommercialItem {
    emailId: string;
    threadId?: string;
    emailSubject?: string;
    emailFrom?: string;
    emailDate?: Date;
    type: CommercialItemType;
    status: CommercialItemStatus;
    clientName: string;
    clientCompany?: string;
    clientEmail?: string;
    clientPhone?: string;
    clientType: ClientType;
    title: string;
    description: string;
    productsServices?: string[];
    estimatedValue?: number;
    currency?: string;
    quantity?: string;
    deadlineDate?: string;
    desiredDeliveryDate?: string;
    hasCompetitors?: boolean;
    competitorNames?: string[];
    isUrgentBid?: boolean;
    priority: CommercialPriority;
    priorityReason?: string;
    suggestedAction?: string;
    suggestedResponse?: string;
    confidence: number;
    analyzedAt: Date;
    tags?: string[];
}
export interface CommercialAgentConfig {
    commercialKeywords: string[];
    vipClients: string[];
    productsServices: string[];
    highValueThreshold: number;
    urgentDaysBeforeDeadline: number;
    customContext?: string;
}
export declare const CommercialAgentConfigSchema: z.ZodObject<{
    commercialKeywords: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    vipClients: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    productsServices: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    highValueThreshold: z.ZodDefault<z.ZodNumber>;
    urgentDaysBeforeDeadline: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    commercialKeywords: string[];
    vipClients: string[];
    productsServices: string[];
    highValueThreshold: number;
    urgentDaysBeforeDeadline: number;
}, {
    commercialKeywords?: string[] | undefined;
    vipClients?: string[] | undefined;
    productsServices?: string[] | undefined;
    highValueThreshold?: number | undefined;
    urgentDaysBeforeDeadline?: number | undefined;
}>;
export declare const CommercialAnalysisSchema: {
    name: string;
    description: string;
    input_schema: {
        type: "object";
        properties: {
            items: {
                type: string;
                items: {
                    type: string;
                    properties: {
                        type: {
                            type: string;
                            enum: string[];
                            description: string;
                        };
                        clientName: {
                            type: string;
                            description: string;
                        };
                        clientCompany: {
                            type: string;
                            description: string;
                        };
                        clientEmail: {
                            type: string;
                            description: string;
                        };
                        clientPhone: {
                            type: string;
                            description: string;
                        };
                        clientType: {
                            type: string;
                            enum: string[];
                            description: string;
                        };
                        title: {
                            type: string;
                            description: string;
                        };
                        description: {
                            type: string;
                            description: string;
                        };
                        productsServices: {
                            type: string;
                            items: {
                                type: string;
                            };
                            description: string;
                        };
                        estimatedValue: {
                            type: string;
                            description: string;
                        };
                        currency: {
                            type: string;
                            description: string;
                        };
                        quantity: {
                            type: string;
                            description: string;
                        };
                        deadlineDate: {
                            type: string;
                            description: string;
                        };
                        desiredDeliveryDate: {
                            type: string;
                            description: string;
                        };
                        hasCompetitors: {
                            type: string;
                            description: string;
                        };
                        competitorNames: {
                            type: string;
                            items: {
                                type: string;
                            };
                            description: string;
                        };
                        isUrgentBid: {
                            type: string;
                            description: string;
                        };
                        priority: {
                            type: string;
                            enum: string[];
                            description: string;
                        };
                        priorityReason: {
                            type: string;
                            description: string;
                        };
                        suggestedAction: {
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
                        confidence: {
                            type: string;
                            description: string;
                        };
                    };
                    required: string[];
                };
                description: string;
            };
            summary: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
//# sourceMappingURL=types.d.ts.map