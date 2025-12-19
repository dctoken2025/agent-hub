import { Agent, type AgentConfig, type AgentResult, Notifier } from '@agent-hub/core';
import { GmailClient } from './gmail-client.js';
import { EmailClassifier } from './email-classifier.js';
import type { Email, EmailAgentConfig, ClassifiedEmail, EmailPriority } from './types.js';

export interface EmailAgentResult {
  processedCount: number;
  classifications: {
    urgent: number;
    attention: number;
    informative: number;
    low: number;
    cc_only: number;
  };
  emails: ClassifiedEmail[];
}

/**
 * Agente autônomo para classificação e triagem de emails.
 */
export class EmailAgent extends Agent<void, EmailAgentResult> {
  private gmailClient: GmailClient;
  private classifier: EmailClassifier;
  private emailConfig: EmailAgentConfig;
  private notifier?: Notifier;

  constructor(
    agentConfig: AgentConfig,
    emailConfig: EmailAgentConfig,
    notifier?: Notifier
  ) {
    super(agentConfig);
    this.emailConfig = emailConfig;
    this.gmailClient = new GmailClient();
    this.classifier = new EmailClassifier(emailConfig);
    this.notifier = notifier;
  }

  async initialize(): Promise<void> {
    console.log('[EmailAgent] Inicializando conexão com Gmail...');
    await this.gmailClient.initialize();
    console.log('[EmailAgent] Conexão estabelecida');
  }

  async execute(): Promise<AgentResult<EmailAgentResult>> {
    const startTime = Date.now();
    
    try {
      // Busca emails não lidos
      const query = this.emailConfig.unreadOnly ? 'is:unread' : undefined;
      const { emails } = await this.gmailClient.getEmails({
        query,
        maxResults: this.emailConfig.maxEmailsPerRun,
        labelIds: this.emailConfig.labelsToProcess,
      });

      console.log(`[EmailAgent] Encontrados ${emails.length} emails para processar`);

      const classifiedEmails: ClassifiedEmail[] = [];
      const counts: EmailAgentResult['classifications'] = {
        urgent: 0,
        attention: 0,
        informative: 0,
        low: 0,
        cc_only: 0,
      };

      // Classifica cada email
      for (const email of emails) {
        try {
          const classification = await this.classifier.classify(email);
          
          const classifiedEmail: ClassifiedEmail = {
            ...email,
            classification,
            classifiedAt: new Date(),
          };

          classifiedEmails.push(classifiedEmail);
          counts[classification.priority]++;

          console.log(
            `[EmailAgent] ${this.getPriorityEmoji(classification.priority)} ` +
            `${email.subject.substring(0, 50)} - ${classification.priority}`
          );
        } catch (error) {
          console.error(`[EmailAgent] Erro ao classificar email ${email.id}:`, error);
        }
      }

      // Notifica sobre emails urgentes
      if (counts.urgent > 0 && this.notifier) {
        const urgentEmails = classifiedEmails.filter(e => e.classification.priority === 'urgent');
        await this.notifyUrgent(urgentEmails);
      }

      const result: EmailAgentResult = {
        processedCount: classifiedEmails.length,
        classifications: counts,
        emails: classifiedEmails,
      };

      return {
        success: true,
        data: result,
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      return {
        success: false,
        error: errorMessage,
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Processa um email específico por ID.
   */
  async processEmail(emailId: string): Promise<ClassifiedEmail | null> {
    const email = await this.gmailClient.getEmailDetails(emailId);
    if (!email) return null;

    const classification = await this.classifier.classify(email);
    return {
      ...email,
      classification,
      classifiedAt: new Date(),
    };
  }

  /**
   * Gera URL para autorização OAuth.
   */
  getAuthUrl(): string {
    return this.gmailClient.getAuthUrl();
  }

  /**
   * Completa autorização com código OAuth.
   */
  async completeAuth(code: string): Promise<void> {
    await this.gmailClient.exchangeCodeForTokens(code);
  }

  /**
   * Retorna resumo formatado dos emails processados.
   */
  formatSummary(result: EmailAgentResult): string {
    const lines = [
      '📧 **Resumo da Triagem de Emails**',
      '',
      `Total processado: ${result.processedCount}`,
      '',
      '**Por Prioridade:**',
      `🚨 Urgente: ${result.classifications.urgent}`,
      `🔴 Atenção: ${result.classifications.attention}`,
      `📄 Informativo: ${result.classifications.informative}`,
      `📋 Baixa: ${result.classifications.low}`,
      `📎 Apenas CC: ${result.classifications.cc_only}`,
    ];

    if (result.classifications.urgent > 0) {
      lines.push('', '**Emails Urgentes:**');
      result.emails
        .filter(e => e.classification.priority === 'urgent')
        .forEach(e => {
          lines.push(`- ${e.subject} (de: ${e.from.email})`);
          lines.push(`  Razão: ${e.classification.reasoning}`);
        });
    }

    return lines.join('\n');
  }

  private async notifyUrgent(urgentEmails: ClassifiedEmail[]): Promise<void> {
    if (!this.notifier) return;

    const message = urgentEmails
      .map(e => `• ${e.subject}\n  De: ${e.from.email}\n  ${e.classification.reasoning}`)
      .join('\n\n');

    await this.notifier.notify(message, {
      title: `🚨 ${urgentEmails.length} Email(s) Urgente(s)`,
      priority: 'urgent',
    });
  }

  private getPriorityEmoji(priority: EmailPriority): string {
    switch (priority) {
      case 'urgent': return '🚨';
      case 'attention': return '🔴';
      case 'informative': return '📄';
      case 'low': return '📋';
      case 'cc_only': return '📎';
    }
  }
}
