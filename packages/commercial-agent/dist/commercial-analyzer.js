import { getAIClient } from '@agent-hub/core';
import { CommercialAnalysisSchema } from './types.js';
/**
 * Analisador de emails comerciais usando Claude AI.
 */
export class CommercialAnalyzer {
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * Verifica rapidamente se um email parece ser comercial.
     */
    isCommercialEmail(subject, body) {
        const content = `${subject} ${body}`.toLowerCase();
        return this.config.commercialKeywords.some(keyword => content.includes(keyword.toLowerCase()));
    }
    /**
     * Analisa um email comercial usando IA.
     */
    async analyze(emailSubject, emailBody, emailId, threadId, emailFrom, emailDate) {
        const aiClient = getAIClient();
        const emailContext = this.buildEmailContext(emailSubject, emailBody, emailFrom, emailDate);
        const systemPrompt = this.buildSystemPrompt();
        const result = await aiClient.analyze(emailContext, systemPrompt + '\n\nAnalise este email comercial e extraia informações estruturadas.', CommercialAnalysisSchema);
        if (!result || !result.items) {
            console.log('[CommercialAnalyzer] IA não retornou itens');
            return [];
        }
        // Converte resultado da IA para CommercialItem[]
        return result.items.map(item => ({
            emailId,
            threadId,
            emailSubject,
            emailFrom,
            emailDate,
            type: item.type,
            status: 'new',
            clientName: item.clientName,
            clientCompany: item.clientCompany,
            clientEmail: item.clientEmail || emailFrom,
            clientPhone: item.clientPhone,
            clientType: item.clientType,
            title: item.title,
            description: item.description,
            productsServices: item.productsServices,
            estimatedValue: item.estimatedValue,
            currency: item.currency || 'BRL',
            quantity: item.quantity,
            deadlineDate: item.deadlineDate,
            desiredDeliveryDate: item.desiredDeliveryDate,
            hasCompetitors: item.hasCompetitors,
            competitorNames: item.competitorNames,
            isUrgentBid: item.isUrgentBid,
            priority: this.adjustPriority(item),
            priorityReason: item.priorityReason,
            suggestedAction: item.suggestedAction,
            suggestedResponse: item.suggestedResponse,
            tags: item.tags,
            confidence: item.confidence,
            analyzedAt: new Date(),
        }));
    }
    /**
     * Ajusta a prioridade baseado em regras adicionais.
     */
    adjustPriority(item) {
        // Cliente VIP = sempre alta prioridade
        const isVip = this.config.vipClients.some(vip => {
            const searchText = `${item.clientName} ${item.clientCompany || ''} ${item.clientEmail || ''}`.toLowerCase();
            return searchText.includes(vip.toLowerCase());
        });
        if (isVip) {
            return 'critical';
        }
        // Valor alto = aumenta prioridade
        if (item.estimatedValue && item.estimatedValue >= this.config.highValueThreshold) {
            return item.priority === 'low' ? 'normal' : item.priority === 'normal' ? 'high' : 'critical';
        }
        // Licitação urgente = alta prioridade
        if (item.isUrgentBid) {
            return 'high';
        }
        return item.priority;
    }
    /**
     * Monta contexto do email para análise.
     */
    buildEmailContext(emailSubject, emailBody, emailFrom, emailDate) {
        return `
=== INFORMAÇÕES DO EMAIL ===
De: ${emailFrom || 'Não informado'}
Assunto: ${emailSubject}
Data: ${emailDate?.toISOString() || 'Não informada'}

=== CORPO DO EMAIL ===
${emailBody.substring(0, 6000)}${emailBody.length > 6000 ? '\n[...truncado...]' : ''}

=== PRODUTOS/SERVIÇOS DA EMPRESA ===
${this.config.productsServices.length > 0 ? this.config.productsServices.join(', ') : 'Não especificados'}

=== CLIENTES VIP ===
${this.config.vipClients.length > 0 ? this.config.vipClients.join(', ') : 'Nenhum configurado'}
    `.trim();
    }
    /**
     * System prompt para análise comercial.
     */
    buildSystemPrompt() {
        let basePrompt = `Você é um assistente especializado em análise comercial e vendas.`;
        // Adiciona contexto personalizado
        if (this.config.customContext) {
            basePrompt = `Você é um assistente especializado em análise comercial e vendas.

═══════════════════════════════════════════════════════════════
CONTEXTO DA EMPRESA (Use para personalizar a análise)
═══════════════════════════════════════════════════════════════

${this.config.customContext}

═══════════════════════════════════════════════════════════════`;
        }
        return basePrompt + `

Seu objetivo é analisar emails relacionados ao processo comercial de vendas e extrair informações estruturadas para o time comercial.

═══════════════════════════════════════════════════════════════
TIPOS DE EMAILS COMERCIAIS
═══════════════════════════════════════════════════════════════

1. PEDIDO DE COTAÇÃO (quote_request)
   - Cliente solicitando preços, orçamentos
   - Perguntas sobre condições comerciais
   - RFQ (Request for Quotation)

2. PROPOSTA COMERCIAL (proposal)
   - Envio ou discussão de propostas
   - Termos e condições comerciais

3. NEGOCIAÇÃO (negotiation)
   - Discussão de preços, prazos, condições
   - Pedidos de desconto
   - Contra-propostas

4. PEDIDO CONFIRMADO (order)
   - Confirmação de compra
   - Pedidos formalizados

5. FOLLOW-UP (follow_up)
   - Acompanhamento de proposta enviada
   - Cobrança de resposta

6. RECLAMAÇÃO (complaint)
   - Problemas com pedidos, entregas
   - Insatisfação do cliente

7. RENOVAÇÃO (renewal)
   - Renovação de contratos/serviços
   - Prorrogação de acordos

8. OPORTUNIDADE (opportunity)
   - Contato inicial de prospect
   - Interesse em parceria/distribuição

═══════════════════════════════════════════════════════════════
PRIORIZAÇÃO
═══════════════════════════════════════════════════════════════

🔴 CRITICAL (Crítico)
   - Cliente VIP
   - Valor muito alto
   - Licitação com prazo apertado
   - Risco de perder negócio

🟠 HIGH (Alto)
   - Pedido de cotação com prazo definido
   - Valor significativo
   - Cliente estratégico
   - Concorrência mencionada

🟡 NORMAL
   - Solicitações padrão
   - Prazo razoável
   - Cliente regular

🟢 LOW (Baixo)
   - Consultas informativas
   - Sem urgência
   - Prospects iniciais

═══════════════════════════════════════════════════════════════
EXTRAÇÃO DE DADOS
═══════════════════════════════════════════════════════════════

Extraia com cuidado:
- Nome e empresa do contato
- Produtos/serviços mencionados
- Quantidades e especificações
- Valores mencionados (converter para centavos)
- Prazos e datas limite
- Menções a concorrentes
- Tom do email (urgente, neutro, insatisfeito)

═══════════════════════════════════════════════════════════════
AÇÕES SUGERIDAS
═══════════════════════════════════════════════════════════════

Sugira ações práticas como:
- "Responder em até 4 horas" (urgente)
- "Preparar proposta detalhada"
- "Agendar reunião de qualificação"
- "Consultar estoque/disponibilidade"
- "Escalar para gerente comercial"
- "Enviar catálogo/portfólio"

═══════════════════════════════════════════════════════════════
TAGS SUGERIDAS
═══════════════════════════════════════════════════════════════

Use tags como:
- licitacao, pregao
- urgente, prazo_curto
- grande_valor, alto_volume
- novo_cliente, cliente_vip
- concorrencia
- renovacao, upsell
- reclamacao, problema

Seja preciso e objetivo. O time comercial precisa de informações claras para agir rapidamente.`;
    }
}
//# sourceMappingURL=commercial-analyzer.js.map