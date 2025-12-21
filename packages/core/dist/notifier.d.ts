import type { Notification, NotifierConfig, NotificationChannel, NotificationPriority } from './types.js';
/**
 * Sistema de notificações multi-canal.
 * Suporta Slack, Telegram, Email e Webhooks customizados.
 */
export declare class Notifier {
    private config;
    constructor(config: NotifierConfig);
    /**
     * Envia uma notificação para o canal especificado.
     */
    send(notification: Omit<Notification, 'id' | 'timestamp'>): Promise<boolean>;
    /**
     * Envia notificação rápida com defaults.
     */
    notify(message: string, options?: {
        title?: string;
        channel?: NotificationChannel;
        priority?: NotificationPriority;
    }): Promise<boolean>;
    private getDefaultChannel;
    private sendSlack;
    private sendTelegram;
    private sendWebhook;
    private getPriorityEmoji;
}
//# sourceMappingURL=notifier.d.ts.map