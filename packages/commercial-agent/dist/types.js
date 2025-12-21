import { z } from 'zod';
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
        type: 'object',
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
//# sourceMappingURL=types.js.map