import { getAIClient, type AITool } from '@agent-hub/core';
import type { FinancialItem, FinancialAgentConfig } from './types.js';
import { FinancialAnalysisSchema } from './types.js';

interface AnalysisResult {
  items: Array<{
    type: FinancialItem['type'];
    amount: number;
    currency: string;
    dueDate?: string;
    issueDate?: string;
    competenceDate?: string;
    creditor: string;
    creditorType: FinancialItem['creditorType'];
    creditorDocument?: string;
    description: string;
    category: FinancialItem['category'];
    reference?: string;
    installmentCurrent?: number;
    installmentTotal?: number;
    barcodeData?: string;
    priority: FinancialItem['priority'];
    notes?: string;
    relatedProject?: string;
    requiresApproval: boolean;
    confidence: number;
  }>;
  summary: string;
}

/**
 * Analisador de emails financeiros usando Claude AI.
 */
export class FinancialAnalyzer {
  private config: FinancialAgentConfig;

  constructor(config: FinancialAgentConfig) {
    this.config = config;
  }

  /**
   * Verifica se um email parece ser sobre finanças/cobranças.
   */
  isFinancialEmail(subject: string, body: string): boolean {
    const content = `${subject} ${body}`.toLowerCase();
    
    return this.config.financialKeywords.some(keyword => 
      content.includes(keyword.toLowerCase())
    );
  }

  /**
   * Analisa um email financeiro e extrai informações estruturadas.
   */
  async analyze(
    emailSubject: string,
    emailBody: string,
    emailId: string,
    threadId?: string,
    attachmentInfo?: string,
    emailFrom?: string,
    emailDate?: Date
  ): Promise<FinancialItem[]> {
    const aiClient = getAIClient();

    const context = this.buildContext(emailSubject, emailBody, attachmentInfo);
    const systemPrompt = this.buildSystemPrompt();

    const result = await aiClient.analyze<AnalysisResult>(
      context,
      systemPrompt + '\n\nAnalise este email e extraia todas as informações financeiras.',
      FinancialAnalysisSchema as AITool
    );

    if (result && result.items) {
      return result.items.map(item => ({
        emailId,
        threadId,
        // Contexto do email original
        emailSubject,
        emailFrom,
        emailDate,
        // Dados financeiros
        type: item.type,
        status: this.determineStatus(item.dueDate),
        amount: item.amount,
        currency: item.currency || 'BRL',
        dueDate: item.dueDate,
        issueDate: item.issueDate,
        competenceDate: item.competenceDate,
        creditor: item.creditor,
        creditorType: item.creditorType,
        creditorDocument: item.creditorDocument,
        description: item.description,
        category: item.category,
        reference: item.reference,
        installment: item.installmentCurrent && item.installmentTotal
          ? { current: item.installmentCurrent, total: item.installmentTotal }
          : undefined,
        barcodeData: item.barcodeData,
        priority: item.priority,
        notes: item.notes,
        relatedProject: item.relatedProject,
        requiresApproval: item.requiresApproval || item.amount >= this.config.approvalThreshold,
        analyzedAt: new Date(),
        confidence: item.confidence,
      }));
    }

    return [];
  }

  /**
   * Determina o status baseado na data de vencimento.
   */
  private determineStatus(dueDate?: string): FinancialItem['status'] {
    if (!dueDate) return 'pending';
    
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (due < today) {
      return 'overdue';
    }
    
    return 'pending';
  }

  /**
   * Monta contexto do email para análise.
   */
  private buildContext(subject: string, body: string, attachmentInfo?: string): string {
    let context = `
=== EMAIL PARA ANÁLISE FINANCEIRA ===
Assunto: ${subject}

=== CORPO DO EMAIL ===
${body.substring(0, 8000)}${body.length > 8000 ? '\n[...truncado...]' : ''}
`;

    if (attachmentInfo) {
      context += `
=== INFORMAÇÕES DOS ANEXOS ===
${attachmentInfo}
`;
    }

    return context.trim();
  }

