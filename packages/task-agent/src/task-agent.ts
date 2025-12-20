import { Agent, type AgentConfig, type AgentResult, Notifier } from '@agent-hub/core';
import type { ActionItem, TaskAgentConfig, TaskAnalysis } from './types.js';
import { TaskAgentConfigSchema } from './types.js';
import { TaskExtractor } from './task-extractor.js';

export interface TaskAgentInput {
  emailId: string;
  threadId?: string;
  emailSubject: string;
  emailBody: string;
  emailFrom: string;
  emailDate?: Date;
}

export interface TaskAgentResult {
  emailId: string;
  itemsFound: number;
  items: ActionItem[];
  summary: string;
  suggestedReply?: string;
  criticalItems: number;
  hasDeadlines: boolean;
}

/**
 * Task Agent - Agente especializado em extrair e gerenciar tarefas de emails.
 * 
 * Funcionalidades:
 * - Detecta emails com perguntas, pendências e action items
 * - Extrai cada item de forma estruturada
 * - Identifica stakeholders e projetos
 * - Calcula prioridades baseado em contexto
 * - Gera sugestões de resposta
 */
export class TaskAgent extends Agent<TaskAgentInput, TaskAgentResult> {
  private extractor: TaskExtractor;
  private taskConfig: TaskAgentConfig;
  private notifier?: Notifier;
  
  // Fila de emails para processar
  private queue: TaskAgentInput[] = [];

  constructor(
    agentConfig: AgentConfig,
    taskConfig?: Partial<TaskAgentConfig>,
    notifier?: Notifier
  ) {
    super(agentConfig);

    const validatedConfig = TaskAgentConfigSchema.parse(taskConfig || {});
    this.taskConfig = validatedConfig;
    this.extractor = new TaskExtractor(validatedConfig);
    this.notifier = notifier;
  }

  /**
   * Verifica se um email contém action items.
   */
  hasActionItems(subject: string, body: string): boolean {
    return this.extractor.hasActionItems(subject, body);
  }

  /**
   * Adiciona um email à fila para processamento.
   */
  addToQueue(input: TaskAgentInput): void {
    this.queue.push(input);
  }

  /**
   * Processa um email diretamente e extrai tarefas.
   * Método público para ser chamado pelo Email Agent.
   */
  async processEmail(input: TaskAgentInput): Promise<TaskAgentResult | null> {
    const { emailId, threadId, emailSubject, emailBody, emailFrom, emailDate } = input;

    try {
      console.log(`[TaskAgent] 📋 Processando email: ${emailSubject}`);

      // Verifica se tem action items antes de processar
      if (!this.hasActionItems(emailSubject, emailBody)) {
        console.log(`[TaskAgent] ⏭️ Email sem action items detectados`);
        return null;
      }

      // Extrai os action items
      const items = await this.extractor.extract(
        emailSubject,
        emailBody,
        emailId,
        emailFrom,
        threadId,
        emailDate
      );

      if (items.length === 0) {
        console.log(`[TaskAgent] ⏭️ Nenhum action item extraído pela IA`);
        return null;
      }

      console.log(`[TaskAgent] ✅ ${items.length} action item(s) extraído(s)`);

      // Gera sugestão de resposta se configurado
      let suggestedReply: string | undefined;
      if (this.taskConfig.generateSuggestedReply) {
        suggestedReply = await this.extractor.generateReply(
          emailSubject,
          emailBody,
          emailFrom,
          items
        );
      }

      // Conta itens críticos
      const criticalItems = items.filter(i => i.priority === 'critical').length;
      const hasDeadlines = items.some(i => i.deadline?.date || i.deadline?.relative);

      // Monta o resultado
      const result: TaskAgentResult = {
        emailId,
        itemsFound: items.length,
        items,
        summary: this.buildSummary(items),
        suggestedReply,
        criticalItems,
        hasDeadlines,
      };

      // Log detalhado dos itens
      items.forEach((item, i) => {
        const priorityIcon = {
          critical: '🔴',
          high: '🟠',
          medium: '🟡',
          low: '🟢',
        }[item.priority];
        console.log(`[TaskAgent]   ${i + 1}. ${priorityIcon} [${item.category}] ${item.title}`);
      });

      // Notifica se houver itens críticos
      if (criticalItems > 0) {
        const analysis: TaskAnalysis = {
          emailId,
          threadId,
          emailSubject,
          emailFrom,
          stakeholder: items[0].stakeholder,
          project: items[0].project,
          items,
          summary: result.summary,
          suggestedReply,
          totalItems: items.length,
          criticalItems,
          hasDeadlines,
          analyzedAt: new Date(),
        };
        await this.notifyUrgentTasks(analysis);
      }

      return result;

    } catch (error) {
      console.error('[TaskAgent] Erro ao processar email:', error);
      return null;
    }
  }

