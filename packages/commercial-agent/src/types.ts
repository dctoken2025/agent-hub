import { z } from 'zod';

// ===========================================
// Tipos para Análise Comercial
// ===========================================

export type CommercialItemType = 
  | 'quote_request'      // Pedido de cotação
  | 'proposal'           // Proposta comercial
  | 'negotiation'        // Negociação em andamento
  | 'order'              // Pedido confirmado
  | 'follow_up'          // Follow-up de cliente
  | 'complaint'          // Reclamação comercial
  | 'renewal'            // Renovação de contrato/serviço
  | 'opportunity'        // Oportunidade de venda
  | 'outro';

export type CommercialItemStatus = 
  | 'new'                // Novo, não tratado
  | 'in_progress'        // Em tratamento
  | 'quoted'             // Cotação enviada
  | 'negotiating'        // Em negociação
  | 'won'                // Ganho/fechado
  | 'lost'               // Perdido
  | 'cancelled'          // Cancelado
  | 'on_hold';           // Pausado/aguardando

export type CommercialPriority = 'critical' | 'high' | 'normal' | 'low';

export type ClientType = 
  | 'prospect'           // Prospect/lead
  | 'new_client'         // Cliente novo
  | 'existing_client'    // Cliente existente
  | 'strategic_client'   // Cliente estratégico
  | 'partner'            // Parceiro
  | 'distributor'        // Distribuidor
  | 'other';

// ===========================================
// Item Comercial
// ===========================================

export interface CommercialItem {
  // Identificação
  emailId: string;
  threadId?: string;
  
  // Contexto do email original
  emailSubject?: string;
  emailFrom?: string;
  emailDate?: Date;
  
  // Tipo e status
  type: CommercialItemType;
  status: CommercialItemStatus;
  
  // Cliente/Contato
  clientName: string;
  clientCompany?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientType: ClientType;
  
  // Detalhes da oportunidade
  title: string;                    // Título resumido
  description: string;              // Descrição completa
  productsServices?: string[];      // Produtos/serviços solicitados
  estimatedValue?: number;          // Valor estimado em centavos
  currency?: string;                // Moeda (BRL, USD, etc.)
  quantity?: string;                // Quantidade solicitada
  
  // Prazos
  deadlineDate?: string;            // Data limite para resposta
  desiredDeliveryDate?: string;     // Data desejada de entrega
  
  // Competição
  hasCompetitors?: boolean;         // Menciona concorrentes
  competitorNames?: string[];       // Nomes de concorrentes mencionados
  isUrgentBid?: boolean;            // Licitação/concorrência urgente
  
  // Priorização
  priority: CommercialPriority;
  priorityReason?: string;
  
  // Próximas ações
  suggestedAction?: string;
  suggestedResponse?: string;
  
  // Metadata
  confidence: number;               // 0-100
  analyzedAt: Date;
  tags?: string[];
}

// ===========================================
// Config do Agente Comercial
// ===========================================

export interface CommercialAgentConfig {
  // Palavras-chave que identificam emails comerciais
  commercialKeywords: string[];
  
  // Clientes VIP (sempre prioridade alta)
  vipClients: string[];
  
  // Produtos/serviços da empresa (para matching)
  productsServices: string[];
  
  // Threshold de valor para prioridade alta (em centavos)
  highValueThreshold: number;
  
  // Dias para considerar urgente
  urgentDaysBeforeDeadline: number;
  
  // Contexto personalizado para a IA
  customContext?: string;
}

export const CommercialAgentConfigSchema = z.object({
  commercialKeywords: z.array(z.string()).default([
    // Cotações e orçamentos
    'cotação', 'orçamento', 'quote', 'quotation', 'proposta comercial',
    'pedido de preço', 'solicitação de preço', 'price request',
    'quanto custa', 'qual o valor', 'preço de',
    // Vendas e pedidos
    'pedido', 'order', 'compra', 'purchase', 'aquisição',
    'gostaria de comprar', 'interesse em adquirir', 'preciso de',
    'queremos contratar', 'interesse em contratar',
    // Negociação
    'negociação', 'condições comerciais', 'desconto', 'prazo de pagamento',
    'parcelamento', 'forma de pagamento', 'condições especiais',
    // Licitação
    'licitação', 'pregão', 'tomada de preços', 'concorrência',
    'edital', 'certame', 'processo licitatório',
    // Renovação
    'renovação', 'renewal', 'prorrogação', 'extensão de contrato',
    // Reclamação comercial
    'reclamação', 'insatisfação', 'problema com pedido', 'atraso na entrega',
    // Oportunidade
    'parceria', 'distribuição', 'representação', 'revenda',
  ]),
  vipClients: z.array(z.string()).default([]),
  productsServices: z.array(z.string()).default([]),
  highValueThreshold: z.number().default(10000000), // R$ 100.000 em centavos
  urgentDaysBeforeDeadline: z.number().default(2),
});

