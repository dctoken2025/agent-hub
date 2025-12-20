import { Agent, type AgentConfig, type AgentResult, Notifier } from '@agent-hub/core';
import { FinancialAnalyzer } from './financial-analyzer.js';
import { FinancialDocumentExtractor } from './document-extractor.js';
import type { FinancialItem, FinancialAgentConfig, DocumentAttachment, ExtractedDocument } from './types.js';

export interface FinancialAgentInput {
  emailId: string;
  threadId?: string;
  emailSubject: string;
  emailBody: string;
  emailFrom?: string;      // Remetente do email
  emailDate?: Date;        // Data do email
  attachmentInfo?: string; // Informações básicas sobre anexos (nome, tipo, tamanho)
  attachments?: DocumentAttachment[]; // Anexos com conteúdo para análise profunda
}

export interface FinancialAgentResult {
  emailId: string;
  itemsFound: number;
  items: FinancialItem[];
  hasUrgentItems: boolean;
  hasOverdueItems: boolean;
  totalAmount: number;
  summary: string;
}

/**
 * Agente financeiro para análise de cobranças, boletos e pagamentos.
 * Recebe emails do Email Agent e extrai informações financeiras estruturadas.
 * 
 * MELHORADO: Agora extrai e analisa o conteúdo de anexos (PDFs de boletos, etc.)
 * similar ao Legal Agent, para capturar todas as informações financeiras.
 */
export class FinancialAgent extends Agent<FinancialAgentInput, FinancialAgentResult> {
  private analyzer: FinancialAnalyzer;
  private extractor: FinancialDocumentExtractor;
  private financialConfig: FinancialAgentConfig;
  private notifier?: Notifier;
  
  // Fila de emails para processar
  private queue: FinancialAgentInput[] = [];

  constructor(
    agentConfig: AgentConfig,
    financialConfig: FinancialAgentConfig,
    notifier?: Notifier
  ) {
    super(agentConfig);
    this.financialConfig = financialConfig;
    this.analyzer = new FinancialAnalyzer(this.financialConfig);
    this.extractor = new FinancialDocumentExtractor();
    this.notifier = notifier;
  }

  /**
   * Adiciona email à fila para processamento.
   */
  enqueue(input: FinancialAgentInput): void {
    this.queue.push(input);
    console.log(`[FinancialAgent] Email adicionado à fila. Total: ${this.queue.length}`);
  }

  /**
   * Verifica se um email parece ser sobre finanças.
   */
  isFinancialEmail(subject: string, body: string): boolean {
    return this.analyzer.isFinancialEmail(subject, body);
  }

