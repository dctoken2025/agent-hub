/**
 * Sistema de notificações multi-canal.
 * Suporta Slack, Telegram, Email e Webhooks customizados.
 */
export class Notifier {
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * Envia uma notificação para o canal especificado.
     */
    async send(notification) {
        const fullNotification = {
            ...notification,
            id: crypto.randomUUID(),
            timestamp: new Date(),
        };
        try {
            switch (notification.channel) {
                case 'slack':
                    return await this.sendSlack(fullNotification);
                case 'telegram':
                    return await this.sendTelegram(fullNotification);
                case 'webhook':
                    return await this.sendWebhook(fullNotification);
                case 'email':
                    console.log('[Notifier] Email não implementado ainda');
                    return false;
                default:
                    console.error(`[Notifier] Canal desconhecido: ${notification.channel}`);
                    return false;
            }
        }
        catch (error) {
            console.error('[Notifier] Erro ao enviar notificação:', error);
            return false;
        }
    }
    /**
     * Envia notificação rápida com defaults.
     */
    async notify(message, options) {
        const channel = options?.channel || this.getDefaultChannel();
        if (!channel) {
            console.error('[Notifier] Nenhum canal configurado');
            return false;
        }
        return this.send({
            channel,
            priority: options?.priority || 'medium',
            title: options?.title || 'Agent Hub',
            message,
        });
    }
    getDefaultChannel() {
        if (this.config.slack)
            return 'slack';
        if (this.config.telegram)
            return 'telegram';
        if (this.config.webhook)
            return 'webhook';
        return null;
    }
    async sendSlack(notification) {
        if (!this.config.slack?.webhookUrl) {
            throw new Error('Slack webhook URL não configurado');
        }
        const emoji = this.getPriorityEmoji(notification.priority);
        const response = await fetch(this.config.slack.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                blocks: [
                    {
                        type: 'header',
                        text: {
                            type: 'plain_text',
                            text: `${emoji} ${notification.title}`,
                        },
                    },
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: notification.message,
                        },
                    },
                ],
            }),
        });
        return response.ok;
    }
    async sendTelegram(notification) {
        if (!this.config.telegram?.botToken || !this.config.telegram?.chatId) {
            throw new Error('Telegram não configurado');
        }
        const emoji = this.getPriorityEmoji(notification.priority);
        const text = `${emoji} *${notification.title}*\n\n${notification.message}`;
        const response = await fetch(`https://api.telegram.org/bot${this.config.telegram.botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: this.config.telegram.chatId,
                text,
                parse_mode: 'Markdown',
            }),
        });
        return response.ok;
    }
    async sendWebhook(notification) {
        if (!this.config.webhook?.url) {
            throw new Error('Webhook URL não configurado');
        }
        const response = await fetch(this.config.webhook.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...this.config.webhook.headers,
            },
            body: JSON.stringify(notification),
        });
        return response.ok;
    }
    getPriorityEmoji(priority) {
        switch (priority) {
            case 'urgent': return '🚨';
            case 'high': return '🔴';
            case 'medium': return '🟡';
            case 'low': return '🟢';
        }
    }
}
//# sourceMappingURL=notifier.js.map