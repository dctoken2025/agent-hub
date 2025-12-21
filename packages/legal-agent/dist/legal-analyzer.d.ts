import type { ExtractedDocument, ContractAnalysis, LegalAgentConfig } from './types.js';
/**
 * Analisador de documentos legais usando Claude AI.
 */
export declare class LegalAnalyzer {
    private config;
    constructor(config: LegalAgentConfig);
    /**
     * Analisa um documento legal extraído.
     */
    analyze(document: ExtractedDocument, emailContext?: string, emailId?: string, threadId?: string): Promise<ContractAnalysis>;
    /**
     * Verifica se um texto indica discussão de contrato.
     */
    isContractDiscussion(text: string): boolean;
    /**
     * Monta contexto do documento para análise.
     */
    private buildDocumentContext;
    /**
     * System prompt para análise jurídica.
     */
    private buildSystemPrompt;
    /**
     * Análise padrão quando IA falha.
     */
    private defaultAnalysis;
}
//# sourceMappingURL=legal-analyzer.d.ts.map