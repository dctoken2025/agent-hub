import { z } from 'zod';
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
        type: 'object',
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
//# sourceMappingURL=types.js.map