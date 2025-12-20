import { getAIClient, type AITool } from '@agent-hub/core';
import type { 
  ActionItem, 
  TaskAgentConfig, 
  Stakeholder, 
  Project,
  TaskDeadline,
  TaskPriority,
  TaskCategory,
} from './types.js';
import { TaskExtractionSchema } from './types.js';

interface ExtractionResult {
  stakeholder: {
    name: string;
    company?: string;
    role?: string;
    phone?: string;
    importance: 'vip' | 'high' | 'normal';
  };
  project?: {
    name: string;
    code?: string;
    type?: string;
  };
  items: Array<{
    title: string;
    description: string;
    originalText: string;
    category: TaskCategory;
    deadline?: {
      date?: string;
      relative?: string;
      isExplicit: boolean;
      dependsOn?: string;
      urgencyLevel?: 'immediate' | 'soon' | 'normal' | 'flexible';
    };
    priority: TaskPriority;
    priorityReason: string;
    suggestedResponse?: string;
    suggestedAction?: string;
    relatedDocuments?: string[];
    blockedByExternal?: string;
    confidence: number;
  }>;
  summary: string;
  suggestedReply?: string;
}

/**
 * Extrator de tarefas e action items de emails.
 * Usa Claude AI para identificar perguntas, pendências e itens de ação.
 */
export class TaskExtractor {
  private config: TaskAgentConfig;

  constructor(config: TaskAgentConfig) {
    this.config = config;
  }

  /**
   * Verifica se um email parece conter tarefas ou perguntas.
   */
  hasActionItems(subject: string, body: string): boolean {
    const content = `${subject} ${body}`.toLowerCase();
    
    // Verifica palavras-chave de tarefas
    const hasKeywords = this.config.taskKeywords.some(keyword => 
      content.includes(keyword.toLowerCase())
    );
    
    // Verifica se tem pontos de interrogação (perguntas)
    const hasQuestions = (content.match(/\?/g) || []).length >= 1;
    
    // Verifica se tem listas (bullets ou números)
    const hasBullets = /[•\-\*]\s+\w|^\d+[\.\)]\s+/m.test(body);
    