// ===========================================
// Schema para Tool Use do Claude
// ===========================================

export const CommercialAnalysisSchema = {
  name: 'analyze_commercial_email',
  description: 'Analisa um email comercial (cotação, proposta, negociação) e extrai informações estruturadas',
  input_schema: {
    type: 'object' as const,
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['quote_request', 'proposal', 'negotiation', 'order', 'follow_up', 'complaint', 'renewal', 'opportunity', 'outro'],
              description: 'Tipo do item comercial',
            },
            clientName: {
              type: 'string',
              description: 'Nome da pessoa que está entrando em contato',
            },
            clientCompany: {
              type: 'string',
              description: 'Empresa do cliente, se identificada',
            },
            clientEmail: {
              type: 'string',
              description: 'Email do cliente',
            },
            clientPhone: {
              type: 'string',
              description: 'Telefone do cliente, se mencionado',
            },
            clientType: {
              type: 'string',
              enum: ['prospect', 'new_client', 'existing_client', 'strategic_client', 'partner', 'distributor', 'other'],
              description: 'Tipo de cliente baseado no contexto',
            },
            title: {
              type: 'string',
              description: 'Título resumido da solicitação (max 100 chars)',
            },
            description: {
              type: 'string',
              description: 'Descrição completa da solicitação/oportunidade',
            },
            productsServices: {
              type: 'array',
              items: { type: 'string' },
              description: 'Lista de produtos ou serviços mencionados',
            },
            estimatedValue: {
              type: 'number',
              description: 'Valor estimado em centavos (se mencionado ou estimável)',
            },
            currency: {
              type: 'string',
              description: 'Moeda do valor (BRL, USD, EUR, etc.)',
            },
            quantity: {
              type: 'string',
              description: 'Quantidade solicitada (formato livre: "100 unidades", "projeto de 6 meses", etc.)',
            },
            deadlineDate: {
              type: 'string',
              description: 'Data limite para resposta no formato ISO (YYYY-MM-DD)',
            },
            desiredDeliveryDate: {
              type: 'string',
              description: 'Data desejada de entrega no formato ISO (YYYY-MM-DD)',
            },
            hasCompetitors: {
              type: 'boolean',
              description: 'Se o email menciona que estão consultando concorrentes',
            },
            competitorNames: {
              type: 'array',
              items: { type: 'string' },
              description: 'Nomes de concorrentes mencionados',
            },
            isUrgentBid: {
              type: 'boolean',
              description: 'Se é uma licitação ou concorrência com prazo apertado',
            },
            priority: {
              type: 'string',
              enum: ['critical', 'high', 'normal', 'low'],
              description: 'Prioridade baseada em urgência, valor e tipo de cliente',
            },
            priorityReason: {
              type: 'string',
              description: 'Justificativa da prioridade atribuída',
            },
            suggestedAction: {
              type: 'string',
              description: 'Ação sugerida (ex: "Responder em 24h", "Agendar reunião", "Preparar proposta")',
            },
            suggestedResponse: {
              type: 'string',
              description: 'Sugestão de resposta inicial (opcional)',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags relevantes (ex: licitação, urgente, grande_valor, novo_cliente)',
            },
            confidence: {
              type: 'number',
              description: 'Confiança na extração dos dados (0-100)',
            },
          },
          required: ['type', 'clientName', 'clientType', 'title', 'description', 'priority', 'confidence'],
        },
        description: 'Lista de itens comerciais identificados no email',
      },
      summary: {
        type: 'string',
        description: 'Resumo executivo do email comercial (1-2 frases)',
      },
    },
    required: ['items', 'summary'],
  },
};

