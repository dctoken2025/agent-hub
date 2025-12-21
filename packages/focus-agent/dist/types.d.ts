import { z } from 'zod';
export type FocusItemType = 'email' | 'task' | 'financial' | 'legal';
export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low';
export interface FocusItem {
    id: number;
    type: FocusItemType;
    title: string;
    description: string;
    urgencyScore: number;
    urgencyLevel: UrgencyLevel;
    urgencyReason: string;
    deadline?: Date;
    amount?: number;
    stakeholder?: string;
    isVip?: boolean;
    riskLevel?: string;
    originalData: Record<string, unknown>;
}
export interface FocusAgentInput {
    scope: 'today' | 'week';
    forceRefresh?: boolean;
}
export interface FocusBriefing {
    scope: 'today' | 'week';
    briefingText: string;
    keyHighlights: string[];
    prioritizedItems: FocusItem[];
    totalItems: number;
    urgentCount: number;
    generatedAt: Date;
    expiresAt: Date;
}
export interface CollectedData {
    emails: EmailData[];
    tasks: TaskData[];
    financialItems: FinancialData[];
    legalItems: LegalData[];
}
export interface EmailData {
    id: number;
    emailId: string;
    subject: string;
    fromEmail: string;
    fromName?: string;
    priority: string;
    action: string;
    requiresAction: boolean;
    deadline?: string;
    emailDate: Date;
    isRead: boolean;
    snippet?: string;
}
export interface TaskData {
    id: number;
    title: string;
    description: string;
    category: string;
    deadlineDate?: Date;
    deadlineUrgency?: string;
    status: string;
    priority: string;
    stakeholderName: string;
    stakeholderCompany?: string;
    stakeholderImportance: string;
    emailSubject: string;
    emailFrom: string;
}
export interface FinancialData {
    id: number;
    type: string;
    description: string;
    creditor: string;
    amount: number;
    dueDate?: Date;
    status: string;
    priority: string;
    requiresApproval: boolean;
    emailSubject?: string;
}
export interface LegalData {
    id: number;
    documentName: string;
    documentType?: string;
    summary?: string;
    overallRisk: string;
    requiredAction?: string;
    actionDeadline?: string;
    isUrgent: boolean;
    status: string;
    parties?: string;
}
export interface FocusAgentConfig {
    dailyGenerationTime?: string;
    urgentDaysThreshold?: number;
    highValueThreshold?: number;
    vipSenders?: string[];
}
export declare const FocusAgentConfigSchema: z.ZodObject<{
    dailyGenerationTime: z.ZodOptional<z.ZodString>;
    urgentDaysThreshold: z.ZodOptional<z.ZodNumber>;
    highValueThreshold: z.ZodOptional<z.ZodNumber>;
    vipSenders: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    dailyGenerationTime?: string | undefined;
    urgentDaysThreshold?: number | undefined;
    highValueThreshold?: number | undefined;
    vipSenders?: string[] | undefined;
}, {
    dailyGenerationTime?: string | undefined;
    urgentDaysThreshold?: number | undefined;
    highValueThreshold?: number | undefined;
    vipSenders?: string[] | undefined;
}>;
export declare const FocusItemSchema: z.ZodObject<{
    id: z.ZodNumber;
    type: z.ZodEnum<["email", "task", "financial", "legal"]>;
    title: z.ZodString;
    description: z.ZodString;
    urgencyScore: z.ZodNumber;
    urgencyLevel: z.ZodEnum<["critical", "high", "medium", "low"]>;
    urgencyReason: z.ZodString;
    deadline: z.ZodOptional<z.ZodDate>;
    amount: z.ZodOptional<z.ZodNumber>;
    stakeholder: z.ZodOptional<z.ZodString>;
    isVip: z.ZodOptional<z.ZodBoolean>;
    riskLevel: z.ZodOptional<z.ZodString>;
    originalData: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    type: "email" | "task" | "financial" | "legal";
    id: number;
    title: string;
    description: string;
    urgencyScore: number;
    urgencyLevel: "critical" | "high" | "medium" | "low";
    urgencyReason: string;
    originalData: Record<string, unknown>;
    deadline?: Date | undefined;
    amount?: number | undefined;
    stakeholder?: string | undefined;
    isVip?: boolean | undefined;
    riskLevel?: string | undefined;
}, {
    type: "email" | "task" | "financial" | "legal";
    id: number;
    title: string;
    description: string;
    urgencyScore: number;
    urgencyLevel: "critical" | "high" | "medium" | "low";
    urgencyReason: string;
    originalData: Record<string, unknown>;
    deadline?: Date | undefined;
    amount?: number | undefined;
    stakeholder?: string | undefined;
    isVip?: boolean | undefined;
    riskLevel?: string | undefined;
}>;
export declare const FocusBriefingSchema: z.ZodObject<{
    scope: z.ZodEnum<["today", "week"]>;
    briefingText: z.ZodString;
    keyHighlights: z.ZodArray<z.ZodString, "many">;
    prioritizedItems: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        type: z.ZodEnum<["email", "task", "financial", "legal"]>;
        title: z.ZodString;
        description: z.ZodString;
        urgencyScore: z.ZodNumber;
        urgencyLevel: z.ZodEnum<["critical", "high", "medium", "low"]>;
        urgencyReason: z.ZodString;
        deadline: z.ZodOptional<z.ZodDate>;
        amount: z.ZodOptional<z.ZodNumber>;
        stakeholder: z.ZodOptional<z.ZodString>;
        isVip: z.ZodOptional<z.ZodBoolean>;
        riskLevel: z.ZodOptional<z.ZodString>;
        originalData: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        type: "email" | "task" | "financial" | "legal";
        id: number;
        title: string;
        description: string;
        urgencyScore: number;
        urgencyLevel: "critical" | "high" | "medium" | "low";
        urgencyReason: string;
        originalData: Record<string, unknown>;
        deadline?: Date | undefined;
        amount?: number | undefined;
        stakeholder?: string | undefined;
        isVip?: boolean | undefined;
        riskLevel?: string | undefined;
    }, {
        type: "email" | "task" | "financial" | "legal";
        id: number;
        title: string;
        description: string;
        urgencyScore: number;
        urgencyLevel: "critical" | "high" | "medium" | "low";
        urgencyReason: string;
        originalData: Record<string, unknown>;
        deadline?: Date | undefined;
        amount?: number | undefined;
        stakeholder?: string | undefined;
        isVip?: boolean | undefined;
        riskLevel?: string | undefined;
    }>, "many">;
    totalItems: z.ZodNumber;
    urgentCount: z.ZodNumber;
    generatedAt: z.ZodDate;
    expiresAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    scope: "today" | "week";
    briefingText: string;
    keyHighlights: string[];
    prioritizedItems: {
        type: "email" | "task" | "financial" | "legal";
        id: number;
        title: string;
        description: string;
        urgencyScore: number;
        urgencyLevel: "critical" | "high" | "medium" | "low";
        urgencyReason: string;
        originalData: Record<string, unknown>;
        deadline?: Date | undefined;
        amount?: number | undefined;
        stakeholder?: string | undefined;
        isVip?: boolean | undefined;
        riskLevel?: string | undefined;
    }[];
    totalItems: number;
    urgentCount: number;
    generatedAt: Date;
    expiresAt: Date;
}, {
    scope: "today" | "week";
    briefingText: string;
    keyHighlights: string[];
    prioritizedItems: {
        type: "email" | "task" | "financial" | "legal";
        id: number;
        title: string;
        description: string;
        urgencyScore: number;
        urgencyLevel: "critical" | "high" | "medium" | "low";
        urgencyReason: string;
        originalData: Record<string, unknown>;
        deadline?: Date | undefined;
        amount?: number | undefined;
        stakeholder?: string | undefined;
        isVip?: boolean | undefined;
        riskLevel?: string | undefined;
    }[];
    totalItems: number;
    urgentCount: number;
    generatedAt: Date;
    expiresAt: Date;
}>;
//# sourceMappingURL=types.d.ts.map