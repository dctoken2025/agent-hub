import { z } from 'zod';

// ===========================================
// Tipos para Extração de Tarefas
// ===========================================

export type TaskCategory = 
  | 'confirmation'    // "Podem confirmar?", "tudo ok?"
  | 'status_update'   // "Como estamos?", "qual o status?"
  | 'deadline'        // Tarefa com prazo específico
  | 'document'        // Pendência de documento
  | 'approval'        // Precisa de aprovação
  | 'action'          // Ação a ser executada
  | 'question'        // Dúvida/pergunta
  | 'information'     // Solicitação de informação
  | 'followup';       // Acompanhamento de algo anterior

export type TaskStatus = 
  | 'pending'         // Não iniciada
  | 'in_progress'     // Em andamento
  | 'waiting'         // Aguardando terceiros
  | 'done'            // Concluída
  | 'cancelled';      // Cancelada

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export type StakeholderImportance = 'vip' | 'high' | 'normal';

// ===========================================
// Interfaces Principais
// ===========================================

export interface Stakeholder {
  name: string;                     // "Mariana Ferrer"
  company?: string;                 // "Itaú BBA"
  role?: string;                    // "Fixed Income"
  email: string;                    // email do remetente
  phone?: string;                   // telefone se detectado na assinatura
  importance: StakeholderImportance;
}

export interface Project {
  name: string;                     // "CR Baru", "Operação XPTO"
  code?: string;                    // Código interno se detectado
  type?: string;                    // "Operação", "Emissão", "Projeto"
}

export interface TaskDeadline {
  date?: string;                    // Data ISO se específica (YYYY-MM-DD)
  relative?: string;                // "semana que vem", "15dc após"
  isExplicit: boolean;              // Se foi mencionado explicitamente
  dependsOn?: string;               // "após liquidação integral das NC"
  urgencyLevel?: 'immediate' | 'soon' | 'normal' | 'flexible';
}

export interface TaskResponse {
  text: string;                     // Resposta do usuário
  respondedAt: Date;
  respondedBy?: string;
}

export interface ActionItem {
  // === IDENTIFICAÇÃO ===
  id?: number;
  emailId: string;
  threadId?: string;
  userId?: string;
  
  // === CONTEXTO DO EMAIL ===
  emailSubject: string;
  emailFrom: string;
  emailDate?: Date;
  
  // === STAKEHOLDER ===
  stakeholder: Stakeholder;
  
  // === PROJETO/OPERAÇÃO ===
  project?: Project;
  
  // === A TAREFA EM SI ===
  title: string;                    // Título curto e claro
  description: string;              // Descrição completa da tarefa
  originalText: string;             // Texto original extraído do email
  
  category: TaskCategory;
  
  // === PRAZOS ===
  deadline?: TaskDeadline;
  
  // === STATUS ===
  status: TaskStatus;
  
  // === RESPOSTA ===
  response?: TaskResponse;
  
  // === PRIORIDADE E ANÁLISE ===
  priority: TaskPriority;
  priorityReason: string;           // "Stakeholder VIP + prazo próximo"
  
  confidence: number;               // 0-100
  
  // === SUGESTÕES DA IA ===
  suggestedResponse?: string;       // Sugestão de como responder este item
  suggestedAction?: string;         // "Verificar com jurídico", "Consultar financeiro"
  relatedDocuments?: string[];      // Documentos mencionados
  
  // === DEPENDÊNCIAS ===
  dependsOnTasks?: number[];        // IDs de outras tarefas que esta depende
  blockedByExternal?: string;       // "Aguardando cartório"
  
  // === METADADOS ===
  createdAt?: Date;
  updatedAt?: Date;
  completedAt?: Date;
}

export interface TaskAnalysis {
  emailId: string;
  threadId?: string;
  emailSubject: string;
  emailFrom: string;
  
  // Stakeholder principal do email
  stakeholder: Stakeholder;
  
