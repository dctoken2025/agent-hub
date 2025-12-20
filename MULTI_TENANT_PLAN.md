# 🏗️ Plano de Migração: Mono-usuário → Multi-usuário

## Índice
1. [Visão Geral](#visão-geral)
2. [Arquitetura Atual](#arquitetura-atual)
3. [Arquitetura Proposta](#arquitetura-proposta)
4. [Mudanças no Banco de Dados](#mudanças-no-banco-de-dados)
5. [Mudanças na API](#mudanças-na-api)
6. [Mudanças nos Agentes](#mudanças-nos-agentes)
7. [Mudanças no Frontend](#mudanças-no-frontend)
8. [Fluxo de Autenticação](#fluxo-de-autenticação)
9. [Estratégia de Migração](#estratégia-de-migração)
10. [Checklist de Implementação](#checklist-de-implementação)
11. [Riscos e Mitigações](#riscos-e-mitigações)

---

## Visão Geral

### Objetivo
Transformar o Agent Hub de um sistema mono-usuário para multi-usuário, onde:
- **Admin** configura: Gmail OAuth credentials, Anthropic API Key, Alchemy API Key
- **Usuários** têm: Próprios tokens Gmail, próprias configs de agentes, próprios dados

### Princípios
1. **Isolamento total de dados** - Usuário A nunca vê dados do Usuário B
2. **Agentes independentes** - Cada usuário tem suas próprias instâncias de agentes
3. **UX simplificada** - Usuário só clica "Conectar Gmail" e autoriza
4. **Compatibilidade retroativa** - Dados existentes são migrados para o primeiro usuário admin

---

## Arquitetura Atual

### Banco de Dados (schema.ts)
```
app_config         - Configurações globais (API keys, tokens Gmail, etc)
classified_emails  - Emails processados (SEM userId)
agent_logs         - Logs de execução (SEM userId)  
legal_analyses     - Análises jurídicas (SEM userId)
stablecoins        - Stablecoins monitoradas (SEM userId)
stablecoin_events  - Eventos detectados (SEM userId)
stablecoin_anomalies - Anomalias detectadas (SEM userId)
supply_snapshots   - Histórico de supply (SEM userId)
daily_stats        - Estatísticas diárias (SEM userId)
```

### Configurações (config.ts)
```typescript
// Tudo em uma única estrutura AppConfigData
{
  anthropic: { apiKey },           // → GLOBAL
  gmail: { clientId, clientSecret, tokens }, // tokens → POR USUÁRIO
  alchemy: { apiKey },             // → GLOBAL
  user: { email, vipSenders, ignoreSenders }, // → POR USUÁRIO
  notifications: { slackWebhookUrl }, // → POR USUÁRIO
  settings: { emailCheckInterval },   // → POR USUÁRIO
  stablecoin: { checkInterval, thresholds }, // → POR USUÁRIO
  emailAgent: { ... },             // → POR USUÁRIO
  legalAgent: { ... },             // → POR USUÁRIO
}
```

### Agentes (scheduler.ts)
```typescript
// Singleton global - UMA instância de cada agente
let sharedScheduler: AgentScheduler | null = null;
```

### Rotas Afetadas
| Rota | Arquivo | Precisa de userId |
|------|---------|-------------------|
| `/api/config/*` | config.ts | Parcial (separar global vs usuário) |
| `/api/auth/*` | auth.ts | Sim (tokens por usuário) |
| `/api/agents/*` | agents.ts | Sim |
| `/api/emails/*` | emails.ts | Sim |
| `/api/legal/*` | legal.ts | Sim |
| `/api/stablecoins/*` | stablecoins.ts | Sim |

---

## Arquitetura Proposta

### Separação de Configurações

```
┌─────────────────────────────────────────────────────────────┐
│              CONFIGURAÇÕES GLOBAIS (Admin)                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ global_config                                        │   │
│  │ - anthropic_api_key                                  │   │
│  │ - gmail_client_id                                    │   │
│  │ - gmail_client_secret                                │   │
│  │ - gmail_redirect_uri                                 │   │
│  │ - alchemy_api_key                                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                    (compartilhadas)
                              │
┌─────────────────────────────┼─────────────────────────────┐
│                             ▼                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                    USUÁRIOS                          │  │
│  │  users                                               │  │
│  │  - id, email, password_hash, name                    │  │
│  │  - role (admin/user)                                 │  │
│  │  - gmail_tokens (OAuth tokens individuais)           │  │
│  │  - created_at                                        │  │
│  │                                                      │  │
│  │  user_configs                                        │  │
│  │  - user_id                                           │  │
│  │  - vip_senders, ignore_senders                       │  │
│  │  - email_agent_config (JSON)                         │  │
│  │  - legal_agent_config (JSON)                         │  │
│  │  - stablecoin_agent_config (JSON)                    │  │
│  │  - notification_config (JSON)                        │  │
│  └─────────────────────────────────────────────────────┘  │
│                             │                              │
│                    (dados por usuário)                     │
│                             │                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ classified_emails      (+ user_id)                   │  │
│  │ agent_logs             (+ user_id)                   │  │
│  │ legal_analyses         (+ user_id)                   │  │
│  │ stablecoins            (+ user_id)                   │  │
│  │ stablecoin_events      (+ user_id)                   │  │
│  │ stablecoin_anomalies   (+ user_id)                   │  │
│  │ supply_snapshots       (+ user_id)                   │  │
│  │ daily_stats            (+ user_id)                   │  │
│  └─────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

---

## Mudanças no Banco de Dados

### Novas Tabelas

```sql
-- Tabela de usuários
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(20) NOT NULL DEFAULT 'user', -- 'admin' ou 'user'
  gmail_tokens JSONB, -- Tokens OAuth individuais
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Configurações globais (só admin pode modificar)
CREATE TABLE global_config (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) NOT NULL UNIQUE,
  value TEXT,
  is_secret BOOLEAN DEFAULT false,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Configurações por usuário
CREATE TABLE user_configs (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Preferências de email
  vip_senders TEXT[], -- Array de emails VIP
  ignore_senders TEXT[], -- Array de emails para ignorar
  
  -- Configurações dos agentes (JSON)
  email_agent_config JSONB DEFAULT '{"enabled": true, "intervalMinutes": 10, "maxEmailsPerRun": 50}',
  legal_agent_config JSONB DEFAULT '{"enabled": true, "autoAnalyze": true}',
  stablecoin_agent_config JSONB DEFAULT '{"enabled": false, "checkInterval": 60}',
  
  -- Notificações
  notification_config JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id)
);
```

### Alterações em Tabelas Existentes

```sql
-- Adiciona user_id em todas as tabelas de dados
ALTER TABLE classified_emails 
  ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE agent_logs 
  ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE legal_analyses 
  ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE stablecoins 
  ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE stablecoin_events 
  ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE stablecoin_anomalies 
  ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE supply_snapshots 
  ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE daily_stats 
  ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Cria índices para performance
CREATE INDEX idx_classified_emails_user_id ON classified_emails(user_id);
CREATE INDEX idx_agent_logs_user_id ON agent_logs(user_id);
CREATE INDEX idx_legal_analyses_user_id ON legal_analyses(user_id);
CREATE INDEX idx_stablecoins_user_id ON stablecoins(user_id);
```

### Schema Drizzle Atualizado

```typescript
// schema.ts - Novas tabelas

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  role: varchar('role', { length: 20 }).notNull().default('user'),
  gmailTokens: jsonb('gmail_tokens'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const globalConfig = pgTable('global_config', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: text('value'),
  isSecret: boolean('is_secret').default(false),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const userConfigs = pgTable('user_configs', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  vipSenders: text('vip_senders').array(),
  ignoreSenders: text('ignore_senders').array(),
  emailAgentConfig: jsonb('email_agent_config'),
  legalAgentConfig: jsonb('legal_agent_config'),
  stablecoinAgentConfig: jsonb('stablecoin_agent_config'),
  notificationConfig: jsonb('notification_config'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Adicionar userId nas tabelas existentes
export const classifiedEmails = pgTable('classified_emails', {
  // ... campos existentes ...
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
});

// ... repetir para todas as outras tabelas ...
```

---

## Mudanças na API

### Novo: Sistema de Autenticação

```typescript
// routes/auth.ts - Novas rotas

// POST /api/auth/register
// Body: { email, password, name }
// Response: { success, user: { id, email, name } }

// POST /api/auth/login
// Body: { email, password }
// Response: { success, token, user: { id, email, name, role } }

// GET /api/auth/me (protegida)
// Headers: Authorization: Bearer <token>
// Response: { user: { id, email, name, role } }

// POST /api/auth/logout (protegida)
// Response: { success }
```

### Novo: Middleware de Autenticação

```typescript
// middleware/auth.ts

import jwt from 'jsonwebtoken';

export interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export const authMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  const authHeader = request.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Token não fornecido' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthUser;
    request.user = payload;
  } catch {
    return reply.status(401).send({ error: 'Token inválido' });
  }
};

export const adminMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  if (request.user?.role !== 'admin') {
    return reply.status(403).send({ error: 'Acesso negado. Requer role admin.' });
  }
};
```

### Rotas Modificadas

```typescript
// Exemplo: emails.ts

// ANTES:
app.get('/', async (request) => {
  const dbEmails = await db.select().from(classifiedEmails);
  // ...
});

// DEPOIS:
app.get('/', { preHandler: [authMiddleware] }, async (request) => {
  const userId = request.user!.id;
  const dbEmails = await db.select()
    .from(classifiedEmails)
    .where(eq(classifiedEmails.userId, userId)); // ← FILTRO POR USUÁRIO
  // ...
});
```

### Separação de Config Routes

```typescript
// routes/config.ts - Reorganização

// ROTAS GLOBAIS (só admin)
app.post('/global/anthropic', { preHandler: [authMiddleware, adminMiddleware] }, ...);
app.post('/global/gmail', { preHandler: [authMiddleware, adminMiddleware] }, ...);
app.post('/global/alchemy', { preHandler: [authMiddleware, adminMiddleware] }, ...);
app.get('/global', { preHandler: [authMiddleware, adminMiddleware] }, ...);

// ROTAS DE USUÁRIO (qualquer usuário autenticado)
app.get('/user', { preHandler: [authMiddleware] }, ...);  // Suas configs
app.put('/user', { preHandler: [authMiddleware] }, ...);  // Atualiza suas configs
app.get('/user/agents', { preHandler: [authMiddleware] }, ...);  // Config dos agentes
app.put('/user/agents/:agentType', { preHandler: [authMiddleware] }, ...);
```

### Novo: Gmail OAuth por Usuário

```typescript
// routes/auth.ts - OAuth modificado

// Gera URL de autorização (usa credentials globais)
app.get('/gmail/url', { preHandler: [authMiddleware] }, async (request) => {
  const globalConfig = await getGlobalConfig();
  const userId = request.user!.id;
  
  // Inclui userId no state para identificar no callback
  const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${globalConfig.gmail.clientId}&` +
    `redirect_uri=${globalConfig.gmail.redirectUri}&` +
    `state=${state}&` +  // ← IMPORTANTE
    // ...
});

// Callback salva token no usuário
app.get('/gmail/callback', async (request) => {
  const { code, state } = request.query;
  const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());
  
  // Troca código por tokens
  const tokens = await exchangeCodeForTokens(code);
  
  // Salva tokens NO USUÁRIO, não global
  await db.update(users)
    .set({ gmailTokens: tokens })
    .where(eq(users.id, userId));
});
```

---

## Mudanças nos Agentes

### Novo: AgentManager Multi-tenant

```typescript
// core/agent-manager.ts

interface UserAgentSet {
  userId: string;
  emailAgent?: EmailAgent;
  legalAgent?: LegalAgent;
  stablecoinAgent?: StablecoinAgent;
  scheduler: AgentScheduler;
}

export class AgentManager {
  private userAgents: Map<string, UserAgentSet> = new Map();
  
  /**
   * Inicializa agentes para um usuário específico.
   * Chamado quando usuário faz login ou quando configs mudam.
   */
  async initializeForUser(userId: string): Promise<void> {
    // Para agentes existentes desse usuário
    await this.stopForUser(userId);
    
    // Carrega configs do usuário
    const userConfig = await loadUserConfig(userId);
    const globalConfig = await loadGlobalConfig();
    
    // Carrega tokens Gmail do usuário
    const user = await getUser(userId);
    
    // Cria scheduler dedicado para este usuário
    const scheduler = new AgentScheduler();
    const agentSet: UserAgentSet = { userId, scheduler };
    
    // Inicializa Email Agent se configurado
    if (user.gmailTokens && userConfig.emailAgent?.enabled) {
      const emailAgent = new EmailAgent(
        { 
          id: `email-agent-${userId}`,
          name: 'Email Agent',
          enabled: true,
          schedule: { 
            type: 'interval', 
            value: userConfig.emailAgent.intervalMinutes 
          },
        },
        {
          userEmail: user.email,
          vipSenders: userConfig.vipSenders,
          ignoreSenders: userConfig.ignoreSenders,
          // Usa tokens do usuário
          gmailTokens: user.gmailTokens,
          // Usa credentials globais
          gmailClientId: globalConfig.gmail.clientId,
          gmailClientSecret: globalConfig.gmail.clientSecret,
        }
      );
      
      scheduler.register(emailAgent);
      agentSet.emailAgent = emailAgent;
    }
    
    // ... similar para Legal e Stablecoin agents ...
    
    this.userAgents.set(userId, agentSet);
    
    // Inicia os agentes
    await scheduler.startAll();
    
    console.log(`[AgentManager] Agentes iniciados para usuário ${userId}`);
  }
  
  /**
   * Para todos os agentes de um usuário.
   */
  async stopForUser(userId: string): Promise<void> {
    const agentSet = this.userAgents.get(userId);
    if (agentSet) {
      await agentSet.scheduler.stopAll();
      this.userAgents.delete(userId);
      console.log(`[AgentManager] Agentes parados para usuário ${userId}`);
    }
  }
  
  /**
   * Atualiza configuração de um agente específico.
   */
  async updateAgentConfig(
    userId: string, 
    agentType: 'email' | 'legal' | 'stablecoin',
    config: any
  ): Promise<void> {
    // Salva no banco
    await saveUserAgentConfig(userId, agentType, config);
    
    // Reinicializa agentes do usuário
    await this.initializeForUser(userId);
  }
  
  /**
   * Retorna status dos agentes de um usuário.
   */
  getUserAgents(userId: string): Array<ReturnType<Agent['getInfo']>> {
    const agentSet = this.userAgents.get(userId);
    if (!agentSet) return [];
    return agentSet.scheduler.getAgents();
  }
  
  /**
   * Executa um agente manualmente para um usuário.
   */
  async runAgentOnce(userId: string, agentType: string): Promise<void> {
    const agentSet = this.userAgents.get(userId);
    if (!agentSet) {
      throw new Error('Agentes não inicializados para este usuário');
    }
    await agentSet.scheduler.runOnce(`${agentType}-agent-${userId}`);
  }
}

// Singleton
let agentManager: AgentManager | null = null;

export function getAgentManager(): AgentManager {
  if (!agentManager) {
    agentManager = new AgentManager();
  }
  return agentManager;
}
```

### Mudanças no index.ts da API

```typescript
// apps/api/src/index.ts

// ANTES: Inicializava agentes globais no startup
await initializeEmailAgent();
await initializeLegalAgent();

// DEPOIS: Não inicializa nada no startup
// Agentes são inicializados quando usuário faz login ou ativa

// Na rota de login:
app.post('/api/auth/login', async (request, reply) => {
  // ... valida credenciais ...
  
  // Inicializa agentes do usuário
  const agentManager = getAgentManager();
  await agentManager.initializeForUser(user.id);
  
  return { token, user };
});
```

---

## Mudanças no Frontend

### Novas Páginas

```
src/pages/
├── Login.tsx          # NOVO - Tela de login
├── Register.tsx       # NOVO - Tela de registro  
├── AdminSettings.tsx  # NOVO - Configs globais (só admin)
├── Settings.tsx       # MODIFICADO - Configs do usuário
└── ...
```

### Auth Context

```typescript
// src/contexts/AuthContext.tsx

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}

export const AuthProvider: React.FC = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => 
    localStorage.getItem('token')
  );
  
  // Verifica token no startup
  useEffect(() => {
    if (token) {
      fetchUser();
    }
  }, []);
  
  const login = async (email: string, password: string) => {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    setToken(response.token);
    setUser(response.user);
    localStorage.setItem('token', response.token);
  };
  
  // ...
};
```

### Protected Routes

```typescript
// src/App.tsx

function App() {
  const { user, isAdmin } = useAuth();
  
  if (!user) {
    return <Login />;
  }
  
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/emails" element={<Emails />} />
      <Route path="/settings" element={<Settings />} />
      
      {/* Só admin vê essas rotas */}
      {isAdmin && (
        <Route path="/admin/settings" element={<AdminSettings />} />
      )}
    </Routes>
  );
}
```

### API Requests com Token

```typescript
// src/lib/utils.ts

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  
  if (response.status === 401) {
    // Token expirado - redireciona para login
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Sessão expirada');
  }
  
  return response.json();
}
```

---

## Fluxo de Autenticação

### Registro

```
1. Usuário acessa /register
2. Preenche email, senha, nome
3. POST /api/auth/register
4. Backend:
   - Valida email único
   - Hash da senha com bcrypt
   - Cria user com role='user'
   - Cria user_configs default
   - Retorna { success, user }
5. Redireciona para /login
```

### Login

```
1. Usuário acessa /login
2. Preenche email, senha
3. POST /api/auth/login
4. Backend:
   - Valida credenciais
   - Gera JWT token (expira em 7 dias)
   - Inicializa AgentManager para este usuário
   - Retorna { token, user }
5. Frontend salva token no localStorage
6. Redireciona para /dashboard
```

### Conectar Gmail (Usuário Comum)

```
1. Usuário vai em Settings → "Conectar Gmail"
2. GET /api/auth/gmail/url
   - Backend usa clientId/secret GLOBAIS
   - Inclui userId no state
3. Usuário é redirecionado para Google
4. Usuário autoriza
5. Google redireciona para /api/auth/gmail/callback
6. Backend:
   - Extrai userId do state
   - Troca code por tokens
   - Salva tokens NO USUÁRIO (users.gmail_tokens)
   - Reinicia agentes do usuário
7. Redireciona para /settings?gmail=success
```

---

## Estratégia de Migração

### Fase 1: Preparação (sem quebrar nada)
1. ✅ Criar novas tabelas (users, global_config, user_configs)
2. ✅ Adicionar colunas user_id nas tabelas existentes (NULLABLE inicialmente)
3. ✅ Criar índices
4. ✅ Não alterar código existente ainda

### Fase 2: Migração de Dados
1. Criar usuário admin com dados do app_config atual
2. Migrar configs globais para global_config
3. Migrar configs de usuário para user_configs  
4. Atualizar user_id em todas as tabelas existentes para o admin

```sql
-- Script de migração
BEGIN;

-- 1. Cria usuário admin
INSERT INTO users (email, password_hash, name, role, gmail_tokens)
SELECT 
  COALESCE((SELECT value FROM app_config WHERE key = 'user.email'), 'admin@example.com'),
  '$2b$10$...', -- Hash de senha temporária
  'Admin',
  'admin',
  (SELECT value::jsonb FROM app_config WHERE key = 'gmail.tokens')
RETURNING id INTO admin_user_id;

-- 2. Migra configs globais
INSERT INTO global_config (key, value, is_secret)
SELECT key, value, is_secret FROM app_config 
WHERE key IN ('anthropic.apiKey', 'gmail.clientId', 'gmail.clientSecret', 'gmail.redirectUri', 'alchemy.apiKey');

-- 3. Cria user_configs para admin
INSERT INTO user_configs (user_id, vip_senders, ignore_senders, email_agent_config, ...)
SELECT 
  admin_user_id,
  (SELECT value::text[] FROM app_config WHERE key = 'user.vipSenders'),
  -- ...

-- 4. Atualiza user_id em todas as tabelas
UPDATE classified_emails SET user_id = admin_user_id WHERE user_id IS NULL;
UPDATE agent_logs SET user_id = admin_user_id WHERE user_id IS NULL;
UPDATE legal_analyses SET user_id = admin_user_id WHERE user_id IS NULL;
UPDATE stablecoins SET user_id = admin_user_id WHERE user_id IS NULL;

-- 5. Torna user_id NOT NULL
ALTER TABLE classified_emails ALTER COLUMN user_id SET NOT NULL;
-- ... para todas as tabelas ...

COMMIT;
```

### Fase 3: Atualização do Código
1. Implementar sistema de autenticação
2. Criar middleware de auth
3. Atualizar todas as rotas com filtro userId
4. Implementar AgentManager
5. Atualizar frontend

### Fase 4: Limpeza
1. Remover tabela app_config antiga
2. Remover código de inicialização global de agentes
3. Testes completos

---

## Checklist de Implementação

### Backend - Banco de Dados
- [ ] Criar tabela `users`
- [ ] Criar tabela `global_config`
- [ ] Criar tabela `user_configs`
- [ ] Adicionar `user_id` em `classified_emails`
- [ ] Adicionar `user_id` em `agent_logs`
- [ ] Adicionar `user_id` em `legal_analyses`
- [ ] Adicionar `user_id` em `stablecoins`
- [ ] Adicionar `user_id` em `stablecoin_events`
- [ ] Adicionar `user_id` em `stablecoin_anomalies`
- [ ] Adicionar `user_id` em `supply_snapshots`
- [ ] Adicionar `user_id` em `daily_stats`
- [ ] Criar índices de performance
- [ ] Script de migração de dados

### Backend - Autenticação
- [ ] Instalar dependências (bcrypt, jsonwebtoken)
- [ ] Criar middleware `authMiddleware`
- [ ] Criar middleware `adminMiddleware`
- [ ] Rota POST `/api/auth/register`
- [ ] Rota POST `/api/auth/login`
- [ ] Rota GET `/api/auth/me`
- [ ] Rota POST `/api/auth/logout`
- [ ] Variável de ambiente `JWT_SECRET`

### Backend - Rotas
- [ ] Separar `/api/config` em global e user
- [ ] Atualizar `/api/auth/gmail/*` para multi-tenant
- [ ] Atualizar `/api/agents/*` com userId
- [ ] Atualizar `/api/emails/*` com userId
- [ ] Atualizar `/api/legal/*` com userId
- [ ] Atualizar `/api/stablecoins/*` com userId

### Backend - Agentes
- [ ] Criar `AgentManager` multi-tenant
- [ ] Modificar `EmailAgent` para aceitar tokens por usuário
- [ ] Modificar inicialização de agentes
- [ ] Testes de múltiplos usuários simultâneos

### Frontend
- [ ] Criar `AuthContext`
- [ ] Criar página `Login.tsx`
- [ ] Criar página `Register.tsx`
- [ ] Criar página `AdminSettings.tsx`
- [ ] Modificar `Settings.tsx` (só configs de usuário)
- [ ] Atualizar `apiRequest` para incluir token
- [ ] Protected routes
- [ ] Menu condicional (admin vs user)
- [ ] Tela de "Conectar Gmail" simplificada

### Testes
- [ ] Teste de registro
- [ ] Teste de login
- [ ] Teste de isolamento de dados
- [ ] Teste de agentes por usuário
- [ ] Teste de OAuth Gmail por usuário
- [ ] Teste de admin vs user permissions

### Deploy
- [ ] Variável `JWT_SECRET` no Railway
- [ ] Executar migração no banco de produção
- [ ] Deploy da API
- [ ] Deploy do Dashboard
- [ ] Criar primeiro usuário admin

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Perda de dados na migração | Baixa | Alto | Backup antes da migração, script testado em staging |
| Performance com muitos usuários | Média | Médio | Índices, lazy loading de agentes |
| Token OAuth expirado | Média | Baixo | Refresh token automático, notificar usuário |
| Vazamento de dados entre usuários | Baixa | Crítico | Testes rigorosos, code review, filtros em todas as queries |
| Conflito de agentes simultâneos | Média | Médio | IDs únicos por usuário, isolamento de memória |

---

## Estimativa de Tempo

| Fase | Descrição | Estimativa |
|------|-----------|------------|
| 1 | Banco de dados + Schema | 2-3h |
| 2 | Sistema de autenticação | 3-4h |
| 3 | Atualização de rotas | 3-4h |
| 4 | AgentManager multi-tenant | 3-4h |
| 5 | Frontend (login, register, auth) | 3-4h |
| 6 | Migração de dados | 1-2h |
| 7 | Testes e ajustes | 2-3h |
| **Total** | | **17-24h** |

---

## Próximos Passos

1. **Revisar este documento** - Confirmar se está alinhado com a visão
2. **Começar pela Fase 1** - Schema do banco (menor risco)
3. **Iterar** - Cada fase pode ser deployada independentemente
