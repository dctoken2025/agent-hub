# 🤖 Agent Hub

**Hub de Agentes Autônomos** - Framework para criar e gerenciar assistentes de IA que automatizam tarefas do dia-a-dia.

## 🚀 Visão Geral

O Agent Hub é um monorepo que contém:

- **@agent-hub/core** - Framework base com classes Agent, AIClient, Notifier e Scheduler
- **@agent-hub/email-agent** - Agente de classificação e triagem de emails
- **@agent-hub/api** - API REST para controlar os agentes
- **@agent-hub/dashboard** - Interface web para visualizar e gerenciar
- **@agent-hub/cli** - Interface de linha de comando

## 📦 Estrutura

```
agent-hub/
├── packages/
│   ├── core/              # Framework base
│   └── email-agent/       # Agente de email
├── apps/
│   ├── api/               # API REST (Fastify)
│   ├── dashboard/         # UI Web (React + Vite)
│   └── cli/               # CLI (Commander)
└── package.json           # Workspace config
```

## 🛠️ Instalação

```bash
# Clone o repositório
cd /Users/danielcoquieri/agent-hub

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais
```

## ⚙️ Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# API do Claude (obrigatório)
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Gmail OAuth
GMAIL_CLIENT_ID=xxxxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=xxxxx
GMAIL_REDIRECT_URI=http://localhost:3001/api/auth/gmail/callback

# Seu email
USER_EMAIL=seu@email.com

# Remetentes VIP (sempre alta prioridade)
VIP_SENDERS=ceo@empresa.com,diretoria@empresa.com

# Remetentes para ignorar (sempre baixa prioridade)
IGNORE_SENDERS=newsletter@,marketing@

# Intervalo de verificação (minutos)
EMAIL_CHECK_INTERVAL=5

# Notificações (opcional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxxxx
TELEGRAM_BOT_TOKEN=xxxxx
TELEGRAM_CHAT_ID=xxxxx

# API
API_PORT=3001
```

### Configurando Gmail OAuth

1. Acesse [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Crie um novo projeto ou selecione existente
3. Ative a **Gmail API**
4. Vá em **Credenciais** > **Criar credenciais** > **ID do cliente OAuth**
5. Tipo: **Aplicativo da Web**
6. Adicione URI de redirecionamento: `http://localhost:3001/api/auth/gmail/callback`
7. Copie Client ID e Client Secret para o `.env`

## 🚀 Uso

### Desenvolvimento

```bash
# Inicia API + Dashboard simultaneamente
npm run dev

# Ou separadamente:
npm run dev:api       # API em http://localhost:3001
npm run dev:dashboard # Dashboard em http://localhost:5173
```

### CLI

```bash
# Lista agentes
npm run cli -- list

# Executa email agent uma vez
npm run cli -- email --run

# Inicia email agent em modo contínuo
npm run cli -- email --start

# Autoriza Gmail
npm run cli -- email --auth
```

### Build de Produção

```bash
npm run build
```

## 📧 Email Agent

O agente de email classifica seus emails em 5 categorias:

| Prioridade | Descrição | Ação Sugerida |
|------------|-----------|---------------|
| 🚨 **Urgente** | Requer resposta imediata | Notifica você |
| 🔴 **Atenção** | Importante, merece leitura | Destaca na lista |
| 📄 **Informativo** | Updates, informativos | Ler quando puder |
| 📋 **Baixa** | Newsletters, marketing | Marcar como lido |
| 📎 **Apenas CC** | Você está só em cópia | Agrupar para revisão |

### Recursos

- ✅ Classificação com IA (Claude)
- ✅ Análise de sentimento e tom
- ✅ Detecção de urgência e deadlines
- ✅ Lista de remetentes VIP
- ✅ Filtro de newsletters automático
- ✅ Notificações (Slack/Telegram)

## 🔌 API Endpoints

### Agentes

- `GET /api/agents` - Lista todos os agentes
- `GET /api/agents/:id` - Detalhes de um agente
- `POST /api/agents/:id/start` - Inicia agente
- `POST /api/agents/:id/stop` - Para agente
- `POST /api/agents/:id/run` - Executa uma vez
- `POST /api/agents/start-all` - Inicia todos
- `POST /api/agents/stop-all` - Para todos

### Emails

- `GET /api/emails` - Lista emails classificados
- `POST /api/emails/fetch` - Busca novos emails
- `GET /api/emails/stats` - Estatísticas
- `GET /api/emails/urgent` - Apenas urgentes

### Autenticação

- `GET /api/auth/gmail/url` - URL para autorização
- `GET /api/auth/gmail/callback` - Callback OAuth
- `GET /api/auth/status` - Status das integrações

## 🧩 Criando Novos Agentes

Para criar um novo agente, estenda a classe `Agent`:

```typescript
import { Agent, AgentConfig, AgentResult } from '@agent-hub/core';

interface MyAgentResult {
  // seus dados
}

export class MyAgent extends Agent<void, MyAgentResult> {
  constructor(config: AgentConfig) {
    super(config);
  }

  async execute(): Promise<AgentResult<MyAgentResult>> {
    // Sua lógica aqui
    return {
      success: true,
      data: { /* resultado */ },
      timestamp: new Date(),
      duration: 0,
    };
  }
}
```

Registre no scheduler:

```typescript
import { getScheduler } from '@agent-hub/core';

const scheduler = getScheduler();
scheduler.register(new MyAgent({
  id: 'my-agent',
  name: 'Meu Agente',
  description: 'Faz algo útil',
  enabled: true,
  schedule: { type: 'interval', value: 10 }, // a cada 10 min
}));
```

## 🗺️ Roadmap

- [x] Email Agent - Classificação de emails
- [ ] Calendar Agent - Gestão de agenda
- [ ] Task Agent - Integração com Notion/Todoist
- [ ] Finance Agent - Monitoramento financeiro
- [ ] Slack Agent - Resumo de canais
- [ ] GitHub Agent - Monitoramento de PRs

## 📝 Licença

MIT

---

Desenvolvido com ❤️ usando Claude AI
