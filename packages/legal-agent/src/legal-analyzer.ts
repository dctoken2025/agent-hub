import { getAIClient, type AITool } from '@agent-hub/core';
import type { ExtractedDocument, ContractAnalysis, LegalAgentConfig } from './types.js';
import { ContractAnalysisSchema } from './types.js';

/**
 * Analisador de documentos legais usando Claude AI.
 */
export class LegalAnalyzer {
  private config: LegalAgentConfig;

  constructor(config: LegalAgentConfig) {
    this.config = config;
  }

  /**
   * Analisa um documento legal extraído.
   */
  async analyze(document: ExtractedDocument, emailContext?: string, emailId?: string, threadId?: string): Promise<ContractAnalysis> {
    const aiClient = getAIClient();

    const documentContext = this.buildDocumentContext(document, emailContext);
    const systemPrompt = this.buildSystemPrompt();

    const result = await aiClient.analyze<Omit<ContractAnalysis, 'analyzedAt' | 'emailId' | 'threadId'>>(
      documentContext,
      systemPrompt + '\n\nAnalise o documento e retorne a análise estruturada.',
      ContractAnalysisSchema as AITool
    );

    if (result) {
      return {
        ...result,
        emailId,
        threadId, // Para agrupar análises do mesmo thread de email
        analyzedAt: new Date(),
      };
    }

    // Fallback se IA falhar
    return this.defaultAnalysis(document, emailId, threadId);
  }

  /**
   * Verifica se um texto indica discussão de contrato.
   */
  isContractDiscussion(text: string): boolean {
    const lowerText = text.toLowerCase();
    
    const indicators = [
      // Português
      'segue contrato', 'anexo contrato', 'minuta', 'versão revisada',
      'alterações no contrato', 'mudanças propostas', 'análise do contrato',
      'revisão do contrato', 'contrato anexo', 'termo de', 'aditivo',
      'cláusula', 'proposta de alteração', 'sugestões de mudança',
      'favor revisar', 'para sua análise', 'aguardo aprovação',
      'versão final', 'versão atualizada', 'nova versão',
      
      // Inglês
      'attached contract', 'please review', 'draft agreement',
      'revised version', 'proposed changes', 'contract amendment',
      'for your review', 'pending approval', 'legal review',
    ];

    return indicators.some(indicator => lowerText.includes(indicator));
  }

  /**
   * Monta contexto do documento para análise.
   */
  private buildDocumentContext(document: ExtractedDocument, emailContext?: string): string {
    let context = `
=== DOCUMENTO PARA ANÁLISE ===
Nome do arquivo: ${document.filename}
Tipo: ${document.mimeType}
${document.pageCount ? `Páginas: ${document.pageCount}` : ''}

`;

    if (emailContext) {
      context += `=== CONTEXTO DO EMAIL ===
${emailContext}

`;
    }

    context += `=== CONTEÚDO DO DOCUMENTO ===
${document.text.substring(0, 50000)}${document.text.length > 50000 ? '\n[...documento truncado...]' : ''}
`;

    return context.trim();
  }

