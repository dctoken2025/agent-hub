import { Agent, getAIClient } from '@agent-hub/core';
/**
 * Focus Agent - Agente de IA para análise de foco e priorização
 *
 * Analisa emails, tarefas, itens financeiros e jurídicos para gerar
 * briefings executivos e listas priorizadas por urgência real.
 */
export class FocusAgent extends Agent {
    _focusConfig;
    dataCollector;
    constructor(agentConfig, focusConfig = {}) {
        super(agentConfig);
        this._focusConfig = {
            dailyGenerationTime: '06:00',
            urgentDaysThreshold: 3,
            highValueThreshold: 500000, // R$ 5.000 em centavos
            ...focusConfig,
        };
    }
    get focusConfig() {
        return this._focusConfig;
    }
    /**
     * Define a função de coleta de dados (injetada pelo AgentManager)
     */
    setDataCollector(collector) {
        this.dataCollector = collector;
    }
    /**
     * Executa a análise de foco
     */
    async execute(input) {
        const scope = input?.scope || 'today';
        const userId = this.config.userId;
        if (!userId) {
            return {
                success: false,
                error: 'userId não configurado no agente',
                timestamp: new Date(),
                duration: 0,
            };
        }
        if (!this.dataCollector) {
            return {
                success: false,
                error: 'Coletor de dados não configurado',
                timestamp: new Date(),
                duration: 0,
            };
        }
        try {
            console.log(`[FocusAgent] Gerando briefing de ${scope} para usuário ${userId}`);
            // 1. Coleta dados de todas as fontes
            const collectedData = await this.dataCollector(userId, scope);
            const totalItems = collectedData.emails.length +
                collectedData.tasks.length +
                collectedData.financialItems.length +
                collectedData.legalItems.length;
            if (totalItems === 0) {
                const emptyBriefing = {
                    scope,
                    briefingText: scope === 'today'
                        ? '🎉 Parabéns! Você não tem itens pendentes para hoje. Aproveite o dia!'
                        : '🎉 Sua semana está livre de pendências. Bom trabalho!',
                    keyHighlights: [],
                    prioritizedItems: [],
                    totalItems: 0,
                    urgentCount: 0,
                    generatedAt: new Date(),
                    expiresAt: this.getExpirationDate(scope),
                };
                return {
                    success: true,
                    data: emptyBriefing,
                    timestamp: new Date(),
                    duration: 0,
                };
            }
            // 2. Envia para IA analisar e priorizar
            const briefing = await this.analyzeWithAI(collectedData, scope);
            console.log(`[FocusAgent] Briefing gerado: ${briefing.prioritizedItems.length} itens priorizados, ${briefing.urgentCount} urgentes`);
            return {
                success: true,
                data: briefing,
                timestamp: new Date(),
                duration: 0,
            };
        }
        catch (error) {
            console.error('[FocusAgent] Erro ao gerar briefing:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Erro desconhecido',
                timestamp: new Date(),
                duration: 0,
            };
        }
    }
    /**
     * Analisa os dados com IA e gera o briefing
     */
    async analyzeWithAI(data, scope) {
        const aiClient = getAIClient();
        const scopeDescription = scope === 'today' ? 'HOJE' : 'ESTA SEMANA';
        const currentDate = new Date().toLocaleDateString('pt-BR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const prompt = this.buildPrompt(data, scope, scopeDescription, currentDate);
        const response = await aiClient.chat([
            { role: 'user', content: prompt }
        ], this.getSystemPrompt());
        // Parse da resposta da IA
        const parsed = this.parseAIResponse(response.content, data, scope);
        return parsed;
    }
    /**
     * Constrói o prompt para a IA
     */
    buildPrompt(data, scope, scopeDescription, currentDate) {
        let prompt = `Data atual: ${currentDate}\n`;
        prompt += `Escopo de análise: ${scopeDescription}\n\n`;
        prompt += `=== DADOS PARA ANÁLISE ===\n\n`;
        // Emails
        if (data.emails.length > 0) {
            prompt += `📧 EMAILS PENDENTES (${data.emails.length}):\n`;
            data.emails.forEach((email, i) => {
                prompt += `${i + 1}. [ID:${email.id}] De: ${email.fromName || email.fromEmail}\n`;
                prompt += `   Assunto: ${email.subject}\n`;
                prompt += `   Prioridade: ${email.priority} | Ação: ${email.action}\n`;
                if (email.deadline)
                    prompt += `   Prazo mencionado: ${email.deadline}\n`;
                prompt += `   Data: ${new Date(email.emailDate).toLocaleDateString('pt-BR')}\n\n`;
            });
        }
        // Tarefas
        if (data.tasks.length > 0) {
            prompt += `✅ TAREFAS PENDENTES (${data.tasks.length}):\n`;
            data.tasks.forEach((task, i) => {
                prompt += `${i + 1}. [ID:${task.id}] ${task.title}\n`;
                prompt += `   Descrição: ${task.description.substring(0, 200)}...\n`;
                prompt += `   Stakeholder: ${task.stakeholderName}${task.stakeholderCompany ? ` (${task.stakeholderCompany})` : ''}\n`;
                prompt += `   Importância: ${task.stakeholderImportance} | Prioridade: ${task.priority}\n`;
                if (task.deadlineDate) {
                    prompt += `   Prazo: ${new Date(task.deadlineDate).toLocaleDateString('pt-BR')}\n`;
                }
                prompt += `   Origem: ${task.emailSubject}\n\n`;
            });
        }
        // Financeiro
        if (data.financialItems.length > 0) {
            prompt += `💰 ITENS FINANCEIROS (${data.financialItems.length}):\n`;
            data.financialItems.forEach((item, i) => {
                const amount = (item.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                prompt += `${i + 1}. [ID:${item.id}] ${item.type.toUpperCase()}: ${item.description}\n`;
                prompt += `   Credor: ${item.creditor}\n`;
                prompt += `   Valor: ${amount}\n`;
                if (item.dueDate) {
                    prompt += `   Vencimento: ${new Date(item.dueDate).toLocaleDateString('pt-BR')}\n`;
                }
                prompt += `   Status: ${item.status} | Prioridade: ${item.priority}\n`;
                if (item.requiresApproval)
                    prompt += `   ⚠️ REQUER APROVAÇÃO\n`;
                prompt += `\n`;
            });
        }
        // Jurídico
        if (data.legalItems.length > 0) {
            prompt += `⚖️ DOCUMENTOS JURÍDICOS (${data.legalItems.length}):\n`;
            data.legalItems.forEach((item, i) => {
                prompt += `${i + 1}. [ID:${item.id}] ${item.documentName}\n`;
                prompt += `   Tipo: ${item.documentType || 'Não especificado'}\n`;
                prompt += `   Risco: ${item.overallRisk.toUpperCase()}\n`;
                if (item.requiredAction)
                    prompt += `   Ação necessária: ${item.requiredAction}\n`;
                if (item.actionDeadline)
                    prompt += `   Prazo: ${item.actionDeadline}\n`;
                if (item.isUrgent)
                    prompt += `   ⚠️ URGENTE\n`;
                prompt += `\n`;
            });
        }
        prompt += `\n=== INSTRUÇÕES ===\n`;
        prompt += `Analise todos os itens acima e gere:\n`;
        prompt += `1. Um briefing executivo em português (máximo 3 parágrafos)\n`;
        prompt += `2. 3-5 highlights principais (frases curtas)\n`;
        prompt += `3. Lista de todos os itens com score de urgência (0-100) e nível (critical/high/medium/low)\n\n`;
        prompt += `Considere para urgência:\n`;
        prompt += `- Prazos que vencem ${scope === 'today' ? 'HOJE' : 'esta semana'}\n`;
        prompt += `- Valores financeiros acima de R$ 5.000\n`;
        prompt += `- Contratos de risco alto/crítico\n`;
        prompt += `- Stakeholders VIP ou de alta importância\n`;
        prompt += `- Itens que requerem aprovação\n\n`;
        prompt += `Responda APENAS com JSON válido no formato especificado.`;
        return prompt;
    }
    /**
     * Prompt de sistema para a IA
     */
    getSystemPrompt() {
        return `Você é um assistente executivo especializado em priorização e gestão de tempo.
Sua função é analisar emails, tarefas, pagamentos e documentos jurídicos para ajudar o usuário a focar no que realmente importa.

Responda SEMPRE em JSON válido com esta estrutura exata:
{
  "briefingText": "Texto do briefing executivo em português...",
  "keyHighlights": ["Highlight 1", "Highlight 2", "..."],
  "items": [
    {
      "id": 123,
      "type": "email|task|financial|legal",
      "title": "Título curto",
      "description": "Descrição breve",
      "urgencyScore": 85,
      "urgencyLevel": "critical|high|medium|low",
      "urgencyReason": "Motivo da urgência"
    }
  ]
}

Regras para urgencyScore:
- 90-100: Critical (vence hoje, risco crítico, valor muito alto)
- 70-89: High (vence em 1-2 dias, risco alto, stakeholder VIP)
- 40-69: Medium (vence esta semana, risco médio)
- 0-39: Low (sem prazo urgente, baixo risco)

Seja direto, prático e focado em ações concretas.`;
    }
    /**
     * Faz parse da resposta da IA
     */
    parseAIResponse(content, originalData, scope) {
        try {
            // Remove possíveis marcadores de código
            let jsonStr = content.trim();
            if (jsonStr.startsWith('```json')) {
                jsonStr = jsonStr.slice(7);
            }
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.slice(3);
            }
            if (jsonStr.endsWith('```')) {
                jsonStr = jsonStr.slice(0, -3);
            }
            const parsed = JSON.parse(jsonStr.trim());
            // Mapeia os itens da IA para FocusItem completos
            const prioritizedItems = (parsed.items || []).map((item) => {
                const focusItem = {
                    id: item.id,
                    type: item.type,
                    title: item.title,
                    description: item.description,
                    urgencyScore: item.urgencyScore,
                    urgencyLevel: item.urgencyLevel,
                    urgencyReason: item.urgencyReason,
                    originalData: this.findOriginalData(item.id, item.type, originalData),
                };
                // Adiciona dados extras baseado no tipo
                const original = focusItem.originalData;
                if (item.type === 'financial' && original.amount) {
                    focusItem.amount = original.amount;
                }
                if (item.type === 'financial' && original.dueDate) {
                    focusItem.deadline = new Date(original.dueDate);
                }
                if (item.type === 'task' && original.deadlineDate) {
                    focusItem.deadline = new Date(original.deadlineDate);
                }
                if (original.stakeholderName) {
                    focusItem.stakeholder = original.stakeholderName;
                }
                if (original.stakeholderImportance === 'vip') {
                    focusItem.isVip = true;
                }
                if (item.type === 'legal' && original.overallRisk) {
                    focusItem.riskLevel = original.overallRisk;
                }
                return focusItem;
            });
            // Ordena por urgencyScore decrescente
            prioritizedItems.sort((a, b) => b.urgencyScore - a.urgencyScore);
            const urgentCount = prioritizedItems.filter(item => item.urgencyLevel === 'critical' || item.urgencyLevel === 'high').length;
            return {
                scope,
                briefingText: parsed.briefingText || 'Briefing não disponível.',
                keyHighlights: parsed.keyHighlights || [],
                prioritizedItems,
                totalItems: prioritizedItems.length,
                urgentCount,
                generatedAt: new Date(),
                expiresAt: this.getExpirationDate(scope),
            };
        }
        catch (error) {
            console.error('[FocusAgent] Erro ao fazer parse da resposta da IA:', error);
            console.error('[FocusAgent] Conteúdo recebido:', content);
            // Fallback: retorna itens sem análise de IA
            return this.createFallbackBriefing(originalData, scope);
        }
    }
    /**
     * Encontra os dados originais de um item
     */
    findOriginalData(id, type, data) {
        switch (type) {
            case 'email':
                return (data.emails.find(e => e.id === id) || {});
            case 'task':
                return (data.tasks.find(t => t.id === id) || {});
            case 'financial':
                return (data.financialItems.find(f => f.id === id) || {});
            case 'legal':
                return (data.legalItems.find(l => l.id === id) || {});
            default:
                return {};
        }
    }
    /**
     * Cria briefing de fallback sem IA
     */
    createFallbackBriefing(data, scope) {
        const items = [];
        // Adiciona emails urgentes
        data.emails
            .filter(e => e.priority === 'urgent' || e.priority === 'attention')
            .forEach(email => {
            items.push({
                id: email.id,
                type: 'email',
                title: email.subject || 'Email sem assunto',
                description: `De: ${email.fromName || email.fromEmail}`,
                urgencyScore: email.priority === 'urgent' ? 80 : 60,
                urgencyLevel: email.priority === 'urgent' ? 'high' : 'medium',
                urgencyReason: 'Email requer atenção',
                originalData: email,
            });
        });
        // Adiciona tarefas pendentes
        data.tasks
            .filter(t => t.status === 'pending' || t.status === 'in_progress')
            .forEach(task => {
            items.push({
                id: task.id,
                type: 'task',
                title: task.title,
                description: task.description.substring(0, 100),
                urgencyScore: task.priority === 'critical' ? 90 : task.priority === 'high' ? 70 : 50,
                urgencyLevel: task.priority === 'critical' ? 'critical' : task.priority === 'high' ? 'high' : 'medium',
                urgencyReason: `Stakeholder: ${task.stakeholderName}`,
                stakeholder: task.stakeholderName,
                isVip: task.stakeholderImportance === 'vip',
                deadline: task.deadlineDate,
                originalData: task,
            });
        });
        // Adiciona itens financeiros pendentes
        data.financialItems
            .filter(f => f.status === 'pending')
            .forEach(fin => {
            items.push({
                id: fin.id,
                type: 'financial',
                title: `${fin.type}: ${fin.creditor}`,
                description: fin.description.substring(0, 100),
                urgencyScore: fin.priority === 'urgent' ? 90 : fin.priority === 'high' ? 75 : 50,
                urgencyLevel: fin.priority === 'urgent' ? 'critical' : fin.priority === 'high' ? 'high' : 'medium',
                urgencyReason: `Valor: R$ ${(fin.amount / 100).toFixed(2)}`,
                amount: fin.amount,
                deadline: fin.dueDate,
                originalData: fin,
            });
        });
        // Adiciona itens jurídicos pendentes
        data.legalItems
            .filter(l => l.status === 'pending')
            .forEach(legal => {
            items.push({
                id: legal.id,
                type: 'legal',
                title: legal.documentName,
                description: legal.summary?.substring(0, 100) || 'Documento jurídico',
                urgencyScore: legal.overallRisk === 'critical' ? 95 : legal.overallRisk === 'high' ? 80 : 50,
                urgencyLevel: legal.overallRisk === 'critical' ? 'critical' : legal.overallRisk === 'high' ? 'high' : 'medium',
                urgencyReason: `Risco: ${legal.overallRisk}`,
                riskLevel: legal.overallRisk,
                originalData: legal,
            });
        });
        items.sort((a, b) => b.urgencyScore - a.urgencyScore);
        const urgentCount = items.filter(item => item.urgencyLevel === 'critical' || item.urgencyLevel === 'high').length;
        return {
            scope,
            briefingText: `Você tem ${items.length} itens pendentes${urgentCount > 0 ? `, sendo ${urgentCount} urgentes` : ''}. Revise a lista abaixo para priorizar suas ações.`,
            keyHighlights: urgentCount > 0
                ? [`${urgentCount} itens requerem atenção urgente`]
                : ['Nenhum item crítico identificado'],
            prioritizedItems: items,
            totalItems: items.length,
            urgentCount,
            generatedAt: new Date(),
            expiresAt: this.getExpirationDate(scope),
        };
    }
    /**
     * Calcula a data de expiração do briefing
     */
    getExpirationDate(scope) {
        const now = new Date();
        if (scope === 'today') {
            // Expira à meia-noite
            const expiration = new Date(now);
            expiration.setHours(23, 59, 59, 999);
            return expiration;
        }
        else {
            // Expira no domingo à meia-noite
            const expiration = new Date(now);
            const daysUntilSunday = 7 - expiration.getDay();
            expiration.setDate(expiration.getDate() + daysUntilSunday);
            expiration.setHours(23, 59, 59, 999);
            return expiration;
        }
    }
}
//# sourceMappingURL=focus-agent.js.map