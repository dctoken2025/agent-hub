import { z } from 'zod';

// ===========================================
// Tipos para Classificação de Email
// ===========================================

export type EmailPriority = 'urgent' | 'attention' | 'informative' | 'low' | 'cc_only';

export type EmailAction = 
  | 'respond_now'      // Precisa responder imediatamente
  | 'respond_later'    // Pode responder depois
  | 'read_only'        // Só precisa ler
  | 'mark_read'        // Pode marcar como lido sem ler
  | 'archive'          // Pode arquivar
  | 'delegate';        // Delegar para outra pessoa

export interface EmailClassification {
  priority: EmailPriority;
  action: EmailAction;
  confidence: number; // 0-100
  reasoning: string;
  suggestedResponse?: string;
  tags: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  isDirectedToMe: boolean;
  requiresAction: boolean;
  deadline?: string;
}

export interface Email {
  id: string;
  threadId: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  subject: string;
  snippet: string;
  body: string;
  bodyHtml?: string;
  date: Date;
  labels: string[];
  isUnread: boolean;
  hasAttachments: boolean;
  attachments?: EmailAttachment[];
}

export interface EmailAddress {
  name?: string;
  email: string;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface ClassifiedEmail extends Email {
  classification: EmailClassification;
  classifiedAt: Date;
}

// ===========================================
// Configuração do Email Agent
// ===========================================

export interface EmailAgentConfig {
  // Email do usuário para identificar se é destinatário direto
  userEmail: string;
  
  // Lista de remetentes VIP (sempre prioridade alta)
  vipSenders: string[];
  
  // Lista de remetentes para ignorar (sempre baixa prioridade)
  ignoreSenders: string[];
  
  // Labels do Gmail para processar (default: INBOX)
  labelsToProcess: string[];
  
  // Número máximo de emails para processar por execução
  maxEmailsPerRun: number;
  
  // Data base para começar a buscar emails (ISO string ou Date)
  // Se não definida, busca desde sempre
  startDate?: string | Date;
  
  // Última data/hora que o agente processou (ISO string ou Date)
  // Usado para buscar apenas emails novos a partir desta data
  lastProcessedAt?: string | Date;
  
  // Processar apenas não lidos
  unreadOnly: boolean;
}

export const EmailAgentConfigSchema = z.object({
  userEmail: z.string().email(),
  vipSenders: z.array(z.string()),
  ignoreSenders: z.array(z.string()),
  labelsToProcess: z.array(z.string()).default(['INBOX']),
  maxEmailsPerRun: z.number().default(50),
  unreadOnly: z.boolean().default(true),
});

// ===========================================
// Schema para Tool Use do Claude
// ===========================================

export const EmailClassificationSchema = {
  name: 'classify_email',
  description: 'Classifica um email quanto à prioridade, ação necessária e análise de sentimento',
  input_schema: {
    type: 'object' as const,
    properties: {
      priority: {
        type: 'string',
        enum: ['urgent', 'attention', 'informative', 'low', 'cc_only'],
        description: 'Nível de prioridade do email',
      },
      action: {
        type: 'string',
        enum: ['respond_now', 'respond_later', 'read_only', 'mark_read', 'archive', 'delegate'],
        description: 'Ação recomendada para o email',
      },
      confidence: {
        type: 'number',
        description: 'Confiança na classificação (0-100)',
      },
      reasoning: {
        type: 'string',
        description: 'Explicação breve do motivo da classificação',
      },
      suggestedResponse: {
        type: 'string',
        description: 'Sugestão de resposta se aplicável',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags relevantes (ex: financeiro, projeto-x, reunião)',
      },
      sentiment: {
        type: 'string',
        enum: ['positive', 'neutral', 'negative', 'urgent'],
        description: 'Tom/sentimento do email',
      },
      isDirectedToMe: {
        type: 'boolean',
        description: 'Se o email é direcionado diretamente ao usuário (não apenas CC)',
      },
      requiresAction: {
        type: 'boolean',
        description: 'Se o email requer alguma ação do usuário',
      },
      deadline: {
        type: 'string',
        description: 'Prazo mencionado no email, se houver (formato: YYYY-MM-DD)',
      },
    },
    required: ['priority', 'action', 'confidence', 'reasoning', 'tags', 'sentiment', 'isDirectedToMe', 'requiresAction'],
  },
};