  /**
   * System prompt para análise financeira.
   */
  private buildSystemPrompt(): string {
    const today = new Date().toISOString().split('T')[0];

    let contextSection = '';
    if (this.config.customContext) {
      contextSection = `
═══════════════════════════════════════════════════════════════
CONTEXTO DO USUÁRIO (IMPORTANTE - Use essas informações para personalizar a análise)
═══════════════════════════════════════════════════════════════

${this.config.customContext}

`;
    }

    return `Você é um assistente financeiro especializado em análise de cobranças e pagamentos corporativos.
${contextSection}

Sua tarefa é analisar emails sobre cobranças, boletos, faturas e pagamentos e extrair informações estruturadas.

═══════════════════════════════════════════════════════════════
DATA DE HOJE: ${today}
═══════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════
O QUE EXTRAIR
═══════════════════════════════════════════════════════════════

1. **TIPO DE DOCUMENTO**
   - boleto: Boleto bancário tradicional
   - fatura: Fatura de cartão, telefone, internet, etc.
   - cobranca: Cobrança genérica sem boleto
   - nota_fiscal: NF-e, NFS-e, DANFE
   - recibo: Comprovante de pagamento ou recibo
   - outro: Outros documentos financeiros

2. **VALORES** (MUITO IMPORTANTE)
   - Extraia o valor EXATO em centavos (R$ 150,00 = 15000)
   - Identifique a moeda (BRL, USD, EUR)
   - Se houver vários valores, identifique qual é o valor a pagar

3. **DATAS**
   - dueDate: Data de vencimento (YYYY-MM-DD)
   - issueDate: Data de emissão
   - competenceDate: Mês de referência (YYYY-MM)

4. **CREDOR** (Quem está cobrando)
   - Nome da empresa/pessoa
   - Tipo: fornecedor, cliente, governo, banco, servico, outro
   - CNPJ/CPF se visível

5. **CATEGORIA**
   - operacional: Despesas do dia-a-dia da operação
   - imposto: Impostos, taxas governamentais, contribuições
   - folha: Salários, benefícios, encargos trabalhistas
   - servico: Serviços contratados (consultoria, SaaS, etc.)
   - produto: Compra de produtos, mercadorias
   - aluguel: Aluguel de imóveis ou equipamentos
   - utilidade: Água, luz, gás, telefone, internet
   - marketing: Publicidade, marketing, eventos
   - juridico: Honorários advocatícios, custas
   - outro: Não se encaixa nas categorias acima

6. **CÓDIGO DE BARRAS**
   - Se visível no email, extraia os 47-48 dígitos
   - Boletos bancários: 47 dígitos
   - Concessionárias/tributos: 48 dígitos

7. **PRIORIDADE**
   - urgent: Vence hoje ou já venceu, ou é crítico
   - high: Vence em até 3 dias, ou valor alto
   - normal: Vence em 4-10 dias
   - low: Vence em mais de 10 dias

═══════════════════════════════════════════════════════════════
REGRAS IMPORTANTES
═══════════════════════════════════════════════════════════════

1. Se um email tiver MÚLTIPLAS cobranças, crie um item para cada
2. Valores SEMPRE em centavos (multiplique por 100)
3. Se não conseguir identificar algum campo, deixe como null
4. confidence: 0-100 baseado em quão claras são as informações
5. requiresApproval: true se valor > R$ 5.000 ou parecer fora do comum
6. Identifique se há projeto/cliente relacionado pelo contexto
7. Extraia referências como número de NF, pedido, contrato

═══════════════════════════════════════════════════════════════
EXEMPLOS DE ANÁLISE
═══════════════════════════════════════════════════════════════

Email: "Segue boleto da mensalidade de janeiro - R$ 1.500,00 vencimento 10/01/2025"
→ type: "boleto", amount: 150000, dueDate: "2025-01-10", category: "servico"

Email: "NF 12345 referente ao serviço de consultoria - Total: R$ 15.000,00"
→ type: "nota_fiscal", amount: 1500000, reference: "NF 12345", category: "servico", requiresApproval: true

Email: "Fatura Vivo janeiro/2025 - R$ 450,00 vence dia 15/01"
→ type: "fatura", amount: 45000, dueDate: "2025-01-15", creditor: "Vivo", category: "utilidade"

Lembre-se: Seu objetivo é extrair informações precisas para ajudar no controle financeiro.`;
  }
}
