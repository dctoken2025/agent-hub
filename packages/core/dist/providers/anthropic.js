import Anthropic from '@anthropic-ai/sdk';
/**
 * Provider para Anthropic (Claude).
 */
export class AnthropicProvider {
    name = 'anthropic';
    model;
    client;
    maxTokens;
    constructor(options) {
        this.client = new Anthropic({
            apiKey: options?.apiKey || process.env.ANTHROPIC_API_KEY,
        });
        this.model = options?.model || 'claude-sonnet-4-20250514';
        this.maxTokens = options?.maxTokens || 4096;
    }
    async chat(messages, systemPrompt) {
        const response = await this.client.messages.create({
            model: this.model,
            max_tokens: this.maxTokens,
            system: systemPrompt,
            messages: messages.map(m => ({
                role: m.role,
                content: m.content,
            })),
        });
        const textContent = response.content.find(c => c.type === 'text');
        return {
            content: textContent?.type === 'text' ? textContent.text : '',
            usage: {
                inputTokens: response.usage.input_tokens,
                outputTokens: response.usage.output_tokens,
            },
        };
    }
    async chatWithTools(messages, tools, systemPrompt) {
        const response = await this.client.messages.create({
            model: this.model,
            max_tokens: this.maxTokens,
            system: systemPrompt,
            tools: tools.map(t => ({
                name: t.name,
                description: t.description,
                input_schema: t.input_schema,
            })),
            messages: messages.map(m => ({
                role: m.role,
                content: m.content,
            })),
        });
        const textContent = response.content.find(c => c.type === 'text');
        const toolUseBlocks = response.content.filter(c => c.type === 'tool_use');
        return {
            content: textContent?.type === 'text' ? textContent.text : '',
            toolCalls: toolUseBlocks.map(block => {
                if (block.type === 'tool_use') {
                    return {
                        id: block.id,
                        name: block.name,
                        input: block.input,
                    };
                }
                return { id: '', name: '', input: {} };
            }).filter(t => t.id !== ''),
            usage: {
                inputTokens: response.usage.input_tokens,
                outputTokens: response.usage.output_tokens,
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
//# sourceMappingURL=anthropic.js.map