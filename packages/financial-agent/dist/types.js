import { z } from 'zod';
export const FinancialAgentConfigSchema = z.object({
    financialKeywords: z.array(z.string()).default([
        // Boletos e faturas
        'boleto', 'fatura', 'invoice', 'cobrança', 'pagamento',
        'vencimento', 'vence em', 'pagar até', 'payment due',
        // Documentos fiscais
        'nota fiscal', 'nf-e', 'nfe', 'danfe', 'recibo',
        // Valores
        'valor', 'parcela', 'mensalidade', 'anuidade',
        'total a pagar', 'amount due',
        // Bancos
        'banco', 'agência', 'conta', 'pix', 'transferência',
        // Ações
        'efetuar pagamento', 'realize o pagamento', 'segue boleto',
        'anexo boleto', 'em anexo', 'cobrança referente',
    ]),
    supportedMimeTypes: z.array(z.string()).default([
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/jpg',
    ]),
    maxAttachmentSize: z.number().default(5 * 1024 * 1024), // 5MB
    urgentDaysBeforeDue: z.number().default(3),
    approvalThreshold: z.number().default(500000), // R$ 5.000,00 em centavos
});
// ===========================================
// Schema para Tool Use do Claude
// ===========================================
export const FinancialAnalysisSchema = {
    name: 'analyze_financial_email',
    description: 'Analisa um email sobre cobranças, boletos ou pagamentos e extrai informações estruturadas',
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
                            enum: ['boleto', 'fatura', 'cobranca', 'nota_fiscal', 'recibo', 'outro'],
                            description: 'Tipo do documento financeiro',
                        },
                        amount: {
                            type: 'number',
                            description: 'Valor em centavos (ex: R$ 150,00 = 15000)',
                        },
                        currency: {
                            type: 'string',
                            description: 'Moeda (BRL, USD, EUR, etc.)',
                        },
                        dueDate: {
                            type: 'string',
                            description: 'Data de vencimento no formato ISO (YYYY-MM-DD)',
                        },
                        issueDate: {
                            type: 'string',
                            description: 'Data de emissão no formato ISO (YYYY-MM-DD)',
                        },
                        competenceDate: {
                            type: 'string',
                            description: 'Mês de competência/referência no formato YYYY-MM',
                        },
                        creditor: {
                            type: 'string',
                            description: 'Nome de quem está cobrando (empresa, pessoa, órgão)',
                        },
                        creditorType: {
                            type: 'string',
                            enum: ['fornecedor', 'cliente', 'governo', 'banco', 'servico', 'outro'],
                            description: 'Tipo de credor',
                        },
                        creditorDocument: {
                            type: 'string',
                            description: 'CNPJ ou CPF do credor, se identificado',
                        },
                        description: {
                            type: 'string',
                            description: 'Descrição clara do que está sendo cobrado',
                        },
                        category: {
                            type: 'string',
                            enum: ['operacional', 'imposto', 'folha', 'servico', 'produto', 'aluguel', 'utilidade', 'marketing', 'juridico', 'outro'],
                            description: 'Categoria da despesa',
                        },
                        reference: {
                            type: 'string',
                            description: 'Número de referência, pedido, contrato ou NF relacionado',
                        },
                        installmentCurrent: {
                            type: 'number',
                            description: 'Número da parcela atual (ex: 3 de 12)',
                        },
                        installmentTotal: {
                            type: 'number',
                            description: 'Total de parcelas (ex: 3 de 12)',
                        },
                        barcodeData: {
                            type: 'string',
                            description: 'Código de barras do boleto (47-48 dígitos), se visível',
                        },
                        pixKey: {
                            type: 'string',
                            description: 'Chave PIX para pagamento (email, telefone, CPF, CNPJ ou chave aleatória)',
                        },
                        pixKeyType: {
                            type: 'string',
                            enum: ['email', 'phone', 'cpf', 'cnpj', 'random'],
                            description: 'Tipo da chave PIX',
                        },
                        bankAccount: {
                            type: 'object',
                            properties: {
                                bank: { type: 'string', description: 'Nome ou código do banco' },
                                agency: { type: 'string', description: 'Número da agência' },
                                account: { type: 'string', description: 'Número da conta' },
                                accountType: { type: 'string', enum: ['corrente', 'poupanca'] },
                                holder: { type: 'string', description: 'Nome do titular' },
                            },
                            description: 'Dados bancários para transferência',
                        },
                        recurrence: {
                            type: 'string',
                            enum: ['once', 'weekly', 'monthly', 'quarterly', 'semiannual', 'annual'],
                            description: 'Tipo de recorrência do pagamento (mensal, anual, etc.)',
                        },
                        priority: {
                            type: 'string',
                            enum: ['urgent', 'high', 'normal', 'low'],
                            description: 'Prioridade do pagamento baseado em urgência e valor',
                        },
                        notes: {
                            type: 'string',
                            description: 'Observações relevantes sobre esta cobrança',
                        },
                        relatedProject: {
                            type: 'string',
                            description: 'Projeto, cliente ou operação relacionada, se identificado',
                        },
                        requiresApproval: {
                            type: 'boolean',
                            description: 'Se o pagamento requer aprovação (valores altos, fora do comum)',
                        },
                        confidence: {
                            type: 'number',
                            description: 'Confiança na extração dos dados (0-100)',
                        },
                    },
                    required: ['type', 'amount', 'currency', 'creditor', 'creditorType', 'description', 'category', 'priority', 'requiresApproval', 'confidence'],
                },
                description: 'Lista de itens financeiros identificados no email',
            },
            summary: {
                type: 'string',
                description: 'Resumo executivo do email financeiro (1-2 frases)',
            },
        },
        required: ['items', 'summary'],
    },
};
//# sourceMappingURL=types.js.map