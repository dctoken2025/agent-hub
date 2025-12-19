# Deploy no Railway

## Pré-requisitos

1. Conta no Railway (https://railway.app)
2. Railway CLI instalado: `npm i -g @railway/cli`
3. Login no CLI: `railway login`

## Arquitetura

O projeto tem 3 serviços:

1. **API** (Node.js/Fastify) - Backend
2. **Dashboard** (React/Vite) - Frontend
3. **PostgreSQL** - Banco de dados

## Passo a Passo

### 1. Criar Projeto no Railway

```bash
# Na raiz do projeto
railway init
```

### 2. Adicionar PostgreSQL

No dashboard do Railway:
- Clique em "New" → "Database" → "PostgreSQL"
- Copie a `DATABASE_URL` gerada

### 3. Deploy da API

```bash
# Configurar variáveis de ambiente
railway variables set DATABASE_URL="postgresql://..."
railway variables set ANTHROPIC_API_KEY="sk-ant-..."
railway variables set GMAIL_CLIENT_ID="xxx.apps.googleusercontent.com"
railway variables set GMAIL_CLIENT_SECRET="GOCSPX-xxx"
railway variables set GMAIL_REDIRECT_URI="https://api.railway.app/api/auth/gmail/callback"
railway variables set ALCHEMY_API_KEY="xxx"
railway variables set CORS_ORIGINS="https://dashboard.railway.app"

# Deploy
railway up --service api
```

### 4. Deploy do Dashboard

```bash
# Em outro terminal ou criar novo serviço
railway link  # Selecione o mesmo projeto
railway variables set VITE_API_URL="https://api.railway.app"

# Deploy
railway up --service dashboard
```

## Variáveis de Ambiente

### API

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `DATABASE_URL` | URL do PostgreSQL | ✅ |
| `ANTHROPIC_API_KEY` | API Key do Claude AI | ✅ |
| `GMAIL_CLIENT_ID` | OAuth2 Client ID | ✅ |
| `GMAIL_CLIENT_SECRET` | OAuth2 Client Secret | ✅ |
| `GMAIL_REDIRECT_URI` | Callback URL OAuth | ✅ |
| `ALCHEMY_API_KEY` | API do Alchemy | ❌ |
| `CORS_ORIGINS` | URLs permitidas (vírgula) | ✅ |
| `PORT` | Porta (default: 3001) | ❌ |

### Dashboard

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `VITE_API_URL` | URL da API | ✅ |

## Configuração do Gmail OAuth

1. Vá ao Google Cloud Console
2. Crie um projeto ou use existente
3. Ative a Gmail API
4. Configure OAuth Consent Screen
5. Crie credenciais OAuth2
6. Adicione a URL de callback do Railway:
   - `https://sua-api.railway.app/api/auth/gmail/callback`

## Após o Deploy

1. Acesse o dashboard
2. Vá em "Configurações"
3. Autorize o Gmail clicando em "Conectar Gmail"
4. Configure as chaves de API (Anthropic, Alchemy)

## Domínios Customizados

No Railway, você pode configurar domínios customizados:
- API: `api.seudominio.com`
- Dashboard: `app.seudominio.com`

Lembre-se de atualizar:
- `GMAIL_REDIRECT_URI` com o novo domínio
- `CORS_ORIGINS` com o novo domínio do dashboard
- `VITE_API_URL` com o novo domínio da API

