import pdf from 'pdf-parse';
/**
 * Extrai texto de documentos financeiros (PDF de boletos, faturas, etc.).
 * Similar ao extrator do Legal Agent, mas otimizado para documentos financeiros.
 */
export class FinancialDocumentExtractor {
    /**
     * Extrai texto de um documento baseado no tipo.
     */
    async extract(attachment) {
        console.log(`[FinancialDocumentExtractor] 📄 Extraindo: ${attachment.filename}`);
        console.log(`[FinancialDocumentExtractor]    Tipo: ${attachment.mimeType}`);
        console.log(`[FinancialDocumentExtractor]    Tamanho: ${attachment.content?.length || 0} bytes`);
        if (!attachment.content) {
            throw new Error('Conteúdo do documento não fornecido');
        }
        const mimeType = attachment.mimeType.toLowerCase();
        // PDF (boletos, faturas, notas fiscais)
        if (mimeType === 'application/pdf') {
            console.log('[FinancialDocumentExtractor] 📕 Processando como PDF...');
            return this.extractPdf(attachment);
        }
        // Imagens (prints de boleto, QR codes PIX)
        if (mimeType.startsWith('image/')) {
            console.log('[FinancialDocumentExtractor] 🖼️ Processando como imagem...');
            return this.extractImage(attachment);
        }
        throw new Error(`Tipo de documento não suportado: ${mimeType}`);
    }
    /**
     * Extrai texto de PDF.
     */
    async extractPdf(attachment) {
        try {
            console.log(`[FinancialDocumentExtractor] 🔄 Iniciando extração de PDF: ${attachment.filename}`);
            const data = await pdf(attachment.content);
            console.log(`[FinancialDocumentExtractor] ✅ PDF extraído:`);
            console.log(`[FinancialDocumentExtractor]    Páginas: ${data.numpages}`);
            console.log(`[FinancialDocumentExtractor]    Caracteres: ${data.text.length}`);
            // Log do início do conteúdo para debug
            if (data.text.length > 0) {
                const preview = data.text.substring(0, 300).replace(/\n/g, ' ').trim();
                console.log(`[FinancialDocumentExtractor]    Preview: ${preview}...`);
            }
            // Tenta extrair informações específicas de boletos
            const boletoInfo = this.extractBoletoInfo(data.text);
            if (boletoInfo) {
                console.log(`[FinancialDocumentExtractor]    📊 Dados de boleto detectados:`);
                if (boletoInfo.barcode)
                    console.log(`[FinancialDocumentExtractor]       Código: ${boletoInfo.barcode.substring(0, 20)}...`);
                if (boletoInfo.value)
                    console.log(`[FinancialDocumentExtractor]       Valor: ${boletoInfo.value}`);
                if (boletoInfo.dueDate)
                    console.log(`[FinancialDocumentExtractor]       Vencimento: ${boletoInfo.dueDate}`);
            }
            return {
                filename: attachment.filename,
                mimeType: attachment.mimeType,
                text: data.text,
                pageCount: data.numpages,
                extractedAt: new Date(),
                boletoInfo,
            };
        }
        catch (error) {
            console.error('[FinancialDocumentExtractor] ❌ Erro ao extrair PDF:', error instanceof Error ? error.message : error);
            throw new Error(`Erro ao extrair PDF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }
    }
    /**
     * Processa imagem - retorna metadados para análise via Claude Vision.
     * O conteúdo base64 é passado para a IA analisar.
     */
    async extractImage(attachment) {
        console.log(`[FinancialDocumentExtractor] 🖼️ Preparando imagem para análise: ${attachment.filename}`);
        // Converte para base64 se ainda não estiver
        const base64Content = attachment.content.toString('base64');
        return {
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            text: '', // Imagens não têm texto direto - será analisado via Vision
            extractedAt: new Date(),
            isImage: true,
            base64Content,
        };
    }
    /**
     * Tenta extrair informações específicas de boletos do texto do PDF.
     */
    extractBoletoInfo(text) {
        const info = {};
        // Regex para código de barras (47-48 dígitos)
        const barcodeRegex = /\b(\d{5}\.?\d{5}\s*\d{5}\.?\d{6}\s*\d{5}\.?\d{6}\s*\d\s*\d{14})\b/;
        const barcodeMatch = text.match(barcodeRegex);
        if (barcodeMatch) {
            info.barcode = barcodeMatch[1].replace(/[\s.]/g, '');
        }
        // Alternativa: linha digitável sem pontos
        if (!info.barcode) {
            const simpleBarcode = text.match(/\b(\d{47,48})\b/);
            if (simpleBarcode) {
                info.barcode = simpleBarcode[1];
            }
        }
        // Regex para valores monetários (R$ X.XXX,XX ou R$X.XXX,XX)
        const valueRegex = /R\$\s*([\d.,]+)/gi;
        const values = [];
        let valueMatch;
        while ((valueMatch = valueRegex.exec(text)) !== null) {
            const valueStr = valueMatch[1].replace(/\./g, '').replace(',', '.');
            const value = parseFloat(valueStr);
            if (!isNaN(value) && value > 0) {
                values.push(value);
            }
        }
        // O maior valor geralmente é o valor do boleto
        if (values.length > 0) {
            info.value = Math.max(...values);
        }
        // Regex para datas (DD/MM/YYYY)
        const dateRegex = /\b(\d{2}\/\d{2}\/\d{4})\b/g;
        const dates = [];
        let dateMatch;
        while ((dateMatch = dateRegex.exec(text)) !== null) {
            dates.push(dateMatch[1]);
        }
        // Procura data de vencimento especificamente
        const vencimentoMatch = text.match(/vencimento[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
        if (vencimentoMatch) {
            info.dueDate = vencimentoMatch[1];
        }
        else if (dates.length > 0) {
            // Se não encontrou explicitamente, pega a primeira data futura
            const today = new Date();
            for (const dateStr of dates) {
                const [day, month, year] = dateStr.split('/').map(Number);
                const date = new Date(year, month - 1, day);
                if (date >= today) {
                    info.dueDate = dateStr;
                    break;
                }
            }
            // Se não encontrou data futura, usa a primeira
            if (!info.dueDate && dates.length > 0) {
                info.dueDate = dates[0];
            }
        }
        // Procura CNPJ/CPF do beneficiário
        const cnpjRegex = /\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/;
        const cnpjMatch = text.match(cnpjRegex);
        if (cnpjMatch) {
            info.beneficiaryDocument = cnpjMatch[1];
        }
        // Procura nome do beneficiário
        const beneficiarioMatch = text.match(/(?:benefici[áa]rio|cedente|favorecido)[:\s]*([^\n\r]+)/i);
        if (beneficiarioMatch) {
            info.beneficiaryName = beneficiarioMatch[1].trim().substring(0, 100);
        }
        // Procura chave PIX
        const pixKeyRegex = /(?:chave\s*pix|pix)[:\s]*([^\n\r]+)/i;
        const pixMatch = text.match(pixKeyRegex);
        if (pixMatch) {
            const pixValue = pixMatch[1].trim();
            // Valida se parece uma chave PIX (email, telefone, CPF/CNPJ, aleatória)
            if (pixValue.includes('@') || /^\d{11,14}$/.test(pixValue.replace(/[.\-/]/g, '')) || /^[a-z0-9-]{32,36}$/i.test(pixValue)) {
                info.pixKey = pixValue;
            }
        }
        // Verifica se encontrou algo útil
        if (Object.keys(info).length > 0) {
            return info;
        }
        return undefined;
    }
    /**
     * Verifica se o tipo de documento é suportado.
     */
    isSupported(mimeType) {
        const mime = mimeType.toLowerCase();
        const supported = [
            'application/pdf',
            'image/png',
            'image/jpeg',
            'image/jpg',
            'image/gif',
            'image/webp',
        ];
        const isSupported = supported.includes(mime);
        console.log(`[FinancialDocumentExtractor] Tipo ${mimeType} suportado: ${isSupported}`);
        return isSupported;
    }
}
//# sourceMappingURL=document-extractor.js.map