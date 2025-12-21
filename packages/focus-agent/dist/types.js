import { z } from 'zod';
// ===========================================
// Schema Zod para validação
// ===========================================
export const FocusAgentConfigSchema = z.object({
    dailyGenerationTime: z.string().optional(),
    urgentDaysThreshold: z.number().optional(),
    highValueThreshold: z.number().optional(),
    vipSenders: z.array(z.string()).optional(),
});
export const FocusItemSchema = z.object({
    id: z.number(),
    type: z.enum(['email', 'task', 'financial', 'legal', 'commercial']),
    title: z.string(),
    description: z.string(),
    urgencyScore: z.number(),
    urgencyLevel: z.enum(['critical', 'high', 'medium', 'low']),
    urgencyReason: z.string(),
    deadline: z.date().optional(),
    amount: z.number().optional(),
    stakeholder: z.string().optional(),
    isVip: z.boolean().optional(),
    riskLevel: z.string().optional(),
    originalData: z.record(z.unknown()),
});
export const FocusBriefingSchema = z.object({
    scope: z.enum(['today', 'week']),
    briefingText: z.string(),
    keyHighlights: z.array(z.string()),
    prioritizedItems: z.array(FocusItemSchema),
    totalItems: z.number(),
    urgentCount: z.number(),
    generatedAt: z.date(),
    expiresAt: z.date(),
});
//# sourceMappingURL=types.js.map