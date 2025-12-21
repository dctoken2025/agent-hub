import { Agent } from '@agent-hub/core';
import { DocumentExtractor } from './document-extractor.js';
import { LegalAnalyzer } from './legal-analyzer.js';
/**
 * Agente jurídico para análise de contratos e documentos legais.
 * Recebe anexos de emails e analisa conteúdo jurídico.
 */
export class LegalAgent extends Agent {
    extractor;
    analyzer;
    legalConfig;
    notifier;
    // Fila de documentos para processar
    queue = [];
    constructor(agentConfig, legalConfig, notifier) {
        super(agentConfig);
        this.legalConfig = legalConfig;
        this.extractor = new DocumentExtractor();
        this.analyzer = new LegalAnalyzer(legalConfig);
        this.notifier = notifier;
    }
    /**
     * Adiciona documentos à fila para processamento.
     */
    enqueue(input) {
        this.queue.push(input);
        console.log(`[LegalAgent] Documento adicionado à fila. Total: ${this.queue.length}`);
    }
    /**
     * Processa a fila de documentos.
     */
    async execute(input) {
        const startTime = Date.now();
        console.log('[LegalAgent] 🔍 Execute chamado');
        // Se recebeu input direto, usa ele; senão, pega da fila
        const toProcess = input || this.queue.shift();
        if (!toProcess) {
            console.log('[LegalAgent] ⚠️ Nenhum documento para processar');
            return {
                success: true,
                data: {
                    emailId: '',
                    documentsAnalyzed: 0,
                    analyses: [],
                    hasHighRiskDocuments: false,
                    summary: 'Nenhum documento na fila para processar',
                },
                timestamp: new Date(),
                duration: Date.now() - startTime,
            };
        }
        try {
            console.log(`[LegalAgent] 📧 Processando email: ${toProcess.emailSubject}`);
            console.log(`[LegalAgent] 📎 Total de anexos recebidos: ${toProcess.attachments.length}`);
            toProcess.attachments.forEach((att, i) => {
                const hasContent = att.content ? `✅ ${att.content.length} bytes` : '❌ sem conteúdo';
                console.log(`[LegalAgent]    ${i + 1}. ${att.filename} (${att.mimeType}) - ${hasContent}`);
            });
            const analyses = [];
            const emailContext = `Assunto: ${toProcess.emailSubject}\n\n${toProcess.emailBody.substring(0, 2000)}`;
            // Processa cada anexo
            for (const attachment of toProcess.attachments) {
                console.log(`[LegalAgent] 🔄 Processando: ${attachment.filename}`);
                // Verifica se é um tipo suportado
                if (!this.extractor.isSupported(attachment.mimeType)) {
                    console.log(`[LegalAgent] ⚠️ Tipo não suportado: ${attachment.mimeType} (esperado: PDF, DOCX, DOC)`);
                    continue;
                }
                // Verifica tamanho
                if (attachment.size > this.legalConfig.maxDocumentSize) {
                    console.log(`[LegalAgent] ⚠️ Documento muito grande: ${attachment.filename} (${attachment.size} bytes > ${this.legalConfig.maxDocumentSize})`);
                    continue;
                }
                // Verifica se tem conteúdo
                if (!attachment.content) {
                    console.log(`[LegalAgent] ⚠️ Anexo sem conteúdo: ${attachment.filename}`);
                    continue;
                }
                try {
                    // Extrai texto do documento
                    console.log(`[LegalAgent] 📝 Extraindo texto de: ${attachment.filename}...`);
                    const extracted = await this.extractor.extract(attachment);
                    console.log(`[LegalAgent] ✅ Texto extraído: ${extracted.text.length} caracteres, ${extracted.pageCount || '?'} páginas`);
                    // Analisa com IA (passando o emailId e threadId)
                    console.log(`[LegalAgent] 🤖 Analisando com Claude AI: ${attachment.filename}...`);
                    const analysis = await this.analyzer.analyze(extracted, emailContext, toProcess.emailId, toProcess.threadId);
                    analyses.push(analysis);
                    console.log(`[LegalAgent] ✅ Análise concluída: ${attachment.filename}`);
                    console.log(`[LegalAgent]    📊 Risco: ${analysis.overallRisk}`);
                    console.log(`[LegalAgent]    ⚠️ Requer atenção: ${analysis.requiresAttention}`);
                    console.log(`[LegalAgent]    📋 Cláusulas críticas: ${analysis.criticalClauses?.length || 0}`);
                    console.log(`[LegalAgent]    🔴 Riscos identificados: ${analysis.risks?.length || 0}`);
                }
                catch (error) {
                    console.error(`[LegalAgent] ❌ Erro ao processar ${attachment.filename}:`, error instanceof Error ? error.message : error);
                    if (error instanceof Error && error.stack) {
                        console.error(`[LegalAgent] Stack trace:`, error.stack.split('\n').slice(0, 3).join('\n'));
                    }
                }
            }
            // Verifica se há documentos de alto risco
            const hasHighRiskDocuments = analyses.some(a => a.overallRisk === 'high' || a.overallRisk === 'critical');
            // Gera resumo
            const summary = this.generateSummary(analyses);
            console.log(`[LegalAgent] 📊 Resumo: ${summary}`);
            // Notifica se houver documentos de alto risco
            if (hasHighRiskDocuments && this.notifier) {
                console.log('[LegalAgent] 🔔 Enviando notificação de alto risco...');
                await this.notifyHighRisk(toProcess, analyses);
            }
            const result = {
                emailId: toProcess.emailId,
                documentsAnalyzed: analyses.length,
                analyses,
                hasHighRiskDocuments,
                summary,
            };
            console.log(`[LegalAgent] ✅ Processamento concluído: ${analyses.length} documento(s) analisado(s)`);
            return {
                success: true,
                data: result,
                timestamp: new Date(),
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            console.error('[LegalAgent] ❌ Erro geral:', errorMessage);
            if (error instanceof Error && error.stack) {
                console.error('[LegalAgent] Stack:', error.stack);
            }
            return {
                success: false,
                error: errorMessage,
                timestamp: new Date(),
                duration: Date.now() - startTime,
            };
        }
    }
    /**
     * Verifica se um email parece discutir contratos.
     */
    isContractEmail(subject, body) {
        return this.analyzer.isContractDiscussion(`${subject} ${body}`);
    }
    /**
     * Gera resumo das análises.
     */
    generateSummary(analyses) {
        if (analyses.length === 0) {
            return 'Nenhum documento analisado';
        }
        const criticalCount = analyses.filter(a => a.overallRisk === 'critical').length;
        const highCount = analyses.filter(a => a.overallRisk === 'high').length;
        const attentionCount = analyses.filter(a => a.requiresAttention).length;
        let summary = `Analisados ${analyses.length} documento(s). `;
        if (criticalCount > 0) {
            summary += `⚠️ ${criticalCount} com risco CRÍTICO. `;
        }
        if (highCount > 0) {
            summary += `🔴 ${highCount} com risco ALTO. `;
        }
        if (attentionCount > 0) {
            summary += `${attentionCount} requer(em) atenção antes de assinar.`;
        }
        else {
            summary += 'Nenhum problema crítico identificado.';
        }
        return summary;
    }
    /**
     * Envia notificação para documentos de alto risco.
     */
    async notifyHighRisk(input, analyses) {
        if (!this.notifier)
            return;
        const highRiskDocs = analyses.filter(a => a.overallRisk === 'high' || a.overallRisk === 'critical');
        const message = highRiskDocs.map(doc => {
            const riskEmoji = doc.overallRisk === 'critical' ? '🚨' : '⚠️';
            return `${riskEmoji} **${doc.documentName}**\n` +
                `Risco: ${doc.overallRisk.toUpperCase()}\n` +
                `Problemas: ${doc.risks.length}\n` +
                `Resumo: ${doc.summary.substring(0, 200)}...`;
        }).join('\n\n');
        await this.notifier.notify(message, {
            title: `📜 Contratos de Alto Risco - ${input.emailSubject}`,
            priority: 'urgent',
        });
    }
    /**
     * Retorna quantidade de itens na fila.
     */
    getQueueSize() {
        return this.queue.length;
    }
}
//# sourceMappingURL=legal-agent.js.map