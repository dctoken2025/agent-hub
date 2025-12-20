import { Agent, type AgentConfig, type AgentResult, Notifier } from '@agent-hub/core';
import { LegalAgent, type LegalAgentConfig, type ContractAnalysis } from '@agent-hub/legal-agent';
import { FinancialAgent, type FinancialAgentConfig, type FinancialItem } from '@agent-hub/financial-agent';
import { TaskAgent, type ActionItem } from '@agent-hub/task-agent';
import { GmailClient } from './gmail-client.js';
import { EmailClassifier, type ClassificationRule } from './email-classifier.js';
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
  financialItemsDetected: number;
  financialItems: FinancialItem[];
  actionItemsDetected: number;
  actionItems: ActionItem[];
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
  private financialAgent?: FinancialAgent;
  private taskAgent?: TaskAgent;
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
    
    // Inicializa Financial Agent integrado
    this.initializeFinancialAgent();
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

  private initializeFinancialAgent(): void {
    const financialConfig: FinancialAgentConfig = {
      financialKeywords: [
        'boleto', 'fatura', 'invoice', 'cobrança', 'pagamento',
        'vencimento', 'vence em', 'pagar até', 'payment due',
        'nota fiscal', 'nf-e', 'nfe', 'danfe', 'recibo',
        'valor', 'parcela', 'mensalidade', 'anuidade',
        'total a pagar', 'amount due',
        'banco', 'pix', 'transferência',
        'efetuar pagamento', 'segue boleto', 'anexo boleto',
      ],
      supportedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg'],
      maxAttachmentSize: 5 * 1024 * 1024, // 5MB
      urgentDaysBeforeDue: 3,
      approvalThreshold: 500000, // R$ 5.000 em centavos
    };

    this.financialAgent = new FinancialAgent(
      {
        id: 'financial-agent',
        name: 'Financial Agent',
        description: 'Agente de análise de cobranças e pagamentos',
        enabled: true,
      },
      financialConfig,
      this.notifier
    );

    console.log('[EmailAgent] Financial Agent integrado');
  }

  /**
   * Injeta uma instância externa do Legal Agent (com listeners configurados).
   */
  setLegalAgent(legalAgent: LegalAgent): void {
    this.legalAgent = legalAgent;
    console.log('[EmailAgent] Legal Agent externo injetado');
  }

  /**
   * Injeta uma instância externa do Financial Agent (com listeners configurados).
   */
  setFinancialAgent(financialAgent: FinancialAgent): void {
    this.financialAgent = financialAgent;
    console.log('[EmailAgent] Financial Agent externo injetado');
  }

  /**
   * Injeta um Task Agent externo para análise de action items.
   */
  setTaskAgent(taskAgent: TaskAgent): void {
    this.taskAgent = taskAgent;
    console.log('[EmailAgent] Task Agent externo injetado');
  }

  /**
   * Define regras de classificação personalizadas.
   */
  setCustomRules(rules: ClassificationRule[]): void {
    this.classifier.setCustomRules(rules);
    console.log(`[EmailAgent] ${rules.length} regras personalizadas carregadas`);
  }

  async initialize(): Promise<void> {
    console.log('[EmailAgent] Inicializando conexão com Gmail...');
    
    // Se tiver tokens passados (do banco de dados), usa diretamente
    if (this.emailConfig.gmailTokens) {
      console.log('[EmailAgent] Usando tokens do banco de dados...');
      await this.gmailClient.initializeWithTokens(this.emailConfig.gmailTokens);
    } else {
      // Senão, tenta ler de arquivo local (modo CLI/desenvolvimento)
      await this.gmailClient.initialize();
    }

    // Obtém ou cria o label para marcar emails processados
    this.processedLabelId = await this.gmailClient.getOrCreateLabel(PROCESSED_LABEL_NAME);
    console.log(`[EmailAgent] Label "${PROCESSED_LABEL_NAME}" configurado (ID: ${this.processedLabelId})`);

    console.log('[EmailAgent] Conexão estabelecida');
  }

  // Set para rastrear emails já processados nesta sessão
  private processedEmailIds: Set<string> = new Set();

  // Callback para atualizar lastProcessedAt no banco
  public onProcessingComplete?: (lastProcessedAt: Date) => Promise<void>;

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
      
      // Adiciona filtro de data - busca apenas emails após a data mais recente entre:
      // 1. lastProcessedAt (última execução do agente)
      // 2. startDate (data base configurada pelo usuário)
      const filterDate = this.getFilterDate();
      if (filterDate) {
        // Gmail usa formato YYYY/MM/DD para query after:
        const year = filterDate.getFullYear();
        const month = String(filterDate.getMonth() + 1).padStart(2, '0');
        const day = String(filterDate.getDate()).padStart(2, '0');
        query += ` after:${year}/${month}/${day}`;
        console.log(`[EmailAgent] 📅 Buscando emails após: ${filterDate.toISOString()}`);
      }
      
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
      const financialItems: FinancialItem[] = [];
      const actionItems: ActionItem[] = [];
      let contractsDetected = 0;
      let financialItemsDetected = 0;
      let actionItemsDetected = 0;

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

          // Verifica se é email financeiro (cobranças, boletos, faturas)
          if (this.isFinancialEmail(email)) {
            console.log(`[EmailAgent] 💰 Email financeiro detectado: ${email.subject}`);

            // Processa com Financial Agent
            const items = await this.processWithFinancialAgent(email);
            if (items.length > 0) {
              financialItems.push(...items);
              financialItemsDetected += items.length;
            }
          }

          // Verifica se email contém action items (tarefas, perguntas, pendências)
          if (this.hasActionItems(email)) {
            console.log(`[EmailAgent] 📋 Action items detectados em: ${email.subject}`);

            // Processa com Task Agent
            const tasks = await this.processWithTaskAgent(email);
            if (tasks.length > 0) {
              actionItems.push(...tasks);
              actionItemsDetected += tasks.length;
            }
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
        financialItemsDetected,
        financialItems,
        actionItemsDetected,
        actionItems,
      };

      // Atualiza lastProcessedAt com a data/hora atual (timezone Brasil)
      // Isso garante que na próxima execução só buscaremos emails novos
      if (classifiedEmails.length > 0 && this.onProcessingComplete) {
        const now = new Date();
        await this.onProcessingComplete(now);
        console.log(`[EmailAgent] ✅ lastProcessedAt atualizado para: ${now.toISOString()}`);
      }

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
   * Retorna a data a partir da qual buscar emails.
   * Prioriza lastProcessedAt (mais recente), depois startDate.
   */
  private getFilterDate(): Date | null {
    const { lastProcessedAt, startDate } = this.emailConfig;
    
    // Converte para Date se for string
    const lastDate = lastProcessedAt 
      ? (typeof lastProcessedAt === 'string' ? new Date(lastProcessedAt) : lastProcessedAt)
      : null;
    const start = startDate 
      ? (typeof startDate === 'string' ? new Date(startDate) : startDate)
      : null;
    
    // Se temos lastProcessedAt, usa ele (sempre mais recente)
    if (lastDate && !isNaN(lastDate.getTime())) {
      return lastDate;
    }
    
    // Senão, usa startDate se configurado
    if (start && !isNaN(start.getTime())) {
      return start;
    }
    
    // Nenhum filtro de data
    return null;
  }

  /**
   * Atualiza a configuração de datas (chamado externamente)
   */
  public updateDateConfig(config: { startDate?: string | Date; lastProcessedAt?: string | Date }): void {
    if (config.startDate !== undefined) {
      this.emailConfig.startDate = config.startDate;
    }
    if (config.lastProcessedAt !== undefined) {
      this.emailConfig.lastProcessedAt = config.lastProcessedAt;
    }
    console.log(`[EmailAgent] Configuração de datas atualizada:`, {
      startDate: this.emailConfig.startDate,
      lastProcessedAt: this.emailConfig.lastProcessedAt,
    });
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
   * Verifica se um email parece ser sobre finanças (boletos, cobranças, pagamentos).
   */
  private isFinancialEmail(email: Email): boolean {
    const content = `${email.subject} ${email.body}`.toLowerCase();
    
    const financialIndicators = [
      // Boletos e faturas
      'boleto', 'fatura', 'invoice', 'cobrança', 'pagamento',
      'vencimento', 'vence em', 'pagar até', 'payment due',
      // Documentos fiscais
      'nota fiscal', 'nf-e', 'nfe', 'danfe', 'recibo',
      // Valores
      'valor a pagar', 'total a pagar', 'parcela', 'mensalidade',
      // Ações
      'segue boleto', 'anexo boleto', 'efetuar pagamento',
      'realize o pagamento', 'lembrete de pagamento',
      // Códigos
      'código de barras', 'linha digitável', 'pix copia',
    ];

    // Verifica se tem indicadores financeiros
    const hasFinancialIndicator = financialIndicators.some(indicator => 
      content.includes(indicator)
    );

    // Também considera emails de remetentes financeiros conhecidos
    const financialSenders = [
      'cobranca@', 'boleto@', 'fatura@', 'nfe@', 'financeiro@',
      'pagamento@', 'billing@', 'invoice@', 'accounts@',
    ];
    
    const fromEmail = email.from.email.toLowerCase();
    const isFromFinancialSender = financialSenders.some(s => fromEmail.includes(s));

    return hasFinancialIndicator || isFromFinancialSender;
  }

  /**
   * Verifica se um email contém action items (tarefas, perguntas, pendências).
   */
  private hasActionItems(email: Email): boolean {
    const content = `${email.subject} ${email.body}`.toLowerCase();

    // Indicadores de perguntas e solicitações
    const actionIndicators = [
      // Perguntas diretas
      'como estamos', 'qual o status', 'podem confirmar', 'poderiam confirmar',
      'tudo ok', 'tudo certo', 'correto?', 'certo?',
      // Solicitações
      'gostaria de saber', 'preciso saber', 'favor informar', 'me informe',
      'solicito', 'peço que', 'por favor',
      // Prazos
      'até quando', 'prazo', 'deadline', 'data limite',
      'previsto para', 'previsão',
      // Pendências
      'pendências', 'pendente', 'falta', 'aguardando',
      'já temos', 'já recebemos',
      // Ações
      'próximos passos', 'action items', 'tarefas',
      'verificar', 'confirmar', 'providenciar',
    ];

    // Verifica indicadores
    const hasIndicator = actionIndicators.some(indicator =>
      content.includes(indicator)
    );

    // Verifica se tem perguntas (pelo menos uma ?)
    const hasQuestions = (content.match(/\?/g) || []).length >= 1;

    // Verifica se tem listas numeradas ou com bullets
    const hasBullets = /[•\-\*]\s+\w|^\d+[\.\)]\s+/m.test(email.body);

    return hasIndicator || (hasQuestions && hasBullets);
  }

  /**
   * Processa email com Task Agent para extração de action items.
   */
  private async processWithTaskAgent(email: Email): Promise<ActionItem[]> {
    console.log(`[EmailAgent] 📋 Iniciando processamento com Task Agent para: ${email.subject}`);

    if (!this.taskAgent) {
      console.log('[EmailAgent] ⚠️ Task Agent não inicializado');
      return [];
    }

    try {
      const result = await this.taskAgent.processEmail({
        emailId: email.id,
        threadId: email.threadId,
        emailSubject: email.subject,
        emailBody: email.body,
        emailFrom: email.from.email,
        emailDate: email.date,
      });

      if (result && result.items.length > 0) {
        console.log(`[EmailAgent] ✅ ${result.items.length} action item(s) extraído(s)`);
        return result.items;
      }

      return [];
    } catch (error) {
      console.error('[EmailAgent] Erro ao processar com Task Agent:', error);
      return [];
    }
  }

  /**
   * Processa email com Financial Agent para análise de cobranças.
   * MELHORADO: Agora baixa e envia o conteúdo dos anexos (PDFs de boletos, etc.)
   * para análise profunda, similar ao Legal Agent.
   */
  private async processWithFinancialAgent(email: Email): Promise<FinancialItem[]> {
    console.log(`[EmailAgent] 💰 Iniciando processamento com Financial Agent para: ${email.subject}`);
    
    if (!this.financialAgent) {
      console.log('[EmailAgent] ⚠️ Financial Agent não inicializado');
      return [];
    }

    try {
      // Monta informações sobre anexos (se houver)
      let attachmentInfo = '';
      const attachmentsWithContent: Array<{
        id?: string;
        filename: string;
        mimeType: string;
        size: number;
        content?: Buffer;
      }> = [];
      
      if (email.attachments && email.attachments.length > 0) {
        console.log(`[EmailAgent] 📎 Email financeiro com ${email.attachments.length} anexo(s)`);
        
        attachmentInfo = email.attachments.map(att => 
          `- ${att.filename} (${att.mimeType}, ${att.size} bytes)`
        ).join('\n');

        // Baixa o conteúdo dos anexos suportados (PDFs, imagens)
        const supportedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
        
        for (const att of email.attachments) {
          try {
            // Verifica se é tipo suportado
            const isSupported = supportedTypes.some(t => att.mimeType.toLowerCase().includes(t) || att.mimeType.toLowerCase().startsWith('image/'));
            if (!isSupported) {
              console.log(`[EmailAgent] ⏭️ Tipo não suportado para análise: ${att.mimeType} (${att.filename})`);
              continue;
            }
            
            // Verifica se tem ID
            if (!att.id) {
              console.log(`[EmailAgent] ⚠️ Anexo ${att.filename} sem ID - pulando`);
              continue;
            }
            
            // Verifica tamanho (máximo 5MB)
            if (att.size > 5 * 1024 * 1024) {
              console.log(`[EmailAgent] ⚠️ Anexo muito grande: ${att.filename} (${att.size} bytes)`);
              continue;
            }
            
            console.log(`[EmailAgent] 📥 Baixando anexo financeiro: ${att.filename}...`);
            const content = await this.gmailClient.getAttachmentContent(email.id, att.id);
            
            attachmentsWithContent.push({
              id: att.id,
              filename: att.filename,
              mimeType: att.mimeType,
              size: att.size,
              content,
            });
            
            console.log(`[EmailAgent] ✅ Anexo baixado: ${att.filename} (${content.length} bytes)`);
            
          } catch (error) {
            console.error(`[EmailAgent] ❌ Erro ao baixar anexo ${att.filename}:`, error instanceof Error ? error.message : error);
          }
        }
        
        console.log(`[EmailAgent] 📊 ${attachmentsWithContent.length}/${email.attachments.length} anexo(s) baixado(s) para análise`);
      }

      // Envia para Financial Agent (agora com anexos!)
      console.log('[EmailAgent] 💰 Enviando para Financial Agent...');
      const emailFromStr = email.from.name 
        ? `${email.from.name} <${email.from.email}>`
        : email.from.email;
      
      const result = await this.financialAgent.runOnce({
        emailId: email.id,
        threadId: email.threadId,
        emailSubject: email.subject,
        emailBody: email.body,
        emailFrom: emailFromStr,
        emailDate: email.date ? new Date(email.date) : undefined,
        attachmentInfo,
        attachments: attachmentsWithContent.length > 0 ? attachmentsWithContent : undefined,
      });

      if (result.success && result.data) {
        console.log(`[EmailAgent] ✅ Financial Agent concluiu: ${result.data.itemsFound} item(ns) encontrado(s)`);
        if (result.data.items.length > 0) {
          result.data.items.forEach(item => {
            const amount = (item.amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            console.log(`[EmailAgent]    💵 ${item.creditor}: R$ ${amount} - ${item.description.substring(0, 50)}`);
            if (item.dueDate) {
              console.log(`[EmailAgent]       📅 Vencimento: ${item.dueDate}`);
            }
            if (item.pixKey) {
              console.log(`[EmailAgent]       🔑 PIX: ${item.pixKey}`);
            }
            if (item.recurrence) {
              console.log(`[EmailAgent]       🔄 Recorrência: ${item.recurrence}`);
            }
          });
        }
        return result.data.items;
      } else {
        console.log(`[EmailAgent] ⚠️ Financial Agent retornou sem sucesso: ${result.error || 'sem erro específico'}`);
      }

      return [];
    } catch (error) {
      console.error('[EmailAgent] ❌ Erro ao processar com Financial Agent:', error instanceof Error ? error.message : error);
      return [];
    }
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
   * Retorna o Financial Agent integrado.
   */
  getFinancialAgent(): FinancialAgent | undefined {
    return this.financialAgent;
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

    if (result.financialItemsDetected > 0) {
      lines.push('', `💰 **Cobranças Detectadas:** ${result.financialItemsDetected}`);
      
      if (result.financialItems.length > 0) {
        const total = result.financialItems.reduce((sum, item) => sum + item.amount, 0);
        lines.push(`Total: R$ ${(total / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        
        const overdue = result.financialItems.filter(i => i.status === 'overdue');
        if (overdue.length > 0) {
          lines.push(`🔴 ${overdue.length} vencida(s)`);
        }
        
        lines.push('', '**Itens:**');
        result.financialItems.slice(0, 5).forEach(item => {
          const amount = (item.amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          const statusEmoji = item.status === 'overdue' ? '🔴' : item.priority === 'urgent' ? '⚠️' : '📋';
          lines.push(`${statusEmoji} ${item.creditor}: R$ ${amount} - ${item.dueDate || 'Sem vencimento'}`);
        });
        
        if (result.financialItems.length > 5) {
          lines.push(`... e mais ${result.financialItems.length - 5} item(ns)`);
        }
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