  // Projeto/operação detectado
  project?: Project;
  
  // Lista de tarefas extraídas
  items: ActionItem[];
  
  // Resumo executivo
  summary: string;
  
  // Sugestão de resposta completa
  suggestedReply?: string;
  
  // Métricas
  totalItems: number;
  criticalItems: number;
  hasDeadlines: boolean;
  
  analyzedAt: Date;
}

export interface TaskAgentConfig {
  // Palavras-chave que indicam tarefas/perguntas
  taskKeywords: string[];
  
  // Lista de stakeholders VIP (domínios ou emails)
  vipStakeholders: string[];
  
  // Dias para considerar prazo urgente
  urgentDaysThreshold: number;
  
  // Extrair sugestão de resposta?
  generateSuggestedReply: boolean;
  
  // Contexto personalizado para a IA
  customContext?: string;
}

// ===========================================
// Schema de Configuração
// ===========================================

export const TaskAgentConfigSchema = z.object({
  taskKeywords: z.array(z.string()).default([
    // Perguntas diretas
    'como estamos', 'qual o status', 'podem confirmar', 'poderiam confirmar',
    'tudo ok', 'tudo certo', 'correto', 'certo?',
    // Solicitações
    'gostaria de saber', 'preciso saber', 'me informe', 'favor informar',
    'por favor', 'solicito', 'peço que',
    // Prazos
    'até quando', 'prazo', 'deadline', 'data limite', 'vence em',
    'previsto para', 'previsão', 'quando teremos',
    // Documentos
    'já temos', 'já recebemos', 'pendente', 'falta', 'aguardando',
    'assinar', 'assinatura', 'registro', 'documento',
    // Ações
    'próximos passos', 'action items', 'pendências', 'tarefas',
    'to do', 'verificar', 'confirmar', 'providenciar',
  ]),
  vipStakeholders: z.array(z.string()).default([
    // Bancos
    'itau', 'bradesco', 'santander', 'btg', 'xp', 'safra',
    // Instituições
    'cvm', 'b3', 'anbima', 'bacen',
  ]),
  urgentDaysThreshold: z.number().default(3),
  generateSuggestedReply: z.boolean().default(true),
  customContext: z.string().optional(),
});

// ===========================================
// Schema para Tool Use do Claude
// ===========================================

