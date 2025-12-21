import { z } from 'zod';
export type TaskCategory = 'confirmation' | 'status_update' | 'deadline' | 'document' | 'approval' | 'action' | 'question' | 'information' | 'followup';
export type TaskStatus = 'pending' | 'in_progress' | 'waiting' | 'done' | 'cancelled';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type StakeholderImportance = 'vip' | 'high' | 'normal';
export interface Stakeholder {
    name: string;
    company?: string;
    role?: string;
    email: string;
    phone?: string;
    importance: StakeholderImportance;
}
export interface Project {
    name: string;
    code?: string;
    type?: string;
}
export interface TaskDeadline {
    date?: string;
    relative?: string;
    isExplicit: boolean;
    dependsOn?: string;
    urgencyLevel?: 'immediate' | 'soon' | 'normal' | 'flexible';
}
export interface TaskResponse {
    text: string;
    respondedAt: Date;
    respondedBy?: string;
}
export interface ActionItem {
    id?: number;
    emailId: string;
    threadId?: string;
    userId?: string;
    emailSubject: string;
    emailFrom: string;
    emailDate?: Date;
    stakeholder: Stakeholder;
    project?: Project;
    title: string;
    description: string;
    originalText: string;
    category: TaskCategory;
    deadline?: TaskDeadline;
    status: TaskStatus;
    response?: TaskResponse;
    priority: TaskPriority;
    priorityReason: string;
    confidence: number;
    suggestedResponse?: string;
    suggestedAction?: string;
    relatedDocuments?: string[];
    dependsOnTasks?: number[];
    blockedByExternal?: string;
    createdAt?: Date;
    updatedAt?: Date;
    completedAt?: Date;
}
export interface TaskAnalysis {
    emailId: string;
    threadId?: string;
    emailSubject: string;
    emailFrom: string;
    stakeholder: Stakeholder;
    project?: Project;
    items: ActionItem[];
    summary: string;
    suggestedReply?: string;
    totalItems: number;
    criticalItems: number;
    hasDeadlines: boolean;
    analyzedAt: Date;
}
export interface TaskAgentConfig {
    taskKeywords: string[];
    vipStakeholders: string[];
    urgentDaysThreshold: number;
    generateSuggestedReply: boolean;
    customContext?: string;
}
export declare const TaskAgentConfigSchema: z.ZodObject<{
    taskKeywords: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    vipStakeholders: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    urgentDaysThreshold: z.ZodDefault<z.ZodNumber>;
    generateSuggestedReply: z.ZodDefault<z.ZodBoolean>;
    customContext: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    taskKeywords: string[];
    vipStakeholders: string[];
    urgentDaysThreshold: number;
    generateSuggestedReply: boolean;
    customContext?: string | undefined;
}, {
    taskKeywords?: string[] | undefined;
    vipStakeholders?: string[] | undefined;
    urgentDaysThreshold?: number | undefined;
    generateSuggestedReply?: boolean | undefined;
    customContext?: string | undefined;
}>;
export declare const TaskExtractionSchema: {
    name: string;
    description: string;
    input_schema: {
        type: "object";
        properties: {
            stakeholder: {
                type: string;
                properties: {
                    name: {
                        type: string;
                        description: string;
                    };
                    company: {
                        type: string;
                        description: string;
                    };
                    role: {
                        type: string;
                        description: string;
                    };
                    phone: {
                        type: string;
                        description: string;
                    };
                    importance: {
                        type: string;
                        enum: string[];
                        description: string;
                    };
                };
                required: string[];
                description: string;
            };
            project: {
                type: string;
                properties: {
                    name: {
                        type: string;
                        description: string;
                    };
                    code: {
                        type: string;
                        description: string;
                    };
                    type: {
                        type: string;
                        description: string;
                    };
                };
                description: string;
            };
            items: {
                type: string;
                items: {
                    type: string;
                    properties: {
                        title: {
                            type: string;
                            description: string;
                        };
                        description: {
                            type: string;
                            description: string;
                        };
                        originalText: {
                            type: string;
                            description: string;
                        };
                        category: {
                            type: string;
                            enum: string[];
                            description: string;
                        };
                        deadline: {
                            type: string;
                            properties: {
                                date: {
                                    type: string;
                                    description: string;
                                };
                                relative: {
                                    type: string;
                                    description: string;
                                };
                                isExplicit: {
                                    type: string;
                                    description: string;
                                };
                                dependsOn: {
                                    type: string;
                                    description: string;
                                };
                                urgencyLevel: {
                                    type: string;
                                    enum: string[];
                                    description: string;
                                };
                            };
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
                        suggestedResponse: {
                            type: string;
                            description: string;
                        };
                        suggestedAction: {
                            type: string;
                            description: string;
                        };
                        relatedDocuments: {
                            type: string;
                            items: {
                                type: string;
                            };
                            description: string;
                        };
                        blockedByExternal: {
                            type: string;
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
            suggestedReply: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
//# sourceMappingURL=types.d.ts.map