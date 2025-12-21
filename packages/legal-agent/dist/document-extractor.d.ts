import type { DocumentAttachment, ExtractedDocument } from './types.js';
/**
 * Extrai texto de documentos PDF e DOCX.
 */
export declare class DocumentExtractor {
    /**
     * Extrai texto de um documento baseado no tipo.
     */
    extract(attachment: DocumentAttachment): Promise<ExtractedDocument>;
    /**
     * Extrai texto de PDF.
     */
    private extractPdf;
    /**
     * Extrai texto de DOCX.
     */
    private extractDocx;
    /**
     * Verifica se o tipo de documento é suportado.
     */
    isSupported(mimeType: string): boolean;
}
//# sourceMappingURL=document-extractor.d.ts.map