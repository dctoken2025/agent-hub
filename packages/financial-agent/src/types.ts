import { z } from 'zod';

// ===========================================
// Tipos para Análise Financeira
// ===========================================

export type FinancialItemType = 'boleto' | 'fatura' | 'cobranca' | 'nota_fiscal' | 'recibo' | 'outro';
export type FinancialItemStatus = 'pending' | 'paid' | 'overdue' | 'cancelled' | 'disputed';
export type CreditorType = 'fornecedor' | 'cliente' | 'governo' | 'banco' | 'servico' | 'outro';
export type FinancialCategory = 'operacional' | 'imposto' | 'folha' | 'servico' | 'produto' | 'aluguel' | 'utilidade' | 'marketing' | 'juridico' | 'outro';
export type PaymentPriority = 'urgent' | 'high' | 'normal' | 'low';

export interface FinancialItem {
  // Identificação
  emailId: string;
  threadId?: string;
  
  // Contexto do email original (para rastreabilidade)
  emailSubject?: string;
  emailFrom?: string;
  emailDate?: Date;
  
  // Tipo e status
  type: FinancialItemType;
  status: FinancialItemStatus;
  
  // Valores
  amount: number;          // Valor em centavos (para evitar problemas com float)
  currency: string;        // BRL, USD, etc.
  
  // Datas
  dueDate?: string;        // Data de vencimento (ISO)
  issueDate?: string;      // Data de emissão (ISO)
  competenceDate?: string; // Data de competência (mês referência)
  
  // Quem está cobrando
  creditor: string;        // Nome do credor
  creditorType: CreditorType;
  creditorDocument?: string; // CNPJ/CPF do credor
  
  // Detalhes
  description: string;     // Descrição da cobrança
  category: FinancialCategory;
  reference?: string;      // Número de referência, pedido, contrato
  installment?: {          // Se for parcelado
    current: number;
    total: number;
  };
  
  // Dados do boleto (se aplicável)
  barcodeData?: string;    // Código de barras
  barcodeType?: 'boleto' | 'concessionaria' | 'arrecadacao';
  bankCode?: string;       // Código do banco
  
  // Anexo relacionado
  attachmentId?: string;
  attachmentFilename?: string;
  
  // Análise
  priority: PaymentPriority;
  notes?: string;          // Observações da análise
  relatedProject?: string; // Projeto/cliente relacionado
  requiresApproval: boolean;
  
  // Metadados
  analyzedAt: Date;
  confidence: number;      // 0-100 confiança na extração
}

export interface FinancialAnalysis {
  emailId: string;
  threadId?: string;
  emailSubject: string;
  items: FinancialItem[];
  summary: string;
  totalAmount: number;
  itemCount: number;
  hasUrgentItems: boolean;
  hasOverdueItems: boolean;
  analyzedAt: Date;
}

export interface FinancialAgentConfig {
  // Palavras-chave que identificam emails financeiros
  financialKeywords: string[];
  
  // Tipos de documento suportados
  supportedMimeTypes: string[];
  
  // Tamanho máximo de anexo
  maxAttachmentSize: number;
  
  // Dias antes do vencimento para marcar como urgente
  urgentDaysBeforeDue: number;
  
  // Valor mínimo para requerer aprovação
  approvalThreshold: number;
  
  // Contexto personalizado para a IA
  customContext?: string;
}

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
    type: 'object' as const,
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
