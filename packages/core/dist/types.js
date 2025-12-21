import { z } from 'zod';
// ===========================================
// Schemas Zod para Validação
// ===========================================
export const AgentConfigSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    enabled: z.boolean(),
    schedule: z.object({
        type: z.enum(['interval', 'cron', 'manual']),
        value: z.union([z.string(), z.number()]).optional(),
    }).optional(),
    userId: z.string().optional(), // ID do usuário dono do agente (para rastreamento de uso de AI)
});
export const NotificationSchema = z.object({
    id: z.string(),
    channel: z.enum(['slack', 'telegram', 'email', 'webhook']),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    title: z.string(),
    message: z.string(),
    metadata: z.record(z.unknown()).optional(),
    timestamp: z.date(),
});
//# sourceMappingURL=types.js.map