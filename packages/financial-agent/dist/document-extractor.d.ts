import type { DocumentAttachment, ExtractedDocument } from './types.js';
/**
 * Extrai texto de documentos financeiros (PDF de boletos, faturas, etc.).
 * Similar ao extrator do Legal Agent, mas otimizado para documentos financeiros.
 */
export declare class FinancialDocumentExtractor {
    /**
     * Extrai texto de um documento baseado no tipo.
     */
    extract(attachment: DocumentAttachment): Promise<ExtractedDocument>;
    /**
     * Extrai texto de PDF.
     */
    private extractPdf;
    /**
     * Processa imagem - retorna metadados para análise via Claude Vision.
     * O conteúdo base64 é passado para a IA analisar.
     */
    private extractImage;
    /**
     * Tenta extrair informações específicas de boletos do texto do PDF.
     */
    private extractBoletoInfo;
    /**
     * Verifica se o tipo de documento é suportado.
     */
    isSupported(mimeType: string): boolean;
}
//# sourceMappingURL=document-extractor.d.ts.map