  /**
   * Execução agendada do agente (processa a fila).
   * Implementação obrigatória do método abstrato da classe base.
   */
  async execute(input?: TaskAgentInput): Promise<AgentResult<TaskAgentResult>> {
    const startTime = Date.now();
    
    // Se recebeu input, processa diretamente
    const toProcess = input || this.queue.shift();
    
    if (!toProcess) {
      return {
        success: true,
        timestamp: new Date(),
        duration: Date.now() - startTime,
        data: undefined,
      };
    }

    try {
      const result = await this.processEmail(toProcess);
      
      return {
        success: true,
        timestamp: new Date(),
        duration: Date.now() - startTime,
        data: result || undefined,
      };
    } catch (error) {
      return {
        success: false,
        timestamp: new Date(),
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  /**
   * Constrói um resumo dos itens extraídos.
   */
  private buildSummary(items: ActionItem[]): string {
    const stakeholder = items[0].stakeholder;
    const project = items[0].project;
    
    let summary = `${stakeholder.name}`;
    if (stakeholder.company) {
      summary += ` (${stakeholder.company})`;
    }
    
    summary += ` solicitou ${items.length} item(ns)`;
    
    if (project) {
      summary += ` sobre ${project.name}`;
    }

    const categories = [...new Set(items.map(i => i.category))];
    if (categories.length === 1) {
      const categoryLabels: Record<string, string> = {
        confirmation: 'de confirmação',
        status_update: 'de status',
        deadline: 'com prazo',
        document: 'sobre documentos',
        approval: 'de aprovação',
        action: 'de ação',
        question: '(perguntas)',
        information: 'de informação',
        followup: 'de acompanhamento',
      };
      summary += ` ${categoryLabels[categories[0]] || ''}`;
    }

    return summary.trim() + '.';
  }

  /**
   * Notifica sobre tarefas urgentes.
   */
  private async notifyUrgentTasks(analysis: TaskAnalysis): Promise<void> {
    if (!this.notifier) return;
    
    const criticalItems = analysis.items.filter(i => i.priority === 'critical');
    
    const itemsList = criticalItems
      .map(i => `• ${i.title}`)
      .join('\n');

    const message = `🚨 *${analysis.criticalItems} tarefa(s) crítica(s) detectada(s)*

📧 *Email:* ${analysis.emailSubject}
👤 *De:* ${analysis.stakeholder.name}${analysis.stakeholder.company ? ` (${analysis.stakeholder.company})` : ''}
${analysis.project ? `🏷️ *Projeto:* ${analysis.project.name}\n` : ''}
*Itens críticos:*
${itemsList}`;

    await this.notifier.notify(message, {
      title: `🚨 Tarefas Críticas - ${analysis.stakeholder.company || analysis.stakeholder.name}`,
      priority: 'urgent',
    });
  }

  /**
   * Atualiza a configuração do agente.
   */
  updateConfig(config: Partial<TaskAgentConfig>): void {
    const newConfig = TaskAgentConfigSchema.parse({
      ...this.taskConfig,
      ...config,
    });
    this.taskConfig = newConfig;
    this.extractor = new TaskExtractor(newConfig);
  }

  /**
   * Adiciona stakeholders VIP.
   */
  addVipStakeholders(stakeholders: string[]): void {
    this.taskConfig.vipStakeholders = [
      ...new Set([...this.taskConfig.vipStakeholders, ...stakeholders]),
    ];
    this.extractor = new TaskExtractor(this.taskConfig);
  }
}
