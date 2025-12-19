import { z } from 'zod';

// ===========================================
// Tipos para Análise de Documentos Legais
// ===========================================

export interface DocumentAttachment {
  id: string;
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
}

export interface LegalClause {
  type: string;
  title: string;
  content: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  analysis: string;
  suggestion?: string;
}

export interface ContractAnalysis {
  emailId?: string;
  threadId?: string; // Thread do email para agrupar análises relacionadas
  documentName: string;
  documentType: string;
  parties: string[];
  summary: string;
  keyDates: Array<{
    description: string;
    date: string;
  }>;
  financialTerms: Array<{
    description: string;
    value: string;
  }>;
  criticalClauses: LegalClause[];
  risks: Array<{
    level: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    clause: string;
    recommendation: string;
  }>;
  suggestions: string[];
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  requiresAttention: boolean;
  analyzedAt: Date;
  
  // Novos campos para identificar responsáveis e ações
  requiredAction: 'approve' | 'sign' | 'review' | 'negotiate' | 'reject' | 'none';
  actionDescription: string;
  responsibleParties: Array<{
    name: string;
    role: string;
    action: string;
  }>;
  actionDeadline?: string;
  isUrgent: boolean;
  nextSteps: string[];
}

export interface LegalAgentConfig {
  // Tipos de documentos a analisar
  supportedMimeTypes: string[];
  
  // Tamanho máximo de documento em bytes
  maxDocumentSize: number;
  
  // Palavras-chave que indicam contrato
  contractKeywords: string[];
}

export const LegalAgentConfigSchema = z.object({
  supportedMimeTypes: z.array(z.string()).default([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ]),
  maxDocumentSize: z.number().default(10 * 1024 * 1024), // 10MB
  contractKeywords: z.array(z.string()).default([
    'contrato', 'acordo', 'termo', 'aditivo', 'procuração',
    'contract', 'agreement', 'amendment', 'addendum',
  ]),
});

// ===========================================
// Schema para Tool Use do Claude
// ===========================================

export const ContractAnalysisSchema = {
  name: 'analyze_contract',
  description: 'Analisa um contrato ou documento legal e retorna análise estruturada com responsáveis e ações necessárias',
  input_schema: {
    type: 'object' as const,
    properties: {
      documentName: {
        type: 'string',
        description: 'Nome do documento analisado',
      },
      documentType: {
        type: 'string',
        description: 'Tipo do documento (contrato, aditivo, termo, procuração, etc.)',
      },
      parties: {
        type: 'array',
        items: { type: 'string' },
        description: 'Partes envolvidas no contrato',
      },
      summary: {
        type: 'string',
        description: 'Resumo executivo do documento (2-3 parágrafos)',
      },
      keyDates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            date: { type: 'string' },
          },
        },
        description: 'Datas importantes (vigência, vencimentos, prazos)',
      },
      financialTerms: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            value: { type: 'string' },
          },
        },
        description: 'Valores e condições financeiras',
      },
      criticalClauses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            title: { type: 'string' },
            content: { type: 'string' },
            risk: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            analysis: { type: 'string' },
            suggestion: { type: 'string' },
          },
        },
        description: 'Cláusulas críticas identificadas',
      },
      risks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            level: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            description: { type: 'string' },
            clause: { type: 'string' },
            recommendation: { type: 'string' },
          },
        },
        description: 'Riscos identificados no documento',
      },
      suggestions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Sugestões de alteração ou pontos de atenção',
      },
      overallRisk: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
        description: 'Nível de risco geral do documento',
      },
      requiresAttention: {
        type: 'boolean',
        description: 'Se o documento requer atenção especial antes de assinar',
      },
      requiredAction: {
        type: 'string',
        enum: ['approve', 'sign', 'review', 'negotiate', 'reject', 'none'],
        description: 'Ação necessária: approve=aprovar documento, sign=assinar, review=apenas revisar/ler, negotiate=negociar termos, reject=rejeitar, none=nenhuma ação necessária (apenas informativo)',
      },
      actionDescription: {
        type: 'string',
        description: 'Descrição clara da ação que precisa ser tomada (ex: "Assinar e devolver até 20/12", "Revisar cláusula 5.2 e dar OK", "Apenas para conhecimento, não requer ação")',
      },
      responsibleParties: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Nome da pessoa ou área responsável' },
            role: { type: 'string', description: 'Papel no processo (ex: Signatário, Revisor, Aprovador, Jurídico)' },
            action: { type: 'string', description: 'O que essa pessoa precisa fazer' },
          },
        },
        description: 'Lista de pessoas/áreas responsáveis por analisar ou aprovar este documento. Baseie-se no contexto do email e nas partes do contrato.',
      },
      actionDeadline: {
        type: 'string',
        description: 'Prazo para a ação, se mencionado no email ou documento (formato: YYYY-MM-DD ou texto como "urgente", "esta semana")',
      },
      isUrgent: {
        type: 'boolean',
        description: 'Se a ação é urgente baseado no contexto do email ou prazos do documento',
      },
      nextSteps: {
        type: 'array',
        items: { type: 'string' },
        description: 'Lista ordenada dos próximos passos concretos que devem ser tomados (ex: "1. Revisar cláusula de multa", "2. Aprovar internamente", "3. Assinar e devolver")',
      },
    },
    required: [
      'documentName', 'documentType', 'parties', 'summary', 
      'keyDates', 'financialTerms', 'criticalClauses', 'risks',
      'suggestions', 'overallRisk', 'requiresAttention',
      'requiredAction', 'actionDescription', 'responsibleParties',
      'isUrgent', 'nextSteps'
    ],
  },
};
