import { Agent, type AgentConfig, type AgentResult, Notifier } from '@agent-hub/core';
import { LegalAgent, type LegalAgentConfig, type ContractAnalysis } from '@agent-hub/legal-agent';
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
  contractsDetected: number;
  legalAnalyses: ContractAnalysis[];
}

/**
 * Agente autônomo para classificação e triagem de emails.
 * Integrado com Legal Agent para análise de contratos.
 */
const PROCESSED_LABEL_NAME = 'AgentHub-Processado';

export class EmailAgent extends Agent<void, EmailAgentResult> {
  private gmailClient: GmailClient;
  private classifier: EmailClassifier;
  private emailConfig: EmailAgentConfig;
  private notifier?: Notifier;
  private legalAgent?: LegalAgent;
  private processedLabelId?: string;

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

    // Inicializa Legal Agent integrado
    this.initializeLegalAgent();
  }

  private initializeLegalAgent(): void {
    const legalConfig: LegalAgentConfig = {
      supportedMimeTypes: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
      ],
      maxDocumentSize: 10 * 1024 * 1024, // 10MB
      contractKeywords: [
        'contrato', 'acordo', 'termo', 'aditivo', 'procuração',
        'minuta', 'proposta', 'contract', 'agreement', 'amendment',
      ],
    };

    this.legalAgent = new LegalAgent(
      {
        id: 'legal-agent',
        name: 'Legal Agent',
        description: 'Agente de análise de contratos e documentos legais',
        enabled: true,
      },
      legalConfig,
      this.notifier
    );

    console.log('[EmailAgent] Legal Agent integrado');
  }

  async initialize(): Promise<void> {
    console.log('[EmailAgent] Inicializando conexão com Gmail...');
    await this.gmailClient.initialize();
    
    // Obtém ou cria o label para marcar emails processados
    this.processedLabelId = await this.gmailClient.getOrCreateLabel(PROCESSED_LABEL_NAME);
    console.log(`[EmailAgent] Label "${PROCESSED_LABEL_NAME}" configurado (ID: ${this.processedLabelId})`);
    
    console.log('[EmailAgent] Conexão estabelecida');
  }

  // Set para rastrear emails já processados nesta sessão
  private processedEmailIds: Set<string> = new Set();

  async execute(): Promise<AgentResult<EmailAgentResult>> {
    const startTime = Date.now();
    
    try {
      // Garante que o label existe
      if (!this.processedLabelId) {
        this.processedLabelId = await this.gmailClient.getOrCreateLabel(PROCESSED_LABEL_NAME);
      }
      
      // Busca emails não lidos E que não tenham o label de processado
      // Usa -label: para excluir emails já processados
      let query = this.emailConfig.unreadOnly ? 'is:unread' : '';
      query += ` -label:${PROCESSED_LABEL_NAME}`;
      query = query.trim();
      const allEmails: Email[] = [];
      let pageToken: string | undefined;
      const maxPerPage = 100;
      let pagesLoaded = 0;
      const maxPages = Math.ceil(this.emailConfig.maxEmailsPerRun / maxPerPage);
      
      console.log(`[EmailAgent] Buscando até ${this.emailConfig.maxEmailsPerRun} emails (max ${maxPages} páginas)...`);
      
      // Loop de paginação - busca TODAS as páginas
      while (pagesLoaded < maxPages) {
        const { emails: pageEmails, nextPageToken } = await this.gmailClient.getEmails({
          query,
          maxResults: maxPerPage,
          labelIds: this.emailConfig.labelsToProcess,
          pageToken,
        });
        
        // Filtra emails que já foram processados nesta sessão
        const newEmails = pageEmails.filter(e => !this.processedEmailIds.has(e.id));
        allEmails.push(...newEmails);
        
        // Marca como processados
        pageEmails.forEach(e => this.processedEmailIds.add(e.id));
        
        pagesLoaded++;
        console.log(`[EmailAgent] Página ${pagesLoaded}: ${pageEmails.length} emails, ${newEmails.length} novos (total: ${allEmails.length})`);
        
        if (!nextPageToken) {
          console.log(`[EmailAgent] Fim da lista de emails (${pagesLoaded} páginas)`);
          break;
        }
        
        pageToken = nextPageToken;
        
        // Pequeno delay para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const emails = allEmails;
      console.log(`[EmailAgent] Total de novos emails para processar: ${emails.length}`);

      const classifiedEmails: ClassifiedEmail[] = [];
      const legalAnalyses: ContractAnalysis[] = [];
      let contractsDetected = 0;

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

          // Verifica se é email sobre contrato com anexos
          if (this.isContractEmail(email) && email.hasAttachments) {
            contractsDetected++;
            console.log(`[EmailAgent] 📜 Contrato detectado: ${email.subject}`);

            // Processa com Legal Agent
            const analyses = await this.processWithLegalAgent(email);
            legalAnalyses.push(...analyses);
          }

          // Adiciona label "AgentHub-Processado" para não processar novamente
          // NÃO marca como lido - mantém o estado original no Gmail
          try {
            if (this.processedLabelId) {
              await this.gmailClient.markAsProcessed(email.id, this.processedLabelId);
            }
          } catch (labelError) {
            console.error(`[EmailAgent] Erro ao adicionar label ao email: ${email.id}`);
          }

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
        contractsDetected,
        legalAnalyses,
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
   * Verifica se um email parece ser sobre contrato.
   */
  private isContractEmail(email: Email): boolean {
    const content = `${email.subject} ${email.body}`.toLowerCase();
    
    const contractIndicators = [
      // Discussão de contrato
      'contrato', 'minuta', 'acordo', 'termo de', 'aditivo',
      'proposta comercial', 'proposta de parceria',
      
      // Revisão/alterações
      'versão revisada', 'alterações', 'mudanças propostas',
      'para sua análise', 'favor revisar', 'análise jurídica',
      'revisão do contrato', 'nova versão',
      
      // Aprovação
      'aguardando aprovação', 'pendente de aprovação',
      'para aprovação', 'aprovar contrato',
      
      // Inglês
      'contract', 'agreement', 'draft', 'revised version',
      'please review', 'proposed changes', 'for your review',
    ];

    // Verifica se tem indicadores E anexos relevantes
    const hasContractIndicator = contractIndicators.some(indicator => 
      content.includes(indicator)
    );

    if (!hasContractIndicator) return false;

    // Verifica se tem anexos de documento
    if (email.attachments && email.attachments.length > 0) {
      const hasDocumentAttachment = email.attachments.some(att => {
        const mime = att.mimeType.toLowerCase();
        return mime.includes('pdf') || 
               mime.includes('word') || 
               mime.includes('document');
      });
      return hasDocumentAttachment;
    }

    return false;
  }

  /**
   * Processa email com Legal Agent para análise de contratos.
   */
  private async processWithLegalAgent(email: Email): Promise<ContractAnalysis[]> {
    console.log(`[EmailAgent] 🔍 Iniciando processamento com Legal Agent para: ${email.subject}`);
    
    if (!this.legalAgent) {
      console.log('[EmailAgent] ⚠️ Legal Agent não inicializado');
      return [];
    }
    
    if (!email.attachments || email.attachments.length === 0) {
      console.log('[EmailAgent] ⚠️ Email não tem anexos');
      return [];
    }

    console.log(`[EmailAgent] 📎 Anexos encontrados: ${email.attachments.length}`);
    email.attachments.forEach((att, i) => {
      console.log(`[EmailAgent]    ${i + 1}. ${att.filename} (${att.mimeType}, ${att.size} bytes, ID: ${att.id ? att.id.substring(0, 20) + '...' : 'SEM ID'})`);
    });

    try {
      // Baixa os anexos do email
      console.log('[EmailAgent] 📥 Baixando anexos do Gmail...');
      const attachmentsWithContent = await Promise.all(
        email.attachments.map(async (att, index) => {
          try {
            if (!att.id) {
              console.log(`[EmailAgent] ⚠️ Anexo ${index + 1} (${att.filename}) não tem ID - pulando`);
              return null;
            }
            
            console.log(`[EmailAgent] 📥 Baixando anexo ${index + 1}: ${att.filename}...`);
            const content = await this.gmailClient.getAttachmentContent(
              email.id,
              att.id
            );
            console.log(`[EmailAgent] ✅ Anexo ${att.filename} baixado: ${content.length} bytes`);
            return {
              ...att,
              content,
            };
          } catch (error) {
            console.error(`[EmailAgent] ❌ Erro ao baixar anexo ${att.filename}:`, error instanceof Error ? error.message : error);
            return null;
          }
        })
      );

      const validAttachments = attachmentsWithContent.filter(
        (att): att is NonNullable<typeof att> => att !== null && att.content !== undefined
      );

      console.log(`[EmailAgent] 📊 Anexos válidos para análise: ${validAttachments.length}/${email.attachments.length}`);

      if (validAttachments.length === 0) {
        console.log('[EmailAgent] ⚠️ Nenhum anexo válido para análise jurídica');
        return [];
      }

      // Envia para Legal Agent
      console.log('[EmailAgent] 📜 Enviando para Legal Agent...');
      const result = await this.legalAgent.runOnce({
        emailId: email.id,
        emailSubject: email.subject,
        emailBody: email.body,
        attachments: validAttachments,
      });

      if (result.success && result.data) {
        console.log(`[EmailAgent] ✅ Legal Agent concluiu: ${result.data.documentsAnalyzed} documento(s) analisado(s)`);
        if (result.data.analyses.length > 0) {
          result.data.analyses.forEach(analysis => {
            console.log(`[EmailAgent]    📄 ${analysis.documentName}: Risco ${analysis.overallRisk}, Requer atenção: ${analysis.requiresAttention}`);
          });
        }
        return result.data.analyses;
      } else {
        console.log(`[EmailAgent] ⚠️ Legal Agent retornou sem sucesso: ${result.error || 'sem erro específico'}`);
      }

      return [];
    } catch (error) {
      console.error('[EmailAgent] ❌ Erro ao processar com Legal Agent:', error instanceof Error ? error.message : error);
      return [];
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
   * Retorna o Legal Agent integrado.
   */
  getLegalAgent(): LegalAgent | undefined {
    return this.legalAgent;
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

    if (result.contractsDetected > 0) {
      lines.push('', `📜 **Contratos Detectados:** ${result.contractsDetected}`);
      
      if (result.legalAnalyses.length > 0) {
        lines.push('', '**Análises Jurídicas:**');
        result.legalAnalyses.forEach(analysis => {
          const riskEmoji = analysis.overallRisk === 'critical' ? '🚨' :
                           analysis.overallRisk === 'high' ? '⚠️' :
                           analysis.overallRisk === 'medium' ? '🟡' : '✅';
          lines.push(`${riskEmoji} ${analysis.documentName} - Risco: ${analysis.overallRisk}`);
        });
      }
    }

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