  /**
   * System prompt para análise jurídica.
   */
  private buildSystemPrompt(): string {
    let contextSection = '';
    if (this.config.customContext) {
      contextSection = `
═══════════════════════════════════════════════════════════════
CONTEXTO DO USUÁRIO (IMPORTANTE - Use essas informações para personalizar a análise)
═══════════════════════════════════════════════════════════════

${this.config.customContext}

`;
    }

    return `Você é um advogado corporativo sênior especializado em análise de contratos comerciais, com foco em:
${contextSection}
- Contratos de serviços financeiros e fintech
- Acordos de tecnologia e SaaS
- Contratos de parceria e distribuição
- Termos de investimento e operações estruturadas

═══════════════════════════════════════════════════════════════
SUA MISSÃO
═══════════════════════════════════════════════════════════════

Analisar o documento fornecido e identificar:

1. **Tipo e estrutura do documento**
2. **Partes envolvidas**
3. **Termos financeiros e valores**
4. **Datas críticas (vigência, vencimentos, prazos)**
5. **Cláusulas que requerem atenção especial**
6. **Riscos potenciais para o cliente**
7. **Sugestões de alteração**
8. **AÇÃO NECESSÁRIA e RESPONSÁVEIS** ⬅️ MUITO IMPORTANTE

═══════════════════════════════════════════════════════════════
🎯 IDENTIFICAR AÇÃO E RESPONSÁVEIS (CRÍTICO!)
═══════════════════════════════════════════════════════════════

Com base no CONTEXTO DO EMAIL e no DOCUMENTO, determine:

📋 **TIPO DE AÇÃO NECESSÁRIA:**
- **approve**: Documento precisa de aprovação interna antes de prosseguir
- **sign**: Documento precisa ser assinado e devolvido
- **review**: Apenas leitura/revisão, dar OK ou feedback
- **negotiate**: Termos precisam ser negociados antes de aceitar
- **reject**: Documento deve ser rejeitado (termos inaceitáveis)
- **none**: Apenas informativo, nenhuma ação necessária

👥 **IDENTIFICAR RESPONSÁVEIS:**
Analise o email e documento para identificar:
- Quem ENVIOU o documento e o que espera de volta
- Quem na empresa do destinatário deve ANALISAR
- Quem tem autoridade para APROVAR ou ASSINAR
- Se precisa passar pelo JURÍDICO primeiro

Exemplos de responsáveis:
- "Daniel Coquieri" - Signatário / Aprovar e assinar
- "Jurídico" - Revisor / Validar cláusulas antes de assinar  
- "Financeiro" - Aprovador / Aprovar valores e condições
- "Diretoria" - Aprovador / Aprovar operação

⏰ **PRAZO E URGÊNCIA:**
- Identifique prazos mencionados no email (ex: "até sexta", "urgente")
- Verifique datas no documento (vigência, vencimento)
- Marque como urgente se: prazo < 3 dias, palavras "urgente"/"imediato"

📝 **PRÓXIMOS PASSOS:**
Liste ações concretas e ordenadas, ex:
1. "Jurídico revisar cláusula de multa rescisória"
2. "Financeiro aprovar condições de pagamento"
3. "Daniel assinar e devolver ao remetente"

═══════════════════════════════════════════════════════════════
CLÁUSULAS CRÍTICAS A IDENTIFICAR
═══════════════════════════════════════════════════════════════

🔴 RISCO CRÍTICO:
- Cláusulas de exclusividade excessiva
- Multas desproporcionais
- Limitação de responsabilidade unilateral
- Renúncia de direitos importantes
- Cláusulas de confidencialidade muito amplas
- Não-competição excessiva
- Foro em jurisdição desfavorável

🟠 RISCO ALTO:
- Prazos de rescisão muito longos
- Renovação automática sem aviso
- Reajustes de preço sem limite
- Obrigações de indenização amplas
- Garantias excessivas exigidas

🟡 RISCO MÉDIO:
- Cláusulas de auditoria muito abrangentes
- Obrigações de confidencialidade pós-contrato longas
- Restrições de subcontratação
- Requisitos de seguro elevados

═══════════════════════════════════════════════════════════════
FORMATO DA ANÁLISE
═══════════════════════════════════════════════════════════════

Para cada cláusula crítica identificada, forneça:
1. Tipo da cláusula
2. Texto resumido da cláusula
3. Nível de risco (low/medium/high/critical)
4. Análise do impacto
5. Sugestão de alteração (se aplicável)

═══════════════════════════════════════════════════════════════
INSTRUÇÕES FINAIS
═══════════════════════════════════════════════════════════════

1. Seja CONSERVADOR na avaliação de risco - proteja os interesses do cliente
2. Destaque QUALQUER cláusula que pareça desequilibrada
3. Identifique valores financeiros e datas importantes
4. Sugira alterações práticas e negociáveis
5. O resumo deve ser claro para um executivo não-advogado
6. Se o documento parecer incompleto ou corrompido, indique isso
7. SEMPRE identifique a ação necessária e quem deve executá-la
8. Se não houver ação necessária (ex: apenas registro), marque como "none"

Lembre-se: Seu objetivo é proteger o cliente e garantir que ele tome uma decisão informada antes de assinar. Sempre deixe claro O QUE precisa ser feito e QUEM deve fazer.`;
  }

  /**
   * Análise padrão quando IA falha.
   */
  private defaultAnalysis(document: ExtractedDocument, emailId?: string, threadId?: string): ContractAnalysis {
    return {
      emailId,
      threadId,
      documentName: document.filename,
      documentType: 'Documento não identificado',
      parties: [],
      summary: 'Não foi possível analisar o documento automaticamente. Requer revisão manual.',
      keyDates: [],
      financialTerms: [],
      criticalClauses: [],
      risks: [{
        level: 'high',
        description: 'Análise automática falhou',
        clause: 'N/A',
        recommendation: 'Revisar documento manualmente',
      }],
      suggestions: ['Revisar documento manualmente'],
      overallRisk: 'high',
      requiresAttention: true,
      analyzedAt: new Date(),
      requiredAction: 'review',
      actionDescription: 'Análise automática falhou. Revisar documento manualmente para determinar ação necessária.',
      responsibleParties: [{
        name: 'Jurídico',
        role: 'Revisor',
        action: 'Analisar documento manualmente',
      }],
      isUrgent: false,
      nextSteps: ['Revisar documento manualmente', 'Determinar ação necessária'],
    };
  }
}