export const TaskExtractionSchema = {
  name: 'extract_action_items',
  description: `Analisa um email e extrai TODAS as tarefas, perguntas, pendências e action items.
Identifica o stakeholder (quem enviou), projeto/operação relacionada, e cria uma lista estruturada de itens a responder ou fazer.`,
  input_schema: {
    type: 'object' as const,
    properties: {
      stakeholder: {
        type: 'object',
        properties: {
          name: { 
            type: 'string', 
            description: 'Nome completo da pessoa que enviou o email' 
          },
          company: { 
            type: 'string', 
            description: 'Empresa/instituição do remetente (ex: Itaú BBA, Oliveira Trust)' 
          },
          role: { 
            type: 'string', 
            description: 'Cargo/função se identificado na assinatura' 
          },
          phone: { 
            type: 'string', 
            description: 'Telefone se encontrado na assinatura' 
          },
          importance: {
            type: 'string',
            enum: ['vip', 'high', 'normal'],
            description: 'VIP = grandes bancos, reguladores, clientes principais. High = parceiros importantes. Normal = demais.',
          },
        },
        required: ['name', 'importance'],
        description: 'Informações sobre o stakeholder que enviou o email',
      },
      project: {
        type: 'object',
        properties: {
          name: { 
            type: 'string', 
            description: 'Nome do projeto/operação mencionado (ex: CR Baru, Operação XPTO)' 
          },
          code: { 
            type: 'string', 
            description: 'Código ou identificador do projeto se houver' 
          },
          type: { 
            type: 'string', 
            description: 'Tipo: Operação, Emissão, Projeto, Contrato, etc.' 
          },
        },
        description: 'Projeto ou operação relacionada ao email (null se não identificado)',
      },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Título curto e claro da tarefa (máx 80 chars)',
            },
            description: {
              type: 'string',
              description: 'Descrição completa do que precisa ser feito ou respondido',
            },
            originalText: {
              type: 'string',
              description: 'Trecho EXATO do email que originou esta tarefa (para referência)',
            },
            category: {
              type: 'string',
              enum: ['confirmation', 'status_update', 'deadline', 'document', 'approval', 'action', 'question', 'information', 'followup'],
              description: `Categoria:
- confirmation: Pedido de confirmação ("podem confirmar?", "certo?")
- status_update: Pedido de status ("como estamos?", "qual situação?")
- deadline: Item com prazo específico
- document: Pendência de documento
- approval: Precisa de aprovação
- action: Ação concreta a executar
- question: Dúvida/pergunta
- information: Solicitação de informação
- followup: Acompanhamento de algo anterior`,
            },
            deadline: {
              type: 'object',
              properties: {
                date: { 
                  type: 'string', 
                  description: 'Data ISO (YYYY-MM-DD) se mencionada explicitamente' 
                },
                relative: { 
                  type: 'string', 
                  description: 'Descrição relativa: "semana que vem", "15dc após liquidação"' 
                },
                isExplicit: { 
                  type: 'boolean', 
                  description: 'True se o prazo foi explicitamente mencionado' 
                },
                dependsOn: { 
                  type: 'string', 
                  description: 'Condição da qual o prazo depende (ex: "após liquidação integral")' 
                },
                urgencyLevel: {
                  type: 'string',
                  enum: ['immediate', 'soon', 'normal', 'flexible'],
                  description: 'immediate = hoje/amanhã, soon = esta semana, normal = próximas 2 semanas, flexible = sem urgência',
                },
              },
              description: 'Informações de prazo (null se não houver prazo)',
            },
            priority: {
              type: 'string',
              enum: ['critical', 'high', 'medium', 'low'],
              description: `Prioridade baseada em:
- critical: Prazo imediato + stakeholder VIP, ou bloqueante
- high: Prazo próximo OU stakeholder VIP OU confirmação urgente
- medium: Tarefa normal sem urgência especial
- low: Informativo, sem prazo, baixo impacto`,
            },
            priorityReason: {
              type: 'string',
              description: 'Justificativa da prioridade (ex: "Stakeholder VIP + prazo em 3 dias")',
            },
            suggestedResponse: {
              type: 'string',
              description: 'Sugestão de como responder este item específico',
            },
            suggestedAction: {
              type: 'string',
              description: 'Ação sugerida: "Verificar com jurídico", "Consultar financeiro", "Aguardar retorno do cartório"',
            },
            relatedDocuments: {
              type: 'array',
              items: { type: 'string' },
              description: 'Lista de documentos mencionados neste item',
            },
            blockedByExternal: {
              type: 'string',
              description: 'Se esta tarefa depende de algo externo (ex: "Aguardando cartório")',
            },
            confidence: {
              type: 'number',
              description: 'Confiança na extração (0-100)',
            },
          },
          required: ['title', 'description', 'originalText', 'category', 'priority', 'priorityReason', 'confidence'],
        },
        description: 'Lista de action items extraídos do email',
      },
      summary: {
        type: 'string',
        description: 'Resumo executivo do email em 1-2 frases (o que o remetente quer)',
      },
      suggestedReply: {
        type: 'string',
        description: `Sugestão de resposta COMPLETA ao email, organizando os itens em formato profissional.
Deve ter:
- Saudação
- Breve contexto
- Lista numerada respondendo cada ponto
- Encerramento
Use marcadores de status: ✅ (concluído), 🔄 (em andamento), ⏳ (aguardando), ❓ (a verificar)`,
      },
    },
    required: ['stakeholder', 'items', 'summary'],
  },
};
