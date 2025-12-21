import OpenAI from 'openai';
/**
 * Provider para OpenAI (GPT).
 */
export class OpenAIProvider {
    name = 'openai';
    model;
    client;
    maxTokens;
    constructor(options) {
        this.client = new OpenAI({
            apiKey: options?.apiKey || process.env.OPENAI_API_KEY,
        });
        this.model = options?.model || 'gpt-4o';
        this.maxTokens = options?.maxTokens || 4096;
    }
    async chat(messages, systemPrompt) {
        const openaiMessages = [];
        if (systemPrompt) {
            openaiMessages.push({ role: 'system', content: systemPrompt });
        }
        for (const m of messages) {
            openaiMessages.push({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content,
            });
        }
        const response = await this.client.chat.completions.create({
            model: this.model,
            max_tokens: this.maxTokens,
            messages: openaiMessages,
        });
        const choice = response.choices[0];
        return {
            content: choice?.message?.content || '',
            usage: {
                inputTokens: response.usage?.prompt_tokens || 0,
                outputTokens: response.usage?.completion_tokens || 0,
            },
        };
    }
    async chatWithTools(messages, tools, systemPrompt) {
        const openaiMessages = [];
        if (systemPrompt) {
            openaiMessages.push({ role: 'system', content: systemPrompt });
        }
        for (const m of messages) {
            openaiMessages.push({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content,
            });
        }
        // Converte tools para formato OpenAI
        const openaiTools = tools.map(t => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.input_schema,
            },
        }));
        const response = await this.client.chat.completions.create({
            model: this.model,
            max_tokens: this.maxTokens,
            messages: openaiMessages,
            tools: openaiTools,
            tool_choice: 'auto',
        });
        const choice = response.choices[0];
        const toolCalls = choice?.message?.tool_calls || [];
        return {
            content: choice?.message?.content || '',
            toolCalls: toolCalls.map(tc => ({
                id: tc.id,
                name: tc.function.name,
                input: JSON.parse(tc.function.arguments || '{}'),
            })),
            usage: {
                inputTokens: response.usage?.prompt_tokens || 0,
                outputTokens: response.usage?.completion_tokens || 0,
            },
        };
    }
    async analyze(text, instruction, schema) {
        const response = await this.chatWithTools([{ role: 'user', content: `${instruction}\n\nTexto para análise:\n${text}` }], [schema]);
        if (response.toolCalls && response.toolCalls.length > 0) {
            return response.toolCalls[0].input;
        }
        return null;
    }
}
//# sourceMappingURL=openai.js.map