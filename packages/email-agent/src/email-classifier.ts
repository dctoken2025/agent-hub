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

    const result = await aiClient.analyze<EmailClassification>(
      emailContext,
      this.buildSystemPrompt() + '\n\nAnalise este email e classifique-o conforme as instruções.',
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
    const subject = email.subject.toLowerCase();
    const body = email.body.toLowerCase();
    const content = `${subject} ${body} ${fromEmail}`;

    // ===========================================
    // PRIORIDADE MÁXIMA: Documentos para assinar
    // ===========================================
    const signaturePortals = [
      'docusign', 'clicksign', 'd4sign', 'autentique', 'zapsign',
      'adobe sign', 'hellosign', 'pandadoc', 'signaturit', 'certisign',
      'valid certificadora', 'assinatura digital', 'assinatura eletrônica',
      'documento para assinar', 'aguardando sua assinatura',
      'pending signature', 'sign document', 'please sign',
      'assine o documento', 'assinar contrato', 'assinatura pendente'
    ];

    if (signaturePortals.some(portal => content.includes(portal))) {
      return {
        priority: 'urgent',
        action: 'respond_now',
        confidence: 98,
        reasoning: 'Documento aguardando assinatura - requer ação imediata',
        tags: ['assinatura', 'documento', 'contrato'],
        sentiment: 'urgent',
        isDirectedToMe: true,
        requiresAction: true,
        deadline: 'hoje',
      };
    }

    // ===========================================
    // Remetente VIP = sempre alta prioridade
    // ===========================================
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

    // ===========================================
    // Remetente ignorado = baixa prioridade
    // ===========================================
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

    // ===========================================
    // Usuário está apenas em CC
    // ===========================================
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

    // ===========================================
    // Newsletters e marketing
    // ===========================================
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
    const fromEmail = email.from.email.toLowerCase();
    const subject = email.subject.toLowerCase();
    const body = email.body.toLowerCase();
    const content = `${subject} ${body} ${fromEmail}`;

    // Indicadores de newsletter/marketing
    const indicators = [
      'unsubscribe', 'newsletter', 'marketing', 'noreply', 'no-reply',
      'mailer-daemon', 'descadastrar', 'cancelar inscrição', 'email automático',
      'não responda', 'bulk mail', 'promotional', 'promo', 'ofertas',
      'off today', '% off', 'sale ends', 'limited time', 'act now',
      'click here', 'view in browser', 'update preferences',
    ];

    // Domínios conhecidos de marketing/notificações automáticas
    const autoSenders = [
      'amazonses.com', 'sendgrid.net', 'mailchimp', 'mailgun',
      'constantcontact', 'hubspot', 'salesforce', 'marketo',
      'notifications@', 'notify@', 'alerts@', 'updates@',
      'news@', 'info@', 'promo@', 'marketing@', 'newsletter@',
      'noreply@', 'no-reply@', 'donotreply@', 'mailer@',
      // Notificações de apps/serviços
      'github.com', 'gitlab.com', 'bitbucket.org', 'jira', 'atlassian',
      'slack.com', 'notion.so', 'figma.com', 'linear.app',
      'trello.com', 'asana.com', 'monday.com', 'clickup.com',
      'zoom.us', 'calendly.com', 'meetup.com',
      // Transações/Recibos
      'paypal', 'stripe', 'mercadopago', 'pagseguro', 'iugu',
      'uber.com', '99app', 'ifood', 'rappi',
      // Redes sociais
      'linkedin.com', 'twitter.com', 'facebook.com', 'instagram.com',
      'facebookmail.com', 'pinterest.com', 'tiktok.com',
      // E-commerce
      'amazon.com', 'mercadolivre', 'shopee', 'aliexpress', 'magazineluiza',
      'americanas', 'submarino', 'casasbahia', 'extra.com',
    ];

    if (autoSenders.some(sender => fromEmail.includes(sender))) {
      return true;
    }

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
${email.body.substring(0, 4000)}${email.body.length > 4000 ? '\n[...truncado...]' : ''}

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
    return `Você é um assistente executivo especializado em triagem de emails corporativos para um profissional do mercado financeiro/fintech.

Seu objetivo é analisar cada email e classificá-lo para ajudar o usuário a priorizar sua caixa de entrada de forma eficiente.

═══════════════════════════════════════════════════════════════
REGRAS DE PRIORIDADE MÁXIMA (sempre "urgent")
═══════════════════════════════════════════════════════════════

1. DOCUMENTOS PARA ASSINAR
   - Emails de portais de assinatura (DocuSign, ClickSign, D4Sign, Autentique, ZapSign, etc.)
   - Contratos aguardando assinatura
   - Procurações, termos, acordos pendentes
   - Qualquer documento que mencione "assinar", "assinatura pendente", "aguardando assinatura"

2. QUESTÕES FINANCEIRAS URGENTES
   - Problemas com pagamentos
   - Transferências bancárias pendentes de aprovação
   - Questões de compliance com prazo
   - Auditoria ou regulatório

3. CLIENTES/PARCEIROS IMPORTANTES
   - Reclamações de clientes
   - Questões de suporte crítico
   - Parceiros estratégicos com problemas

4. PRAZOS CRÍTICOS
   - Deadlines mencionados para hoje ou amanhã
   - "Urgente", "ASAP", "imediato" no assunto ou corpo
   - Cobranças explícitas

═══════════════════════════════════════════════════════════════
NÍVEIS DE PRIORIDADE
═══════════════════════════════════════════════════════════════

🔴 urgent (Urgente)
   - Requer resposta/ação IMEDIATA (hoje)
   - Documentos para assinar
   - Problemas críticos
   - Deadline iminente

🟠 attention (Atenção)
   - Importante mas pode esperar algumas horas
   - Requer leitura atenta
   - Decisões a tomar
   - Reuniões importantes

🟡 informative (Informativo)
   - Atualizações de projetos
   - Informações úteis para contexto
   - Relatórios e status
   - Pode ler quando tiver tempo

🟢 low (Baixa)
   - Newsletters
   - Marketing/promoções
   - FYIs gerais
   - Pode marcar como lido

📎 cc_only (Apenas Cópia)
   - Usuário está em CC
   - Geralmente só para conhecimento
   - Raramente requer ação

═══════════════════════════════════════════════════════════════
AÇÕES RECOMENDADAS
═══════════════════════════════════════════════════════════════

- respond_now: Responder imediatamente (minutos)
- respond_later: Responder em até 24h
- read_only: Apenas ler, sem necessidade de resposta
- mark_read: Pode marcar como lido sem ler detalhadamente
- archive: Pode arquivar diretamente
- delegate: Sugerir delegação para equipe

═══════════════════════════════════════════════════════════════
ANÁLISE DE SENTIMENTO E TOM
═══════════════════════════════════════════════════════════════

Detecte e reporte:
- Frustração ou insatisfação do remetente
- Cobranças implícitas ou explícitas
- Tom passivo-agressivo
- Urgência real vs. urgência artificial
- Elogios ou feedback positivo

Sentimentos possíveis:
- positive: Email positivo, elogio, agradecimento
- neutral: Tom normal, profissional
- negative: Reclamação, frustração, problema
- urgent: Urgência genuína detectada

═══════════════════════════════════════════════════════════════
TAGS SUGERIDAS
═══════════════════════════════════════════════════════════════

Use tags relevantes como:
- assinatura, contrato, documento
- financeiro, pagamento, cobrança
- reunião, agenda, calendar
- projeto, desenvolvimento, produto
- cliente, parceiro, fornecedor
- compliance, regulatório, jurídico
- suporte, bug, problema
- rh, administrativo, interno

═══════════════════════════════════════════════════════════════
INSTRUÇÕES FINAIS
═══════════════════════════════════════════════════════════════

1. Seja CONSERVADOR ao classificar como "low" - na dúvida, suba a prioridade
2. Qualquer menção a assinatura de documento = SEMPRE urgent
3. Se detectar deadline, mencione na explicação
4. Seja conciso no reasoning (1-2 frases)
5. Sugira resposta apenas se for óbvio o que responder

Lembre-se: Seu objetivo é ECONOMIZAR TEMPO do usuário, priorizando o que realmente importa.`;
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
