import type { Notification, NotifierConfig, NotificationChannel, NotificationPriority } from './types.js';

/**
 * Sistema de notificações multi-canal.
 * Suporta Slack, Telegram, Email e Webhooks customizados.
 */
export class Notifier {
  private config: NotifierConfig;

  constructor(config: NotifierConfig) {
    this.config = config;
  }

  /**
   * Envia uma notificação para o canal especificado.
   */
  async send(notification: Omit<Notification, 'id' | 'timestamp'>): Promise<boolean> {
    const fullNotification: Notification = {
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
    } catch (error) {
      console.error('[Notifier] Erro ao enviar notificação:', error);
      return false;
    }
  }

  /**
   * Envia notificação rápida com defaults.
   */
  async notify(
    message: string,
    options?: {
      title?: string;
      channel?: NotificationChannel;
      priority?: NotificationPriority;
    }
  ): Promise<boolean> {
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

  private getDefaultChannel(): NotificationChannel | null {
    if (this.config.slack) return 'slack';
    if (this.config.telegram) return 'telegram';
    if (this.config.webhook) return 'webhook';
    return null;
  }

  private async sendSlack(notification: Notification): Promise<boolean> {
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

  private async sendTelegram(notification: Notification): Promise<boolean> {
    if (!this.config.telegram?.botToken || !this.config.telegram?.chatId) {
      throw new Error('Telegram não configurado');
    }

    const emoji = this.getPriorityEmoji(notification.priority);
    const text = `${emoji} *${notification.title}*\n\n${notification.message}`;

    const response = await fetch(
      `https://api.telegram.org/bot${this.config.telegram.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.config.telegram.chatId,
          text,
          parse_mode: 'Markdown',
        }),
      }
    );

    return response.ok;
  }

  private async sendWebhook(notification: Notification): Promise<boolean> {
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

  private getPriorityEmoji(priority: NotificationPriority): string {
    switch (priority) {
      case 'urgent': return '🚨';
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
    }
  }
}
