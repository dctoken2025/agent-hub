import { Agent, type AgentConfig, type AgentResult, Notifier } from '@agent-hub/core';
import { CommercialAnalyzer } from './commercial-analyzer.js';
import type { CommercialItem, CommercialAgentConfig } from './types.js';

export interface CommercialAgentInput {
  emailId: string;
  threadId?: string;
  emailSubject: string;
  emailBody: string;
  emailFrom?: string;
  emailDate?: Date;
}

export interface CommercialAgentResult {
  emailId: string;
  itemsFound: number;
  items: CommercialItem[];
  hasCriticalItems: boolean;
  hasHighPriorityItems: boolean;
  totalEstimatedValue: number;
  summary: string;
}

/**
 * Agente comercial para análise de pedidos de cotação, propostas e oportunidades de vendas.
 * Recebe emails do Email Agent e extrai informações comerciais estruturadas.
 */
export class CommercialAgent extends Agent<CommercialAgentInput, CommercialAgentResult> {
  private analyzer: CommercialAnalyzer;
  private commercialConfig: CommercialAgentConfig;
  private notifier?: Notifier;
  
  // Fila de emails para processar
  private queue: CommercialAgentInput[] = [];

  constructor(
    agentConfig: AgentConfig,
    commercialConfig: CommercialAgentConfig,
    notifier?: Notifier
  ) {
    super(agentConfig);
    this.commercialConfig = commercialConfig;
    this.analyzer = new CommercialAnalyzer(this.commercialConfig);
    this.notifier = notifier;
  }

  /**
   * Adiciona email à fila para processamento.
   */
  enqueue(input: CommercialAgentInput): void {
    this.queue.push(input);
    console.log(`[CommercialAgent] Email adicionado à fila. Total: ${this.queue.length}`);
  }

  /**
   * Verifica se um email parece ser comercial.
   */
  isCommercialEmail(subject: string, body: string): boolean {
    return this.analyzer.isCommercialEmail(subject, body);
  }

  /**
   * Processa a fila de emails comerciais.
   */
  async execute(input?: CommercialAgentInput): Promise<AgentResult<CommercialAgentResult>> {
    const startTime = Date.now();
    console.log('[CommercialAgent] 💼 Execute chamado');

    // Se recebeu input direto, usa ele; senão, pega da fila
    const toProcess = input || this.queue.shift();

    if (!toProcess) {
      console.log('[CommercialAgent] ⚠️ Nenhum email para processar');
      return {
        success: true,
        data: {
          emailId: '',
          itemsFound: 0,
          items: [],
          hasCriticalItems: false,
          hasHighPriorityItems: false,
          totalEstimatedValue: 0,
          summary: 'Nenhum email na fila para processar',
        },
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };
    }

    try {
      console.log(`[CommercialAgent] 📧 Processando email: ${toProcess.emailSubject}`);

      // Analisa o email com IA
      const items = await this.analyzer.analyze(
        toProcess.emailSubject,
        toProcess.emailBody,
        toProcess.emailId,
        toProcess.threadId,
        toProcess.emailFrom,
        toProcess.emailDate,
      );

      console.log(`[CommercialAgent] ✅ Encontrados ${items.length} item(ns) comercial(is)`);

      // Calcula métricas
      const hasCriticalItems = items.some(i => i.priority === 'critical');
      const hasHighPriorityItems = items.some(i => i.priority === 'high' || i.priority === 'critical');
      const totalEstimatedValue = items.reduce((sum, i) => sum + (i.estimatedValue || 0), 0);

      // Log detalhado
      items.forEach((item, idx) => {
        console.log(`[CommercialAgent]    ${idx + 1}. [${item.type}] ${item.title}`);
        console.log(`[CommercialAgent]       Cliente: ${item.clientName} (${item.clientCompany || 'N/A'})`);
        console.log(`[CommercialAgent]       Prioridade: ${item.priority} | Confiança: ${item.confidence}%`);
        if (item.estimatedValue) {
          console.log(`[CommercialAgent]       Valor: R$ ${(item.estimatedValue / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        }
      });

      // Gera resumo
      const summary = this.generateSummary(items);

      // Notifica se houver itens críticos ou de alta prioridade
      if ((hasCriticalItems || hasHighPriorityItems) && this.notifier) {
        console.log('[CommercialAgent] 🔔 Enviando notificação...');
        await this.notifyPriority(toProcess, items);
      }

      const result: CommercialAgentResult = {
        emailId: toProcess.emailId,
        itemsFound: items.length,
        items,
        hasCriticalItems,
        hasHighPriorityItems,
        totalEstimatedValue,
        summary,
      };

      console.log(`[CommercialAgent] ✅ Processamento concluído: ${items.length} item(ns)`);

      return {
        success: true,
        data: result,
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[CommercialAgent] ❌ Erro:', errorMessage);

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
  private generateSummary(items: CommercialItem[]): string {
    if (items.length === 0) {
      return 'Nenhum item comercial identificado';
    }

    const totalValue = items.reduce((sum, i) => sum + (i.estimatedValue || 0), 0);
    const criticalCount = items.filter(i => i.priority === 'critical').length;
    const highCount = items.filter(i => i.priority === 'high').length;
    const quoteRequests = items.filter(i => i.type === 'quote_request').length;

    let summary = `${items.length} item(ns) comercial(is) identificado(s). `;
    
    if (quoteRequests > 0) {
      summary += `${quoteRequests} pedido(s) de cotação. `;
    }

    if (totalValue > 0) {
      summary += `Valor estimado: R$ ${(totalValue / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. `;
    }

    if (criticalCount > 0) {
      summary += `🔴 ${criticalCount} crítico(s). `;
    }
    if (highCount > 0) {
      summary += `🟠 ${highCount} alta prioridade.`;
    }

    return summary.trim();
  }

  /**
   * Envia notificação para itens prioritários.
   */
  private async notifyPriority(input: CommercialAgentInput, items: CommercialItem[]): Promise<void> {
    if (!this.notifier) return;

    const priorityItems = items.filter(i => 
      i.priority === 'critical' || i.priority === 'high'
    );

    const message = priorityItems.map(item => {
      const priorityEmoji = item.priority === 'critical' ? '🔴' : '🟠';
      const value = item.estimatedValue 
        ? `R$ ${(item.estimatedValue / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : 'Não informado';
      
      return `${priorityEmoji} **${item.title}**\n` +
        `Cliente: ${item.clientName} (${item.clientCompany || 'N/A'})\n` +
        `Tipo: ${this.getTypeLabel(item.type)}\n` +
        `Valor estimado: ${value}\n` +
        `Ação: ${item.suggestedAction || 'Analisar e responder'}`;
    }).join('\n\n');

    await this.notifier.notify(message, {
      title: `💼 Oportunidade Comercial - ${input.emailSubject}`,
      priority: items.some(i => i.priority === 'critical') ? 'urgent' : 'high',
    });
  }

  /**
   * Retorna label amigável para tipo de item.
   */
  private getTypeLabel(type: CommercialItem['type']): string {
    const labels: Record<CommercialItem['type'], string> = {
      quote_request: 'Pedido de Cotação',
      proposal: 'Proposta',
      negotiation: 'Negociação',
      order: 'Pedido',
      follow_up: 'Follow-up',
      complaint: 'Reclamação',
      renewal: 'Renovação',
      opportunity: 'Oportunidade',
      outro: 'Outro',
    };
    return labels[type] || type;
  }

  /**
   * Retorna quantidade de itens na fila.
   */
  getQueueSize(): number {
    return this.queue.length;
  }
}

