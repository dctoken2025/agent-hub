import { getAIClient, type AITool } from '@agent-hub/core';
import type { FinancialItem, FinancialAgentConfig, ExtractedDocument, RecurrenceType } from './types.js';
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
    // Novos campos
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
   * Agora também processa o conteúdo de anexos (PDFs, imagens).
   */
  async analyze(
    emailSubject: string,
    emailBody: string,
    emailId: string,
    threadId?: string,
    attachmentInfo?: string,
    emailFrom?: string,
    emailDate?: Date,
    extractedDocuments?: ExtractedDocument[]
  ): Promise<FinancialItem[]> {
    const aiClient = getAIClient();

    const context = this.buildContext(emailSubject, emailBody, attachmentInfo, extractedDocuments);
    const systemPrompt = this.buildSystemPrompt();

    const result = await aiClient.analyze<AnalysisResult>(
      context,
      systemPrompt + '\n\nAnalise este email e seus anexos. Extraia TODAS as informações financeiras disponíveis.',
      FinancialAnalysisSchema as AITool
    );

    if (result && result.items) {
      // Mescla informações dos documentos extraídos (boleto info) se disponíveis
      const boletoInfo = extractedDocuments?.find(d => d.boletoInfo)?.boletoInfo;
      
      return result.items.map((item, index) => {
        // Se temos info de boleto extraída por regex e o item não tem alguns campos, preenche
        const enrichedItem: FinancialItem = {
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
          dueDate: item.dueDate || (boletoInfo?.dueDate ? this.parseDate(boletoInfo.dueDate) : undefined),
          issueDate: item.issueDate,
          competenceDate: item.competenceDate,
          creditor: item.creditor || boletoInfo?.beneficiaryName || 'Não identificado',
          creditorType: item.creditorType,
          creditorDocument: item.creditorDocument || boletoInfo?.beneficiaryDocument,
          description: item.description,
          category: item.category,
          reference: item.reference,
          installment: item.installmentCurrent && item.installmentTotal
            ? { current: item.installmentCurrent, total: item.installmentTotal }
            : undefined,
          barcodeData: item.barcodeData || boletoInfo?.barcode,
          // Novos campos
          pixKey: item.pixKey || boletoInfo?.pixKey,
          pixKeyType: item.pixKeyType,
          bankAccount: item.bankAccount,
          recurrence: item.recurrence,
          priority: item.priority,
          notes: item.notes,
          relatedProject: item.relatedProject,
          requiresApproval: item.requiresApproval || item.amount >= this.config.approvalThreshold,
          analyzedAt: new Date(),
          confidence: item.confidence,
          // Anexo relacionado (primeiro documento, se houver)
          attachmentFilename: extractedDocuments?.[index]?.filename || extractedDocuments?.[0]?.filename,
        };
        
        return enrichedItem;
      });
    }

    return [];
  }
  
  /**
   * Converte data no formato DD/MM/YYYY para ISO.
   */
  private parseDate(dateStr: string): string | undefined {
    if (!dateStr) return undefined;
    
    // Tenta formato DD/MM/YYYY
    const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month}-${day}`;
    }
    
    return dateStr;
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
   * Monta contexto do email para análise, incluindo conteúdo de anexos.
   */
  private buildContext(
    subject: string, 
    body: string, 
    attachmentInfo?: string,
    extractedDocuments?: ExtractedDocument[]
  ): string {
    let context = `
═══════════════════════════════════════════════════════════════
EMAIL PARA ANÁLISE FINANCEIRA
═══════════════════════════════════════════════════════════════
Assunto: ${subject}

=== CORPO DO EMAIL ===
${body.substring(0, 8000)}${body.length > 8000 ? '\n[...truncado...]' : ''}
`;

    // Informações básicas dos anexos
    if (attachmentInfo) {
      context += `

=== LISTA DE ANEXOS ===
${attachmentInfo}
`;
    }

    // Conteúdo extraído dos anexos (PDFs, etc.)
    if (extractedDocuments && extractedDocuments.length > 0) {
      context += `

═══════════════════════════════════════════════════════════════
CONTEÚDO DOS ANEXOS (IMPORTANTE - Leia com atenção!)
═══════════════════════════════════════════════════════════════
`;
      
      for (const doc of extractedDocuments) {
        context += `