    return hasKeywords || hasQuestions || hasBullets;
  }

  /**
   * Verifica se o remetente é um stakeholder VIP.
   */
  isVipStakeholder(email: string): boolean {
    const emailLower = email.toLowerCase();
    return this.config.vipStakeholders.some(vip => 
      emailLower.includes(vip.toLowerCase())
    );
  }

  /**
   * Extrai action items de um email usando IA.
   */
  async extract(
    emailSubject: string,
    emailBody: string,
    emailId: string,
    emailFrom: string,
    threadId?: string,
    emailDate?: Date
  ): Promise<ActionItem[]> {
    const aiClient = getAIClient();

    const context = this.buildContext(emailSubject, emailBody, emailFrom);
    const systemPrompt = this.buildSystemPrompt();

    const result = await aiClient.analyze<ExtractionResult>(
      context,
      systemPrompt,
      TaskExtractionSchema as AITool
    );

    if (!result || !result.items || result.items.length === 0) {
      return [];
    }

    // Monta o stakeholder com informações do email
    const stakeholder: Stakeholder = {
      name: result.stakeholder.name,
      company: result.stakeholder.company,
      role: result.stakeholder.role,
      email: emailFrom,
      phone: result.stakeholder.phone,
      importance: this.isVipStakeholder(emailFrom) ? 'vip' : result.stakeholder.importance,
    };

    // Monta o projeto se detectado
    const project: Project | undefined = result.project ? {
      name: result.project.name,
      code: result.project.code,
      type: result.project.type,
    } : undefined;

    // Converte os itens para ActionItem
    return result.items.map((item) => {
      const deadline: TaskDeadline | undefined = item.deadline ? {
        date: item.deadline.date,
        relative: item.deadline.relative,
        isExplicit: item.deadline.isExplicit,
        dependsOn: item.deadline.dependsOn,
        urgencyLevel: item.deadline.urgencyLevel,
      } : undefined;

      // Recalcula prioridade considerando stakeholder VIP
      const finalPriority = this.calculateFinalPriority(
        item.priority,
        stakeholder.importance,
        deadline
      );

      const actionItem: ActionItem = {
        emailId,
        threadId,
        emailSubject,
        emailFrom,
        emailDate,
        
        stakeholder,
        project,
        
        title: item.title,
        description: item.description,
        originalText: item.originalText,
        category: item.category,
        
        deadline,
        
        status: 'pending',
        
        priority: finalPriority,
        priorityReason: this.buildPriorityReason(finalPriority, stakeholder, deadline),
        
        confidence: item.confidence,
        
        suggestedResponse: item.suggestedResponse,
        suggestedAction: item.suggestedAction,
        relatedDocuments: item.relatedDocuments,
        blockedByExternal: item.blockedByExternal,
      };

      return actionItem;
    });
  }

  /**
   * Gera uma sugestão de resposta completa para o email.
   */
  async generateReply(
    emailSubject: string,
    _emailBody: string,
    emailFrom: string,
    items: ActionItem[]
  ): Promise<string | undefined> {
    if (!this.config.generateSuggestedReply || items.length === 0) {
      return undefined;
    }

    const aiClient = getAIClient();
    
    const itemsList = items.map((item, i) => 
      `${i + 1}. [${item.category.toUpperCase()}] ${item.title}\n   Original: "${item.originalText}"\n   Status: Pendente`
    ).join('\n\n');

    const systemPrompt = `Você é um assistente que gera respostas profissionais para emails corporativos.
Gere APENAS o texto da resposta, sem explicações adicionais.
Use marcadores de status: ✅ (concluído), 🔄 (em andamento), ⏳ (aguardando), ❓ (a verificar)`;

    const userMessage = `Gere uma resposta profissional para este email:

ASSUNTO: ${emailSubject}
DE: ${emailFrom}

ITENS IDENTIFICADOS:
${itemsList}

A resposta deve:
1. Usar saudação apropriada
2. Responder cada item de forma organizada
3. Ser profissional mas cordial
4. Ter encerramento adequado`;

    try {
      const response = await aiClient.chat(
        [{ role: 'user', content: userMessage }],
        systemPrompt
      );
      return response.content;
    } catch (error) {
      console.error('[TaskExtractor] Erro ao gerar resposta:', error);
      return undefined;
    }
  }

  /**
   * Constrói o contexto para análise.
   */
  private buildContext(subject: string, body: string, from: string): string {
    return `
=== EMAIL PARA ANÁLISE ===

DE: ${from}
ASSUNTO: ${subject}

CORPO DO EMAIL:
${body}

=== FIM DO EMAIL ===
`.trim();
  }

  /**
   * Constrói o prompt de sistema para extração de tarefas.
   */
  private buildSystemPrompt(): string {
    let prompt = `Você é um assistente especializado em extrair tarefas, pendências e action items de emails corporativos.

Seu objetivo é identificar TUDO que precisa de resposta ou ação no email, incluindo:
- Perguntas diretas (mesmo retóricas que esperam confirmação)
- Pedidos de status ou atualização
- Itens com prazos
- Pendências de documentos
- Solicitações de aprovação
- Qualquer item que espera uma resposta ou ação

REGRAS DE EXTRAÇÃO:
1. SEJA EXAUSTIVO - extraia TODOS os itens, mesmo os implícitos
2. Para cada pergunta ou ponto com "?" ou pedido de confirmação, crie um item separado
3. Se um item tem sub-itens, crie entradas separadas para cada um
4. Identifique o stakeholder pela assinatura do email
5. Detecte o projeto/operação pelo assunto ou contexto
6. Preste atenção em prazos relativos ("semana que vem", "15 dias após X")

PRIORIZAÇÃO:
- critical: Prazo imediato (hoje/amanhã) + stakeholder importante, ou item bloqueante
- high: Prazo esta semana OU stakeholder VIP OU confirmação explícita solicitada
- medium: Tarefa normal sem urgência especial
- low: Informativo, FYI, sem prazo definido

STAKEHOLDERS VIP (sempre high ou critical):
- Grandes bancos: Itaú, Bradesco, Santander, BTG, XP, Safra
- Reguladores: CVM, B3, ANBIMA, Bacen
- Clientes/investidores principais

FORMATO DO TÍTULO:
- Máximo 80 caracteres
- Comece com verbo quando possível (Confirmar, Verificar, Enviar, Providenciar)
- Seja específico (não use "Item 1", "Pendência")

Exemplo bom: "Confirmar status da assinatura com Vortx"
Exemplo ruim: "Item sobre Vortx"`;

    if (this.config.customContext) {
      prompt += `\n\nCONTEXTO ADICIONAL DO USUÁRIO:\n${this.config.customContext}`;
    }

    return prompt;
  }

  /**
   * Calcula a prioridade final considerando todos os fatores.
   */
  private calculateFinalPriority(
    aiPriority: TaskPriority,
    stakeholderImportance: 'vip' | 'high' | 'normal',
    deadline?: TaskDeadline
  ): TaskPriority {
    let score = 0;

    // Pontuação base da prioridade da IA
    switch (aiPriority) {
      case 'critical': score += 40; break;
      case 'high': score += 30; break;
      case 'medium': score += 20; break;
      case 'low': score += 10; break;
    }

    // Stakeholder VIP adiciona pontos
    if (stakeholderImportance === 'vip') score += 25;
    else if (stakeholderImportance === 'high') score += 15;

    // Urgência do deadline
    if (deadline?.urgencyLevel === 'immediate') score += 30;
    else if (deadline?.urgencyLevel === 'soon') score += 20;
    else if (deadline?.isExplicit) score += 10;

    // Converte score para prioridade
    if (score >= 60) return 'critical';
    if (score >= 45) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }

  /**
   * Constrói a razão da prioridade para exibição.
   */
  private buildPriorityReason(
    priority: TaskPriority,
    stakeholder: Stakeholder,
    deadline?: TaskDeadline
  ): string {
    const reasons: string[] = [];

    if (stakeholder.importance === 'vip') {
      reasons.push(`Stakeholder VIP (${stakeholder.company || stakeholder.name})`);
    } else if (stakeholder.importance === 'high') {
      reasons.push('Stakeholder importante');
    }

    if (deadline?.urgencyLevel === 'immediate') {
      reasons.push('Prazo imediato');
    } else if (deadline?.urgencyLevel === 'soon') {
      reasons.push('Prazo próximo');
    } else if (deadline?.date) {
      reasons.push(`Prazo: ${deadline.date}`);
    } else if (deadline?.relative) {
      reasons.push(`Prazo: ${deadline.relative}`);
    }

    if (reasons.length === 0) {
      switch (priority) {
        case 'critical': reasons.push('Item crítico'); break;
        case 'high': reasons.push('Alta prioridade'); break;
        case 'medium': reasons.push('Prioridade normal'); break;
        case 'low': reasons.push('Baixa prioridade'); break;
      }
    }

    return reasons.join(' + ');
  }
}
