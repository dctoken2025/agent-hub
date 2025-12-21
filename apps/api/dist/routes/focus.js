import { getDb, focusBriefings, classifiedEmails, actionItems, financialItems, legalAnalyses, commercialItems, userConfigs } from '../db/index.js';
import { eq, and, gte, lte, or, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { getAIClient } from '@agent-hub/core';
export const focusRoutes = async (app) => {
    // ===========================================
    // GET /api/focus/today - Briefing do dia
    // ===========================================
    app.get('/today', { preHandler: [authMiddleware] }, async (request, reply) => {
        const userId = request.user.id;
        return await getBriefing(userId, 'today', reply);
    });
    // ===========================================
    // GET /api/focus/week - Briefing da semana
    // ===========================================
    app.get('/week', { preHandler: [authMiddleware] }, async (request, reply) => {
        const userId = request.user.id;
        return await getBriefing(userId, 'week', reply);
    });
    // ===========================================
    // POST /api/focus/refresh - Força regeneração
    // ===========================================
    app.post('/refresh', { preHandler: [authMiddleware] }, async (request, reply) => {
        const userId = request.user.id;
        const scope = request.body?.scope || 'today';
        try {
            const briefing = await generateBriefing(userId, scope);
            return { success: true, data: briefing };
        }
        catch (error) {
            console.error('[Focus] Erro ao gerar briefing:', error);
            return reply.status(500).send({
                error: 'Erro ao gerar briefing',
                details: error instanceof Error ? error.message : 'Erro desconhecido'
            });
        }
    });
};
/**
 * Obtém briefing do cache ou gera um novo
 */
async function getBriefing(userId, scope, reply) {
    const db = getDb();
    if (!db) {
        return reply.status(500).send({ error: 'Banco de dados não disponível' });
    }
    try {
        // Verifica cache
        const now = new Date();
        const [cached] = await db
            .select()
            .from(focusBriefings)
            .where(and(eq(focusBriefings.userId, userId), eq(focusBriefings.scope, scope), gte(focusBriefings.expiresAt, now)))
            .orderBy(desc(focusBriefings.generatedAt))
            .limit(1);
        if (cached) {
            return {
                cached: true,
                data: {
                    scope: cached.scope,
                    briefingText: cached.briefingText,
                    keyHighlights: cached.keyHighlights,
                    prioritizedItems: cached.prioritizedItems,
                    totalItems: cached.totalItems,
                    urgentCount: cached.urgentCount,
                    generatedAt: cached.generatedAt,
                    expiresAt: cached.expiresAt,
                }
            };
        }
        // Gera novo briefing
        const briefing = await generateBriefing(userId, scope);
        return { cached: false, data: briefing };
    }
    catch (error) {
        console.error('[Focus] Erro ao obter briefing:', error);
        return reply.status(500).send({
            error: 'Erro ao obter briefing',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
}
/**
 * Gera um novo briefing usando IA
 */
async function generateBriefing(userId, scope) {
    const db = getDb();
    if (!db)
        throw new Error('Banco de dados não disponível');
    console.log(`[Focus] Gerando briefing de ${scope} para usuário ${userId}`);
    // 1. Coleta dados
    const collectedData = await collectData(userId, scope);
    const totalItems = collectedData.emails.length +
        collectedData.tasks.length +
        collectedData.financialItems.length +
        collectedData.legalItems.length +
        collectedData.commercialItems.length;
    // Se não há itens, retorna briefing vazio
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
            expiresAt: getExpirationDate(scope),
        };
        // Salva no cache
        await db.insert(focusBriefings).values({
            userId,
            scope,
            briefingText: emptyBriefing.briefingText,
            keyHighlights: emptyBriefing.keyHighlights,
            prioritizedItems: emptyBriefing.prioritizedItems,
            totalItems: emptyBriefing.totalItems,
            urgentCount: emptyBriefing.urgentCount,
            generatedAt: emptyBriefing.generatedAt,
            expiresAt: emptyBriefing.expiresAt,
        });
        return emptyBriefing;
    }
    // 2. Analisa com IA
    const briefing = await analyzeWithAI(collectedData, scope);
    // 3. Salva no cache
    await db.insert(focusBriefings).values({
        userId,
        scope,
        briefingText: briefing.briefingText,
        keyHighlights: briefing.keyHighlights,
        prioritizedItems: briefing.prioritizedItems,
        totalItems: briefing.totalItems,
        urgentCount: briefing.urgentCount,
        generatedAt: briefing.generatedAt,
        expiresAt: briefing.expiresAt,
    });
    console.log(`[Focus] Briefing gerado: ${briefing.prioritizedItems.length} itens, ${briefing.urgentCount} urgentes`);
    return briefing;
}
/**
 * Coleta dados de todas as fontes
 */
async function collectData(userId, scope) {
    const db = getDb();
    if (!db)
        throw new Error('Banco de dados não disponível');
    const now = new Date();
    const endDate = scope === 'today'
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    // Emails não lidos ou que requerem ação
    const emails = await db
        .select()
        .from(classifiedEmails)
        .where(and(eq(classifiedEmails.userId, userId), eq(classifiedEmails.isArchived, false), or(eq(classifiedEmails.isRead, false), eq(classifiedEmails.requiresAction, true)), or(eq(classifiedEmails.priority, 'urgent'), eq(classifiedEmails.priority, 'attention'))))
        .orderBy(desc(classifiedEmails.emailDate))
        .limit(20);
    // Tarefas pendentes
    const tasks = await db
        .select()
        .from(actionItems)
        .where(and(eq(actionItems.userId, userId), or(eq(actionItems.status, 'pending'), eq(actionItems.status, 'in_progress'), eq(actionItems.status, 'waiting'))))
        .orderBy(desc(actionItems.createdAt))
        .limit(30);
    // Itens financeiros pendentes com vencimento no período
    const financial = await db
        .select()
        .from(financialItems)
        .where(and(eq(financialItems.userId, userId), eq(financialItems.status, 'pending'), lte(financialItems.dueDate, endDate)))
        .orderBy(financialItems.dueDate)
        .limit(20);
    // Análises jurídicas pendentes
    const legal = await db
        .select()
        .from(legalAnalyses)
        .where(and(eq(legalAnalyses.userId, userId), eq(legalAnalyses.status, 'pending')))
        .orderBy(desc(legalAnalyses.analyzedAt))
        .limit(10);
    // Itens comerciais pendentes (cotações, leads, vendas)
    const commercial = await db
        .select()
        .from(commercialItems)
        .where(and(eq(commercialItems.userId, userId), or(eq(commercialItems.status, 'pending'), eq(commercialItems.status, 'in_progress'))))
        .orderBy(desc(commercialItems.createdAt))
        .limit(20);
    // Carrega VIP senders do usuário
    const [userConfig] = await db
        .select({ vipSenders: userConfigs.vipSenders })
        .from(userConfigs)
        .where(eq(userConfigs.userId, userId))
        .limit(1);
    const vipSenders = userConfig?.vipSenders || [];
    return {
        emails: emails.map(e => ({
            id: e.id,
            emailId: e.emailId,
            subject: e.subject || '',
            fromEmail: e.fromEmail,
            fromName: e.fromName || undefined,
            priority: e.priority,
            action: e.action,
            requiresAction: e.requiresAction || false,
            deadline: e.deadline || undefined,
            emailDate: e.emailDate || new Date(),
            isRead: e.isRead || false,
            snippet: e.snippet || undefined,
            isVip: vipSenders.includes(e.fromEmail),
        })),
        tasks: tasks.map(t => ({
            id: t.id,
            title: t.title,
            description: t.description,
            category: t.category,
            deadlineDate: t.deadlineDate || undefined,
            deadlineUrgency: t.deadlineUrgency || undefined,
            status: t.status,
            priority: t.priority,
            stakeholderName: t.stakeholderName,
            stakeholderCompany: t.stakeholderCompany || undefined,
            stakeholderImportance: t.stakeholderImportance || 'normal',
            emailSubject: t.emailSubject,
            emailFrom: t.emailFrom,
        })),
        financialItems: financial.map(f => ({
            id: f.id,
            type: f.type,
            description: f.description,
            creditor: f.creditor,
            amount: f.amount,
            dueDate: f.dueDate || undefined,
            status: f.status,
            priority: f.priority || 'normal',
            requiresApproval: f.requiresApproval || false,
            emailSubject: f.emailSubject || undefined,
        })),
        legalItems: legal.map(l => ({
            id: l.id,
            documentName: l.documentName,
            documentType: l.documentType || undefined,
            summary: l.summary || undefined,
            overallRisk: l.overallRisk,
            requiredAction: l.requiredAction || undefined,
            actionDeadline: l.actionDeadline || undefined,
            isUrgent: l.isUrgent || false,
            status: l.status || 'pending',
            parties: l.parties || undefined,
        })),
        commercialItems: commercial.map(c => ({
            id: c.id,
            type: c.type,
            status: c.status,
            priority: c.priority || 'normal',
            companyName: c.clientCompany || undefined,
            contactName: c.clientName || undefined,
            contactEmail: c.clientEmail || undefined,
            productService: c.productsServices || undefined,
            requestedAmount: c.estimatedValue || undefined,
            currency: c.currency || 'BRL',
            deadline: c.deadlineDate || undefined,
            details: c.description || undefined,
            suggestedAction: c.suggestedAction || undefined,
            emailSubject: c.emailSubject || undefined,
            emailFrom: c.emailFrom || undefined,
            analyzedAt: c.createdAt || undefined,
        })),
    };
}
/**
 * Analisa dados com IA
 */
async function analyzeWithAI(data, scope) {
    const aiClient = getAIClient();
    const scopeDescription = scope === 'today' ? 'HOJE' : 'ESTA SEMANA';
    const currentDate = new Date().toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const prompt = buildPrompt(data, scopeDescription, currentDate);
    const response = await aiClient.chat([
        { role: 'user', content: prompt }
    ], getSystemPrompt());
    return parseAIResponse(response.content, data, scope);
}
/**
 * Constrói o prompt para a IA
 */
function buildPrompt(data, scopeDescription, currentDate) {
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
    // Comercial
    if (data.commercialItems.length > 0) {
        prompt += `💼 OPORTUNIDADES COMERCIAIS (${data.commercialItems.length}):\n`;
        data.commercialItems.forEach((item, i) => {
            const amount = item.requestedAmount
                ? (item.requestedAmount / 100).toLocaleString('pt-BR', { style: 'currency', currency: item.currency || 'BRL' })
                : 'Não informado';
            const typeLabels = {
                quotation_request: 'Cotação',
                sales_inquiry: 'Consulta de Vendas',
                order_confirmation: 'Confirmação de Pedido',
                lead: 'Lead',
                other: 'Outro',
            };
            prompt += `${i + 1}. [ID:${item.id}] ${typeLabels[item.type] || item.type}: ${item.companyName || item.contactName || 'Cliente'}\n`;
            if (item.productService)
                prompt += `   Produto/Serviço: ${item.productService}\n`;
            prompt += `   Valor Estimado: ${amount}\n`;
            prompt += `   Prioridade: ${item.priority.toUpperCase()}\n`;
            if (item.deadline) {
                prompt += `   Prazo: ${new Date(item.deadline).toLocaleDateString('pt-BR')}\n`;
            }
            if (item.suggestedAction)
                prompt += `   Ação sugerida: ${item.suggestedAction}\n`;
            if (item.priority === 'urgent' || item.priority === 'high')
                prompt += `   ⚠️ ALTA PRIORIDADE\n`;
            prompt += `\n`;
        });
    }
    prompt += `\n=== INSTRUÇÕES ===\n`;
    prompt += `Analise todos os itens acima e gere:\n`;
    prompt += `1. Um briefing executivo em português (máximo 3 parágrafos)\n`;
    prompt += `2. 3-5 highlights principais (frases curtas)\n`;
    prompt += `3. Lista de todos os itens com score de urgência (0-100) e nível (critical/high/medium/low)\n\n`;
    prompt += `Responda APENAS com JSON válido no formato especificado.`;
    return prompt;
}
/**
 * Prompt de sistema
 */
function getSystemPrompt() {
    return `Você é um assistente executivo especializado em priorização e gestão de tempo.
Sua função é analisar emails, tarefas, pagamentos e documentos jurídicos para ajudar o usuário a focar no que realmente importa.

Responda SEMPRE em JSON válido com esta estrutura exata:
{
  "briefingText": "Texto do briefing executivo em português...",
  "keyHighlights": ["Highlight 1", "Highlight 2", "..."],
  "items": [
    {
      "id": 123,
      "type": "email|task|financial|legal|commercial",
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
function parseAIResponse(content, originalData, scope) {
    try {
        let jsonStr = content.trim();
        if (jsonStr.startsWith('```json'))
            jsonStr = jsonStr.slice(7);
        if (jsonStr.startsWith('```'))
            jsonStr = jsonStr.slice(3);
        if (jsonStr.endsWith('```'))
            jsonStr = jsonStr.slice(0, -3);
        const parsed = JSON.parse(jsonStr.trim());
        const prioritizedItems = (parsed.items || []).map((item) => {
            const focusItem = {
                id: item.id,
                type: item.type,
                title: item.title,
                description: item.description,
                urgencyScore: item.urgencyScore,
                urgencyLevel: item.urgencyLevel,
                urgencyReason: item.urgencyReason,
                originalData: findOriginalData(item.id, item.type, originalData),
            };
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
            if (item.type === 'commercial' && original.requestedAmount) {
                focusItem.amount = original.requestedAmount;
            }
            if (item.type === 'commercial' && original.deadline) {
                focusItem.deadline = new Date(original.deadline);
            }
            if (item.type === 'commercial' && (original.companyName || original.contactName)) {
                focusItem.stakeholder = (original.companyName || original.contactName);
            }
            return focusItem;
        });
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
            expiresAt: getExpirationDate(scope),
        };
    }
    catch (error) {
        console.error('[Focus] Erro ao fazer parse da resposta da IA:', error);
        return createFallbackBriefing(originalData, scope);
    }
}
function findOriginalData(id, type, data) {
    switch (type) {
        case 'email':
            return (data.emails.find(e => e.id === id) || {});
        case 'task':
            return (data.tasks.find(t => t.id === id) || {});
        case 'financial':
            return (data.financialItems.find(f => f.id === id) || {});
        case 'legal':
            return (data.legalItems.find(l => l.id === id) || {});
        case 'commercial':
            return (data.commercialItems.find(c => c.id === id) || {});
        default:
            return {};
    }
}
function createFallbackBriefing(data, scope) {
    const items = [];
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
    // Itens comerciais
    data.commercialItems
        .filter(c => c.status === 'pending' || c.status === 'in_progress')
        .forEach(commercial => {
        const typeLabels = {
            quotation_request: 'Cotação',
            sales_inquiry: 'Consulta de Vendas',
            order_confirmation: 'Confirmação de Pedido',
            lead: 'Lead',
            other: 'Outro',
        };
        items.push({
            id: commercial.id,
            type: 'commercial',
            title: `${typeLabels[commercial.type] || commercial.type}: ${commercial.companyName || commercial.contactName || 'Cliente'}`,
            description: commercial.productService?.substring(0, 100) || commercial.details?.substring(0, 100) || 'Oportunidade comercial',
            urgencyScore: commercial.priority === 'urgent' ? 90 : commercial.priority === 'high' ? 75 : 50,
            urgencyLevel: commercial.priority === 'urgent' ? 'critical' : commercial.priority === 'high' ? 'high' : 'medium',
            urgencyReason: commercial.suggestedAction || `Oportunidade de ${typeLabels[commercial.type] || commercial.type}`,
            amount: commercial.requestedAmount,
            deadline: commercial.deadline,
            stakeholder: commercial.companyName || commercial.contactName,
            originalData: commercial,
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
        expiresAt: getExpirationDate(scope),
    };
}
function getExpirationDate(scope) {
    const now = new Date();
    if (scope === 'today') {
        const expiration = new Date(now);
        expiration.setHours(23, 59, 59, 999);
        return expiration;
    }
    else {
        const expiration = new Date(now);
        const daysUntilSunday = 7 - expiration.getDay();
        expiration.setDate(expiration.getDate() + daysUntilSunday);
        expiration.setHours(23, 59, 59, 999);
        return expiration;
    }
}
//# sourceMappingURL=focus.js.map