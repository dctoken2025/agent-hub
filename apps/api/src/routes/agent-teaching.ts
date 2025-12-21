import type { FastifyPluginAsync } from 'fastify';
import { getDb, userConfigs } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import Anthropic from '@anthropic-ai/sdk';

// Configuração de perguntas por tipo de agente
const AGENT_QUESTIONS_CONFIG: Record<string, {
  systemPrompt: string;
  examples: string[];
}> = {
  'email-agent': {
    systemPrompt: `Você é um assistente que ajuda a personalizar um agente de emails inteligente.
Seu objetivo é fazer 5 perguntas estratégicas para entender melhor o contexto do usuário e como ele quer que seus emails sejam triados.

As perguntas devem cobrir:
1. Tipo de trabalho/área de atuação (para entender contexto profissional)
2. Quem são as pessoas VIP que devem ter prioridade máxima
3. Tipos de emails que devem ser ignorados ou arquivados automaticamente
4. Urgências típicas no dia a dia (reuniões, prazos, clientes)
5. Preferências de organização e workflow

Para cada pergunta, sugira 3 opções de resposta relevantes + permita resposta customizada.`,
    examples: [
      'CEO/Executivo de empresa',
      'Advogado/Jurídico',
      'Desenvolvedor/Tech',
      'Freelancer/Autônomo',
    ],
  },
  'legal-agent': {
    systemPrompt: `Você é um assistente que ajuda a personalizar um agente de análise jurídica/contratos.
Seu objetivo é fazer 5 perguntas estratégicas para entender melhor o contexto jurídico do usuário.

As perguntas devem cobrir:
1. Área de atuação (empresarial, trabalhista, civil, etc)
2. Tipos de contratos mais comuns que recebe
3. Cláusulas que são red flags para o negócio
4. Valores que requerem aprovação especial
5. Processos de revisão e aprovação existentes

Para cada pergunta, sugira 3 opções de resposta relevantes + permita resposta customizada.`,
    examples: [
      'Contratos de prestação de serviços',
      'NDAs e confidencialidade',
      'Contratos trabalhistas',
    ],
  },
  'financial-agent': {
    systemPrompt: `Você é um assistente que ajuda a personalizar um agente de análise financeira.
Seu objetivo é fazer 5 perguntas estratégicas para entender melhor o contexto financeiro do usuário.

As perguntas devem cobrir:
1. Tipo de negócio e volume de pagamentos
2. Fornecedores/credores recorrentes importantes
3. Limites de valor que precisam aprovação
4. Categorias de despesas mais comuns
5. Processos de aprovação de pagamentos

Para cada pergunta, sugira 3 opções de resposta relevantes + permita resposta customizada.`,
    examples: [
      'Startup/Empresa pequena',
      'Empresa média',
      'Autônomo/PJ',
    ],
  },
  'stablecoin-agent': {
    systemPrompt: `Você é um assistente que ajuda a personalizar um agente de monitoramento de stablecoins.
Seu objetivo é fazer 5 perguntas estratégicas para entender o contexto de cripto do usuário.

As perguntas devem cobrir:
1. Objetivo do monitoramento (trading, pesquisa, compliance)
2. Stablecoins de interesse principal
3. Thresholds de alertas (valores que são importantes)
4. Frequência de análise desejada
5. Tipos de anomalias mais relevantes

Para cada pergunta, sugira 3 opções de resposta relevantes + permita resposta customizada.`,
    examples: [
      'USDC e USDT',
      'DAI e outras descentralizadas',
      'Todas as principais',
    ],
  },
  'task-agent': {
    systemPrompt: `Você é um assistente que ajuda a personalizar um agente de extração de tarefas de emails.
Seu objetivo é fazer 5 perguntas estratégicas para entender como o usuário trabalha com tarefas.

As perguntas devem cobrir:
1. Metodologia de trabalho (GTD, Scrum, livre)
2. Como define prioridades de tarefas
3. Tipos de projetos/clientes principais
4. Prazos típicos (diário, semanal, mensal)
5. Integrações desejadas (calendário, apps de tarefas)

Para cada pergunta, sugira 3 opções de resposta relevantes + permita resposta customizada.`,
    examples: [
      'GTD (Getting Things Done)',
      'Kanban/Scrum',
      'Lista simples',
    ],
  },
  'focus-agent': {
    systemPrompt: `Você é um assistente que ajuda a personalizar um agente de análise de foco e priorização.
Seu objetivo é fazer 5 perguntas estratégicas para entender como o usuário organiza seu dia e prioriza demandas.

As perguntas devem cobrir:
1. Rotina de trabalho (manhã produtiva, distribuído, flexível)
2. Critérios principais para definir o que é urgente
3. Stakeholders mais importantes (sócios, clientes, equipe)
4. Tipos de deadline que mais preocupam (reuniões, pagamentos, entregas)
5. Preferência de comunicação do briefing (direto, detalhado, só críticos)

Para cada pergunta, sugira 3 opções de resposta relevantes + permita resposta customizada.`,
    examples: [
      'Manhã é meu horário mais produtivo',
      'Trabalho melhor em blocos focados',
      'Prefiro flexibilidade ao longo do dia',
    ],
  },
  'commercial-agent': {
    systemPrompt: `Você é um assistente que ajuda a personalizar um agente de análise comercial e vendas.
Seu objetivo é fazer 5 perguntas estratégicas para entender o processo comercial do usuário.

As perguntas devem cobrir:
1. Tipo de negócio e mercado de atuação (B2B, B2C, serviços, produtos)
2. Produtos ou serviços principais que vendem
3. Clientes VIP ou estratégicos que devem ter prioridade máxima
4. Processo de vendas atual (tempo de resposta esperado, aprovações)
5. Tipos de oportunidade mais valiosas (licitações, grandes contas, recorrência)

Para cada pergunta, sugira 3 opções de resposta relevantes + permita resposta customizada.`,
    examples: [
      'Vendemos software/SaaS para empresas',
      'Serviços de consultoria e projetos',
      'Produtos físicos para varejo',
    ],
  },
};

