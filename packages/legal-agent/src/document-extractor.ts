import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import type { DocumentAttachment, ExtractedDocument } from './types.js';

/**
 * Extrai texto de documentos PDF e DOCX.
 */
export class DocumentExtractor {
  /**
   * Extrai texto de um documento baseado no tipo.
   */
  async extract(attachment: DocumentAttachment): Promise<ExtractedDocument> {
    console.log(`[DocumentExtractor] 📄 Extraindo: ${attachment.filename}`);
    console.log(`[DocumentExtractor]    Tipo: ${attachment.mimeType}`);
    console.log(`[DocumentExtractor]    Tamanho: ${attachment.content?.length || 0} bytes`);
    
    if (!attachment.content) {
      throw new Error('Conteúdo do documento não fornecido');
    }

    const mimeType = attachment.mimeType.toLowerCase();

    if (mimeType === 'application/pdf') {
      console.log('[DocumentExtractor] 📕 Processando como PDF...');
      return this.extractPdf(attachment);
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      console.log('[DocumentExtractor] 📘 Processando como Word...');
      return this.extractDocx(attachment);
    }

    throw new Error(`Tipo de documento não suportado: ${mimeType}`);
  }

  /**
   * Extrai texto de PDF.
   */
  private async extractPdf(attachment: DocumentAttachment): Promise<ExtractedDocument> {
    try {
      console.log(`[DocumentExtractor] 🔄 Iniciando extração de PDF: ${attachment.filename}`);
      const data = await pdf(attachment.content!);
      
      console.log(`[DocumentExtractor] ✅ PDF extraído:`);
      console.log(`[DocumentExtractor]    Páginas: ${data.numpages}`);
      console.log(`[DocumentExtractor]    Caracteres: ${data.text.length}`);
      console.log(`[DocumentExtractor]    Primeiros 200 chars: ${data.text.substring(0, 200).replace(/\n/g, ' ')}...`);
      
      return {
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        text: data.text,
        pageCount: data.numpages,
        extractedAt: new Date(),
      };
    } catch (error) {
      console.error('[DocumentExtractor] ❌ Erro ao extrair PDF:', error instanceof Error ? error.message : error);
      throw new Error(`Erro ao extrair PDF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Extrai texto de DOCX.
   */
  private async extractDocx(attachment: DocumentAttachment): Promise<ExtractedDocument> {
    try {
      console.log(`[DocumentExtractor] 🔄 Iniciando extração de DOCX: ${attachment.filename}`);
      const result = await mammoth.extractRawText({ buffer: attachment.content! });
      
      console.log(`[DocumentExtractor] ✅ DOCX extraído:`);
      console.log(`[DocumentExtractor]    Caracteres: ${result.value.length}`);
      console.log(`[DocumentExtractor]    Primeiros 200 chars: ${result.value.substring(0, 200).replace(/\n/g, ' ')}...`);
      
      if (result.messages && result.messages.length > 0) {
        console.log(`[DocumentExtractor] ⚠️ Avisos: ${result.messages.map(m => m.message).join(', ')}`);
      }
      
      return {
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        text: result.value,
        extractedAt: new Date(),
      };
    } catch (error) {
      console.error('[DocumentExtractor] ❌ Erro ao extrair DOCX:', error instanceof Error ? error.message : error);
      throw new Error(`Erro ao extrair DOCX: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Verifica se o tipo de documento é suportado.
   */
  isSupported(mimeType: string): boolean {
    const supported = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    const isSupported = supported.includes(mimeType.toLowerCase());
    console.log(`[DocumentExtractor] Tipo ${mimeType} suportado: ${isSupported}`);
    return isSupported;
  }
}