  /**
   * Processa a fila de emails financeiros.
   */
  async execute(input?: FinancialAgentInput): Promise<AgentResult<FinancialAgentResult>> {
    const startTime = Date.now();
    console.log('[FinancialAgent] 💰 Execute chamado');

    // Se recebeu input direto, usa ele; senão, pega da fila
    const toProcess = input || this.queue.shift();

    if (!toProcess) {
      console.log('[FinancialAgent] ⚠️ Nenhum email para processar');
      return {
        success: true,
        data: {
          emailId: '',
          itemsFound: 0,
          items: [],
          hasUrgentItems: false,
          hasOverdueItems: false,
          totalAmount: 0,
          summary: 'Nenhum email na fila para processar',
        },
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };
    }

    try {
      console.log(`[FinancialAgent] 📧 Processando email: ${toProcess.emailSubject}`);

      // Extrai texto dos anexos (PDFs, imagens)
      const extractedDocuments: ExtractedDocument[] = [];
      
      if (toProcess.attachments && toProcess.attachments.length > 0) {
        console.log(`[FinancialAgent] 📎 Processando ${toProcess.attachments.length} anexo(s)...`);
        
        for (const attachment of toProcess.attachments) {
          try {
            // Verifica se o tipo é suportado
            if (!this.extractor.isSupported(attachment.mimeType)) {
              console.log(`[FinancialAgent] ⚠️ Tipo não suportado: ${attachment.mimeType} (${attachment.filename})`);
              continue;
            }
            
            // Verifica se tem conteúdo
            if (!attachment.content) {
              console.log(`[FinancialAgent] ⚠️ Anexo sem conteúdo: ${attachment.filename}`);
              continue;
            }
            
            // Verifica tamanho máximo
            if (attachment.size > this.financialConfig.maxAttachmentSize) {
              console.log(`[FinancialAgent] ⚠️ Anexo muito grande: ${attachment.filename} (${attachment.size} bytes)`);
              continue;
            }
            
            console.log(`[FinancialAgent] 📄 Extraindo: ${attachment.filename}...`);
            const extracted = await this.extractor.extract(attachment);
            extractedDocuments.push(extracted);
            
            console.log(`[FinancialAgent] ✅ Extraído: ${attachment.filename} (${extracted.text.length} caracteres)`);
            
            // Log de dados de boleto encontrados
            if (extracted.boletoInfo) {
              console.log(`[FinancialAgent]    📊 Dados de boleto detectados:`);
              if (extracted.boletoInfo.value) {
                console.log(`[FinancialAgent]       Valor: R$ ${extracted.boletoInfo.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
              }
              if (extracted.boletoInfo.dueDate) {
                console.log(`[FinancialAgent]       Vencimento: ${extracted.boletoInfo.dueDate}`);
              }
              if (extracted.boletoInfo.barcode) {
                console.log(`[FinancialAgent]       Código: ${extracted.boletoInfo.barcode.substring(0, 25)}...`);
              }
            }
            
          } catch (error) {
            console.error(`[FinancialAgent] ❌ Erro ao extrair ${attachment.filename}:`, error instanceof Error ? error.message : error);
          }
        }
        
        console.log(`[FinancialAgent] 📊 ${extractedDocuments.length}/${toProcess.attachments.length} anexo(s) extraído(s)`);
      }

      // Analisa o email com IA (agora incluindo documentos extraídos)
      const items = await this.analyzer.analyze(
        toProcess.emailSubject,
        toProcess.emailBody,
        toProcess.emailId,
        toProcess.threadId,
        toProcess.attachmentInfo,
        toProcess.emailFrom,
        toProcess.emailDate,
        extractedDocuments.length > 0 ? extractedDocuments : undefined
      );

      console.log(`[FinancialAgent] ✅ Encontrados ${items.length} item(ns) financeiro(s)`);

      // Calcula métricas
      const hasUrgentItems = items.some(i => i.priority === 'urgent');
      const hasOverdueItems = items.some(i => i.status === 'overdue');
      const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);

      // Log detalhado
      items.forEach((item, idx) => {
        console.log(`[FinancialAgent]    ${idx + 1}. ${item.creditor}: R$ ${(item.amount / 100).toFixed(2)} - ${item.description.substring(0, 50)}`);
        if (item.dueDate) {
          console.log(`[FinancialAgent]       Vencimento: ${item.dueDate} | Status: ${item.status}`);
        }
      });

      // Gera resumo
      const summary = this.generateSummary(items);

      // Notifica se houver itens urgentes ou vencidos
      if ((hasUrgentItems || hasOverdueItems) && this.notifier) {
        console.log('[FinancialAgent] 🔔 Enviando notificação...');
        await this.notifyUrgent(toProcess, items);
      }

      const result: FinancialAgentResult = {
        emailId: toProcess.emailId,
        itemsFound: items.length,
        items,
        hasUrgentItems,
        hasOverdueItems,
        totalAmount,
        summary,
      };

      console.log(`[FinancialAgent] ✅ Processamento concluído: ${items.length} item(ns)`);

      return {
        success: true,
        data: result,
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[FinancialAgent] ❌ Erro:', errorMessage);

      return {
        success: false,
        error: errorMessage,
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Gera resumo dos itens encontrados.
   */
  private generateSummary(items: FinancialItem[]): string {
    if (items.length === 0) {
      return 'Nenhum item financeiro identificado';
    }

    const total = items.reduce((sum, i) => sum + i.amount, 0);
    const overdueCount = items.filter(i => i.status === 'overdue').length;
    const urgentCount = items.filter(i => i.priority === 'urgent').length;

    let summary = `${items.length} cobrança(s) identificada(s). `;
    summary += `Total: R$ ${(total / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. `;

    if (overdueCount > 0) {
      summary += `⚠️ ${overdueCount} vencida(s). `;
    }
    if (urgentCount > 0) {
      summary += `🔴 ${urgentCount} urgente(s).`;
    }

    return summary.trim();
  }

  /**
   * Envia notificação para itens urgentes ou vencidos.
   */
  private async notifyUrgent(input: FinancialAgentInput, items: FinancialItem[]): Promise<void> {
    if (!this.notifier) return;

    const urgentItems = items.filter(i => 
      i.priority === 'urgent' || i.status === 'overdue'
    );

    const message = urgentItems.map(item => {
      const statusEmoji = item.status === 'overdue' ? '🔴' : '⚠️';
      const amount = (item.amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      return `${statusEmoji} **${item.creditor}**\n` +
        `Valor: R$ ${amount}\n` +
        `Vencimento: ${item.dueDate || 'Não informado'}\n` +
        `Descrição: ${item.description.substring(0, 100)}`;
    }).join('\n\n');

    await this.notifier.notify(message, {
      title: `💰 Cobranças Urgentes - ${input.emailSubject}`,
      priority: 'urgent',
    });
  }

  /**
   * Retorna quantidade de itens na fila.
   */
  getQueueSize(): number {
    return this.queue.length;
  }
}