interface Question {
  id: number;
  question: string;
  options: string[];
}

interface GenerateQuestionsBody {
  agentId: string;
}

interface SaveContextBody {
  agentId: string;
  answers: { questionId: number; answer: string }[];
}

export const agentTeachingRoutes: FastifyPluginAsync = async (app) => {
  // Gera perguntas para ensinar o agente
  app.post<{ Body: GenerateQuestionsBody }>(
    '/generate-questions',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { agentId } = request.body;

      if (!agentId) {
        return reply.status(400).send({ error: 'ID do agente é obrigatório' });
      }

      const config = AGENT_QUESTIONS_CONFIG[agentId];
      if (!config) {
        return reply.status(400).send({ error: 'Agente não suportado para ensino' });
      }

      try {
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        if (!anthropicKey) {
          return reply.status(500).send({ error: 'Chave da API Anthropic não configurada' });
        }

        const anthropic = new Anthropic({ apiKey: anthropicKey });

        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: `${config.systemPrompt}

Responda APENAS com um JSON válido no formato:
{
  "questions": [
    {
      "id": 1,
      "question": "Qual é sua área de atuação principal?",
      "options": ["Opção 1", "Opção 2", "Opção 3"]
    }
  ]
}

Gere exatamente 5 perguntas, cada uma com 3 opções de resposta. As perguntas devem ser diretas e objetivas em português brasileiro.`,
            },
          ],
        });

        // Extrai o texto da resposta
        const textBlock = response.content.find((c) => c.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
          throw new Error('Resposta inválida da IA');
        }

        // Parse do JSON
        const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Não foi possível extrair JSON da resposta');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        
        return { 
          agentId,
          questions: parsed.questions as Question[],
        };
      } catch (error) {
        console.error('[AgentTeaching] Erro ao gerar perguntas:', error);
        return reply.status(500).send({ 
          error: 'Erro ao gerar perguntas',
          details: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }
  );

  // Salva o contexto gerado baseado nas respostas
  app.post<{ Body: SaveContextBody }>(
    '/save-context',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const userId = request.user!.id;
      const { agentId, answers } = request.body;

      if (!agentId || !answers || answers.length === 0) {
        return reply.status(400).send({ error: 'Dados inválidos' });
      }

      const config = AGENT_QUESTIONS_CONFIG[agentId];
      if (!config) {
        return reply.status(400).send({ error: 'Agente não suportado' });
      }

      const db = getDb();
      if (!db) {
        return reply.status(500).send({ error: 'Banco de dados não disponível' });
      }

      try {
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        if (!anthropicKey) {
          return reply.status(500).send({ error: 'Chave da API Anthropic não configurada' });
        }

        const anthropic = new Anthropic({ apiKey: anthropicKey });

        // Formata as respostas para a IA
        const answersText = answers
          .map((a, i) => `Pergunta ${i + 1}: ${a.answer}`)
          .join('\n');

        // Gera o contexto consolidado
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [
            {
              role: 'user',
              content: `Você é um assistente que consolida informações para personalizar um agente de IA.

Com base nas respostas do usuário abaixo, gere um texto de contexto conciso e estruturado que será usado pelo agente "${agentId}" para personalizar suas análises e respostas.

Respostas do usuário:
${answersText}

Gere um contexto em português brasileiro, de 3-5 parágrafos, que capture:
1. O perfil e contexto do usuário
2. Prioridades e preferências específicas
3. Regras e diretrizes customizadas
4. Qualquer informação relevante para o agente operar de forma personalizada

Responda APENAS com o texto do contexto, sem formatação JSON ou markdown.`,
            },
          ],
        });

        // Extrai o texto da resposta
        const textBlock = response.content.find((c) => c.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
          throw new Error('Resposta inválida da IA');
        }

        const generatedContext = textBlock.text.trim();

        // Normaliza o ID do agente para a chave do JSON
        const contextKey = agentId.replace('-agent', '');

        // Busca configurações atuais
        const [currentConfig] = await db
          .select({ agentContexts: userConfigs.agentContexts })
          .from(userConfigs)
          .where(eq(userConfigs.userId, userId));

        // Atualiza o contexto
        const currentContexts = (currentConfig?.agentContexts as Record<string, string | null>) || {
          email: null,
          legal: null,
          financial: null,
          stablecoin: null,
          task: null,
        };

        currentContexts[contextKey] = generatedContext;

        await db
          .update(userConfigs)
          .set({ 
            agentContexts: currentContexts,
            updatedAt: new Date(),
          })
          .where(eq(userConfigs.userId, userId));

        return {
          success: true,
          agentId,
          context: generatedContext,
          message: 'Contexto salvo com sucesso!',
        };
      } catch (error) {
        console.error('[AgentTeaching] Erro ao salvar contexto:', error);
        return reply.status(500).send({
          error: 'Erro ao salvar contexto',
          details: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }
  );

  // Obtém o contexto atual de um agente
  app.get<{ Params: { agentId: string } }>(
    '/context/:agentId',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const userId = request.user!.id;
      const { agentId } = request.params;

      const db = getDb();
      if (!db) {
        return reply.status(500).send({ error: 'Banco de dados não disponível' });
      }

      try {
        const contextKey = agentId.replace('-agent', '');

        const [config] = await db
          .select({ agentContexts: userConfigs.agentContexts })
          .from(userConfigs)
          .where(eq(userConfigs.userId, userId));

        const contexts = (config?.agentContexts as Record<string, string | null>) || {};
        const context = contexts[contextKey] || null;

        return {
          agentId,
          context,
          hasContext: !!context,
        };
      } catch (error) {
        console.error('[AgentTeaching] Erro ao buscar contexto:', error);
        return reply.status(500).send({ error: 'Erro ao buscar contexto' });
      }
    }
  );

  // Remove o contexto de um agente
  app.delete<{ Params: { agentId: string } }>(
    '/context/:agentId',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const userId = request.user!.id;
      const { agentId } = request.params;

      const db = getDb();
      if (!db) {
        return reply.status(500).send({ error: 'Banco de dados não disponível' });
      }

      try {
        const contextKey = agentId.replace('-agent', '');

        const [currentConfig] = await db
          .select({ agentContexts: userConfigs.agentContexts })
          .from(userConfigs)
          .where(eq(userConfigs.userId, userId));

        const currentContexts = (currentConfig?.agentContexts as Record<string, string | null>) || {};
        currentContexts[contextKey] = null;

        await db
          .update(userConfigs)
          .set({ 
            agentContexts: currentContexts,
            updatedAt: new Date(),
          })
          .where(eq(userConfigs.userId, userId));

        return {
          success: true,
          message: 'Contexto removido com sucesso',
        };
      } catch (error) {
        console.error('[AgentTeaching] Erro ao remover contexto:', error);
        return reply.status(500).send({ error: 'Erro ao remover contexto' });
      }
    }
  );
};

