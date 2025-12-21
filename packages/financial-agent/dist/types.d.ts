import { z } from 'zod';
export type FinancialItemType = 'boleto' | 'fatura' | 'cobranca' | 'nota_fiscal' | 'recibo' | 'outro';
export type FinancialItemStatus = 'pending' | 'paid' | 'overdue' | 'cancelled' | 'disputed';
export type CreditorType = 'fornecedor' | 'cliente' | 'governo' | 'banco' | 'servico' | 'outro';
export type FinancialCategory = 'operacional' | 'imposto' | 'folha' | 'servico' | 'produto' | 'aluguel' | 'utilidade' | 'marketing' | 'juridico' | 'outro';
export type PaymentPriority = 'urgent' | 'high' | 'normal' | 'low';
export type RecurrenceType = 'once' | 'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual';
export interface DocumentAttachment {
    id?: string;
    filename: string;
    mimeType: string;
    size: number;
    content?: Buffer;
}
export interface ExtractedDocument {
    filename: string;
    mimeType: string;
    text: string;
    pageCount?: number;
    extractedAt: Date;
    isImage?: boolean;
    base64Content?: string;
    boletoInfo?: {
        barcode?: string;
        value?: number;
        dueDate?: string;
        beneficiaryName?: string;
        beneficiaryDocument?: string;
        pixKey?: string;
    };
}
export interface FinancialItem {
    emailId: string;
    threadId?: string;
    emailSubject?: string;
    emailFrom?: string;
    emailDate?: Date;
    type: FinancialItemType;
    status: FinancialItemStatus;
    amount: number;
    currency: string;
    dueDate?: string;
    issueDate?: string;
    competenceDate?: string;
    creditor: string;
    creditorType: CreditorType;
    creditorDocument?: string;
    description: string;
    category: FinancialCategory;
    reference?: string;
    installment?: {
        current: number;
        total: number;
    };
    barcodeData?: string;
    barcodeType?: 'boleto' | 'concessionaria' | 'arrecadacao';
    bankCode?: string;
    pixKey?: string;
    pixKeyType?: 'email' | 'phone' | 'cpf' | 'cnpj' | 'random';
    bankAccount?: {
        bank: string;
        agency: string;
        account: string;
        accountType?: 'corrente' | 'poupanca';
        holder?: string;
    };
    recurrence?: RecurrenceType;
    attachmentId?: string;
    attachmentFilename?: string;
    priority: PaymentPriority;
    notes?: string;
    relatedProject?: string;
    requiresApproval: boolean;
    analyzedAt: Date;
    confidence: number;
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
    financialKeywords: string[];
    supportedMimeTypes: string[];
    maxAttachmentSize: number;
    urgentDaysBeforeDue: number;
    approvalThreshold: number;
    customContext?: string;
}
export declare const FinancialAgentConfigSchema: z.ZodObject<{
    financialKeywords: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    supportedMimeTypes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    maxAttachmentSize: z.ZodDefault<z.ZodNumber>;
    urgentDaysBeforeDue: z.ZodDefault<z.ZodNumber>;
    approvalThreshold: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    financialKeywords: string[];
    supportedMimeTypes: string[];
    maxAttachmentSize: number;
    urgentDaysBeforeDue: number;
    approvalThreshold: number;
}, {
    financialKeywords?: string[] | undefined;
    supportedMimeTypes?: string[] | undefined;
    maxAttachmentSize?: number | undefined;
    urgentDaysBeforeDue?: number | undefined;
    approvalThreshold?: number | undefined;
}>;
export declare const FinancialAnalysisSchema: {
    name: string;
    description: string;
    input_schema: {
        type: "object";
        properties: {
            items: {
                type: string;
                items: {
                    type: string;
                    properties: {
                        type: {
                            type: string;
                            enum: string[];
                            description: string;
                        };
                        amount: {
                            type: string;
                            description: string;
                        };
                        currency: {
                            type: string;
                            description: string;
                        };
                        dueDate: {
                            type: string;
                            description: string;
                        };
                        issueDate: {
                            type: string;
                            description: string;
                        };
                        competenceDate: {
                            type: string;
                            description: string;
                        };
                        creditor: {
                            type: string;
                            description: string;
                        };
                        creditorType: {
                            type: string;
                            enum: string[];
                            description: string;
                        };
                        creditorDocument: {
                            type: string;
                            description: string;
                        };
                        description: {
                            type: string;
                            description: string;
                        };
                        category: {
                            type: string;
                            enum: string[];
                            description: string;
                        };
                        reference: {
                            type: string;
                            description: string;
                        };
                        installmentCurrent: {
                            type: string;
                            description: string;
                        };
                        installmentTotal: {
                            type: string;
                            description: string;
                        };
                        barcodeData: {
                            type: string;
                            description: string;
                        };
                        pixKey: {
                            type: string;
                            description: string;
                        };
                        pixKeyType: {
                            type: string;
                            enum: string[];
                            description: string;
                        };
                        bankAccount: {
                            type: string;
                            properties: {
                                bank: {
                                    type: string;
                                    description: string;
                                };
                                agency: {
                                    type: string;
                                    description: string;
                                };
                                account: {
                                    type: string;
                                    description: string;
                                };
                                accountType: {
                                    type: string;
                                    enum: string[];
                                };
                                holder: {
                                    type: string;
                                    description: string;
                                };
                            };
                            description: string;
                        };
                        recurrence: {
                            type: string;
                            enum: string[];
                            description: string;
                        };
                        priority: {
                            type: string;
                            enum: string[];
                            description: string;
                        };
                        notes: {
                            type: string;
                            description: string;
                        };
                        relatedProject: {
                            type: string;
                            description: string;
                        };
                        requiresApproval: {
                            type: string;
                            description: string;
                        };
                        confidence: {
                            type: string;
                            description: string;
                        };
                    };
                    required: string[];
                };
                description: string;
            };
            summary: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
//# sourceMappingURL=types.d.ts.map