--- ANEXO: ${doc.filename} ---
Tipo: ${doc.mimeType}
${doc.pageCount ? `Páginas: ${doc.pageCount}` : ''}
`;
        
        // Se temos dados de boleto extraídos por regex, mostra primeiro
        if (doc.boletoInfo) {
          context += `
=== DADOS IDENTIFICADOS AUTOMATICAMENTE ===
`;
          if (doc.boletoInfo.barcode) {
            context += `Código de Barras: ${doc.boletoInfo.barcode}\n`;
          }
          if (doc.boletoInfo.value) {
            context += `Valor Identificado: R$ ${doc.boletoInfo.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
          }
          if (doc.boletoInfo.dueDate) {
            context += `Data de Vencimento: ${doc.boletoInfo.dueDate}\n`;
          }
          if (doc.boletoInfo.beneficiaryName) {
            context += `Beneficiário: ${doc.boletoInfo.beneficiaryName}\n`;
          }
          if (doc.boletoInfo.beneficiaryDocument) {
            context += `CNPJ/CPF: ${doc.boletoInfo.beneficiaryDocument}\n`;
          }
          if (doc.boletoInfo.pixKey) {
            context += `Chave PIX: ${doc.boletoInfo.pixKey}\n`;
          }
        }
        
        // Texto completo do documento
        if (doc.text && doc.text.length > 0) {
          context += `
=== CONTEÚDO DO DOCUMENTO ===
${doc.text.substring(0, 15000)}${doc.text.length > 15000 ? '\n[...documento truncado...]' : ''}
`;
        }
        
        // Se é imagem, avisa que precisa análise visual
        if (doc.isImage) {
          context += `
[Este é um anexo de IMAGEM - analise visualmente se disponível]
`;
        }
      }
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

    return `Você é um assistente financeiro ESPECIALISTA em análise de cobranças, boletos, faturas e pagamentos corporativos.
${contextSection}

Sua tarefa é analisar PROFUNDAMENTE emails E SEUS ANEXOS para extrair TODAS as informações financeiras relevantes.

═══════════════════════════════════════════════════════════════
⚠️ DATA DE HOJE: ${today}
═══════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════
🎯 SUA MISSÃO
═══════════════════════════════════════════════════════════════

1. Leia ATENTAMENTE o corpo do email
2. Leia ATENTAMENTE o conteúdo de TODOS os anexos (boletos PDF, etc.)
3. CRUZE informações entre email e anexos para maior precisão
4. Extraia TODAS as formas de pagamento disponíveis
5. Identifique recorrência (mensal, anual, etc.)
6. Calcule a prioridade baseado em vencimento e valor

═══════════════════════════════════════════════════════════════
📋 O QUE EXTRAIR
═══════════════════════════════════════════════════════════════

1. **TIPO DE DOCUMENTO**
   - boleto: Boleto bancário tradicional
   - fatura: Fatura de cartão, telefone, internet, etc.
   - cobranca: Cobrança genérica sem boleto
   - nota_fiscal: NF-e, NFS-e, DANFE
   - recibo: Comprovante de pagamento ou recibo
   - outro: Outros documentos financeiros

2. **VALORES** (CRÍTICO - NÃO ERRE!)
   - Extraia o valor EXATO em CENTAVOS (R$ 150,00 = 15000)
   - Identifique a moeda (BRL, USD, EUR)
   - Se houver vários valores, identifique qual é o VALOR A PAGAR
   - Atenção: "2.500,00" = 250000 centavos (ponto é milhar, vírgula é decimal)

3. **DATAS** (MUITO IMPORTANTE!)
   - dueDate: Data de VENCIMENTO (YYYY-MM-DD) - PRIORIZE esta!
   - issueDate: Data de emissão
   - competenceDate: Mês de referência (YYYY-MM)
   - PROCURE no boleto anexo se não estiver no email!

4. **CREDOR** (Quem está cobrando)
   - Nome da empresa/pessoa/instituição
   - Tipo: fornecedor, cliente, governo, banco, servico, outro
   - CNPJ/CPF se visível (procure no boleto!)

5. **CATEGORIA**
   - operacional: Despesas do dia-a-dia da operação, taxas, tarifas
   - imposto: Impostos, taxas governamentais, contribuições
   - folha: Salários, benefícios, encargos trabalhistas
   - servico: Serviços contratados (consultoria, SaaS, agente fiduciário, etc.)
   - produto: Compra de produtos, mercadorias
   - aluguel: Aluguel de imóveis ou equipamentos
   - utilidade: Água, luz, gás, telefone, internet
   - marketing: Publicidade, marketing, eventos
   - juridico: Honorários advocatícios, custas
   - outro: Não se encaixa nas categorias acima

6. **CÓDIGO DE BARRAS** (PROCURE NO ANEXO!)
   - Extraia os 47-48 dígitos COMPLETOS
   - Boletos bancários: 47 dígitos
   - Concessionárias/tributos: 48 dígitos
   - Procure linha digitável no PDF do boleto

7. **🔑 CHAVE PIX** (MUITO COMUM HOJE!)
   - Extraia a chave PIX se mencionada
   - Tipos: email, phone (telefone), cpf, cnpj, random (aleatória)
   - Procure por: "pix@...", "chave pix:", "pagar via pix", etc.

8. **🏦 DADOS BANCÁRIOS**
   - Se houver opção de transferência/TED/DOC
   - Extraia: banco, agência, conta, tipo (corrente/poupança), titular

9. **🔄 RECORRÊNCIA** (IMPORTANTE!)
   - once: Pagamento único
   - weekly: Semanal
   - monthly: Mensal (ex: "mensalidade", "2500,00 mensal")
   - quarterly: Trimestral
   - semiannual: Semestral
   - annual: Anual (ex: "anuidade")
   
10. **PRIORIDADE**
    - urgent: Vence HOJE ou já venceu, ou é crítico
    - high: Vence em até 3 dias, ou valor alto (>R$10.000)
    - normal: Vence em 4-10 dias
    - low: Vence em mais de 10 dias

═══════════════════════════════════════════════════════════════
⚠️ REGRAS IMPORTANTES
═══════════════════════════════════════════════════════════════

1. Se um email tiver MÚLTIPLAS cobranças, crie um item para CADA
2. Valores SEMPRE em CENTAVOS (multiplique por 100)
3. CRUZE informações: o que falta no email pode estar no anexo!
4. confidence: 0-100 baseado em quão claras são as informações
5. requiresApproval: true se valor > R$ 5.000 ou parecer fora do comum
6. Identifique se há projeto/operação relacionada (ex: "operação BARU")
7. Extraia referências como número de NF, pedido, contrato
8. Se o email menciona "mensal", "mensalidade", "anuidade" → extraia recurrence
9. SEMPRE procure a data de vencimento, mesmo que esteja só no boleto anexo

═══════════════════════════════════════════════════════════════
📝 EXEMPLOS DE ANÁLISE
═══════════════════════════════════════════════════════════════

📧 Email: "Segue boleto da mensalidade de janeiro - R$ 1.500,00 vencimento 10/01/2025"
→ type: "boleto", amount: 150000, dueDate: "2025-01-10", category: "servico", recurrence: "monthly"

📧 Email: "Despesa do Agente Fiduciário da operação BARU, Oliveira Trust, 2500,00 mensal, pix: pix@ot.com.br"
→ type: "cobranca", amount: 250000, creditor: "Oliveira Trust", category: "servico", 
   pixKey: "pix@ot.com.br", pixKeyType: "email", recurrence: "monthly", 
   relatedProject: "Operação BARU", notes: "Agente Fiduciário"

📧 Email: "NF 12345 referente ao serviço de consultoria - Total: R$ 15.000,00"
→ type: "nota_fiscal", amount: 1500000, reference: "NF 12345", category: "servico", requiresApproval: true

📧 Email: "Fatura Vivo janeiro/2025 - R$ 450,00 vence dia 15/01"
→ type: "fatura", amount: 45000, dueDate: "2025-01-15", creditor: "Vivo", 
   category: "utilidade", competenceDate: "2025-01"

📧 Email + Boleto anexo com código de barras
→ Extraia o código de barras DO BOLETO, não apenas do email!

═══════════════════════════════════════════════════════════════
🎯 RESUMO: Seu objetivo é extrair TODAS as informações relevantes
   para que o usuário possa pagar a conta corretamente e no prazo.
═══════════════════════════════════════════════════════════════`;
  }
}

