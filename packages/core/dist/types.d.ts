import { z } from 'zod';
export type AgentStatus = 'idle' | 'running' | 'paused' | 'error';
export interface AgentConfig {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    schedule?: ScheduleConfig;
    userId?: string;
}
export interface ScheduleConfig {
    type: 'interval' | 'cron' | 'manual';
    value?: string | number;
}
export interface AgentResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    timestamp: Date;
    duration: number;
}
export interface AgentEvent {
    type: 'started' | 'completed' | 'failed' | 'paused' | 'resumed';
    agentId: string;
    timestamp: Date;
    details?: Record<string, unknown>;
}
export type NotificationChannel = 'slack' | 'telegram' | 'email' | 'webhook';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';
export interface Notification {
    id: string;
    channel: NotificationChannel;
    priority: NotificationPriority;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
    timestamp: Date;
}
export interface NotifierConfig {
    slack?: {
        webhookUrl: string;
    };
    telegram?: {
        botToken: string;
        chatId: string;
    };
    email?: {
        from: string;
        to: string[];
    };
    webhook?: {
        url: string;
        headers?: Record<string, string>;
    };
}
export interface AIMessage {
    role: 'user' | 'assistant';
    content: string;
}
export interface AITool {
    name: string;
    description: string;
    input_schema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}
export interface AIResponse {
    content: string;
    toolCalls?: Array<{
        id: string;
        name: string;
        input: Record<string, unknown>;
    }>;
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
}
export declare const AgentConfigSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodString;
    enabled: z.ZodBoolean;
    schedule: z.ZodOptional<z.ZodObject<{
        type: z.ZodEnum<["interval", "cron", "manual"]>;
        value: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    }, "strip", z.ZodTypeAny, {
        type: "interval" | "cron" | "manual";
        value?: string | number | undefined;
    }, {
        type: "interval" | "cron" | "manual";
        value?: string | number | undefined;
    }>>;
    userId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    schedule?: {
        type: "interval" | "cron" | "manual";
        value?: string | number | undefined;
    } | undefined;
    userId?: string | undefined;
}, {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    schedule?: {
        type: "interval" | "cron" | "manual";
        value?: string | number | undefined;
    } | undefined;
    userId?: string | undefined;
}>;
export declare const NotificationSchema: z.ZodObject<{
    id: z.ZodString;
    channel: z.ZodEnum<["slack", "telegram", "email", "webhook"]>;
    priority: z.ZodEnum<["low", "medium", "high", "urgent"]>;
    title: z.ZodString;
    message: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    message: string;
    channel: "slack" | "telegram" | "email" | "webhook";
    priority: "low" | "medium" | "high" | "urgent";
    title: string;
    timestamp: Date;
    metadata?: Record<string, unknown> | undefined;
}, {
    id: string;
    message: string;
    channel: "slack" | "telegram" | "email" | "webhook";
    priority: "low" | "medium" | "high" | "urgent";
    title: string;
    timestamp: Date;
    metadata?: Record<string, unknown> | undefined;
}>;
//# sourceMappingURL=types.d.ts.map