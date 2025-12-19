import { getAIClient, type AITool } from '@agent-hub/core';
import type { Email, EmailClassification, EmailAgentConfig } from './types.js';
import { EmailClassificationSchema } from './types.js';

/**
 * Classificador de emails usando Claude AI.
 * Analisa conteúdo, tom e contexto para determinar prioridade.
 */
export class EmailClassifier {
  private config: EmailAgentConfig;

  constructor(config: EmailAgentConfig) {
    this.config = config;
  }

  /**
   * Classifica um email usando IA.
   */
  async classify(email: Email): Promise<EmailClassification> {
    // Verificações rápidas antes de usar IA
    const quickCheck = this.quickClassify(email);
    if (quickCheck) {
      return quickCheck;
    }

    // Usa Claude para classificação detalhada
    const aiClient = getAIClient();
    
    const emailContext = this.buildEmailContext(email);
    const systemPrompt = this.buildSystemPrompt();

    const result = await aiClient.analyze<EmailClassification>(
      emailContext,
      'Analise este email e classifique-o conforme as instruções.',
      EmailClassificationSchema as AITool
    );

    if (result) {
      return result;
    }

    // Fallback se IA falhar
    return this.defaultClassification(email);
  }

  /**
   * Classificação rápida sem IA para casos óbvios.
   */
  private quickClassify(email: Email): EmailClassification | null {
    const fromEmail = email.from.email.toLowerCase();

    // Remetente VIP = sempre alta prioridade
    if (this.config.vipSenders.some(vip => fromEmail.includes(vip.toLowerCase()))) {
      return {
        priority: 'urgent',
        action: 'respond_now',
        confidence: 95,
        reasoning: 'Remetente VIP configurado',
        tags: ['vip'],
        sentiment: 'neutral',
        isDirectedToMe: true,
        requiresAction: true,
      };
    }

    // Remetente ignorado = baixa prioridade
    if (this.config.ignoreSenders.some(ignore => fromEmail.includes(ignore.toLowerCase()))) {
      return {
        priority: 'low',
        action: 'mark_read',
        confidence: 95,
        reasoning: 'Remetente na lista de ignorados',
        tags: ['ignored'],
        sentiment: 'neutral',
        isDirectedToMe: false,
        requiresAction: false,
      };
    }

    // Usuário está apenas em CC = provavelmente só informativo
    const isInCC = email.cc?.some(cc => 
      cc.email.toLowerCase() === this.config.userEmail.toLowerCase()
    );
    const isInTo = email.to.some(to => 
      to.email.toLowerCase() === this.config.userEmail.toLowerCase()
    );

    if (isInCC && !isInTo) {
      return {
        priority: 'cc_only',
        action: 'read_only',
        confidence: 80,
        reasoning: 'Usuário está apenas em cópia (CC)',
        tags: ['cc'],
        sentiment: 'neutral',
        isDirectedToMe: false,
        requiresAction: false,
      };
    }

    // Newsletters e marketing
    if (this.isNewsletter(email)) {
      return {
        priority: 'low',
        action: 'mark_read',
        confidence: 85,
        reasoning: 'Email identificado como newsletter/marketing',
        tags: ['newsletter'],
        sentiment: 'neutral',
        isDirectedToMe: false,
        requiresAction: false,
      };
    }

    return null;
  }

  /**
   * Verifica se é newsletter/marketing.
   */
  private isNewsletter(email: Email): boolean {
    const indicators = [
      'unsubscribe',
      'newsletter',
      'marketing',
      'noreply',
      'no-reply',
      'mailer-daemon',
      'descadastrar',
      'cancelar inscrição',
    ];

    const content = `${email.subject} ${email.body} ${email.from.email}`.toLowerCase();
    return indicators.some(indicator => content.includes(indicator));
  }

  /**
   * Monta contexto do email para análise da IA.
   */
  private buildEmailContext(email: Email): string {
    const ccList = email.cc?.map(c => c.email).join(', ') || 'Nenhum';
    
    return `
=== INFORMAÇÕES DO EMAIL ===
De: ${email.from.name || ''} <${email.from.email}>
Para: ${email.to.map(t => t.email).join(', ')}
CC: ${ccList}
Assunto: ${email.subject}
Data: ${email.date.toISOString()}
Tem anexos: ${email.hasAttachments ? 'Sim' : 'Não'}

=== CORPO DO EMAIL ===
${email.body.substring(0, 3000)}${email.body.length > 3000 ? '\n[...truncado...]' : ''}

=== CONTEXTO ===
- Meu email: ${this.config.userEmail}
- Estou no "Para": ${email.to.some(t => t.email.toLowerCase() === this.config.userEmail.toLowerCase())}
- Estou no "CC": ${email.cc?.some(c => c.email.toLowerCase() === this.config.userEmail.toLowerCase()) || false}
    `.trim();
  }

  /**
   * System prompt para a IA.
   */
  private buildSystemPrompt(): string {
    return `Você é um assistente especializado em triagem de emails corporativos.
Sua tarefa é analisar emails e classificá-los para ajudar o usuário a priorizar sua caixa de entrada.

REGRAS DE CLASSIFICAÇÃO:

1. PRIORIDADE:
   - urgent: Requer resposta imediata, deadline apertado, problema crítico
   - attention: Importante mas não urgente, merece leitura atenta
   - informative: Informações úteis, updates de projetos
   - low: Newsletters, marketing, FYIs gerais
   - cc_only: Usuário está apenas em cópia

2. AÇÃO RECOMENDADA:
   - respond_now: Responder imediatamente
   - respond_later: Pode responder em até 24h
   - read_only: Apenas ler, não precisa responder
   - mark_read: Pode marcar como lido sem ler
   - archive: Pode arquivar diretamente
   - delegate: Sugerir delegação para outra pessoa

3. ANÁLISE DE SENTIMENTO:
   - Detecte frustração, urgência ou tom negativo
   - Identifique cobranças ou pressão implícita
   - Note quando há elogios ou feedback positivo

4. TAGS:
   - Use tags relevantes como: financeiro, projeto, reunião, cobrança, suporte, etc.

Seja conciso na explicação. Foque em ser útil e economizar o tempo do usuário.`;
  }

  /**
   * Classificação padrão quando IA falha.
   */
  private defaultClassification(email: Email): EmailClassification {
    const isDirectedToMe = email.to.some(
      t => t.email.toLowerCase() === this.config.userEmail.toLowerCase()
    );

    return {
      priority: isDirectedToMe ? 'attention' : 'informative',
      action: isDirectedToMe ? 'respond_later' : 'read_only',
      confidence: 50,
      reasoning: 'Classificação padrão (IA indisponível)',
      tags: [],
      sentiment: 'neutral',
      isDirectedToMe,
      requiresAction: isDirectedToMe,
    };
  }
}
