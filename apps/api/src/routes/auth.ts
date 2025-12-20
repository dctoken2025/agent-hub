import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { getDb, users, userConfigs, globalConfig } from '../db/index.js';
import { authMiddleware, generateToken } from '../middleware/auth.js';

// Número de rounds para o bcrypt
const SALT_ROUNDS = 10;

// Helper para carregar config global (exportado para uso em outros módulos)
export async function getGlobalConfigValue(key: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(globalConfig)
    .where(eq(globalConfig.key, key))
    .limit(1);
  
  return result[0]?.value || null;
}

// Helper para carregar múltiplas configs globais
async function getGlobalConfigs(): Promise<Record<string, string>> {
  const db = getDb();
  if (!db) return {};
  
  const results = await db.select().from(globalConfig);
  const configs: Record<string, string> = {};
  
  for (const row of results) {
    if (row.value) {
      configs[row.key] = row.value;
    }
  }
  
  return configs;
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  // ===========================================
  // Registro de Usuário
  // ===========================================
  app.post<{
    Body: { email: string; password: string; name?: string };
  }>('/register', async (request, reply) => {
    const db = getDb();
    if (!db) {
      return reply.status(500).send({ error: 'Banco de dados não disponível' });
    }

    const { email, password, name } = request.body;

    // Validações
    if (!email || !password) {
      return reply.status(400).send({ error: 'Email e senha são obrigatórios' });
    }

    if (password.length < 6) {
      return reply.status(400).send({ error: 'Senha deve ter pelo menos 6 caracteres' });
    }

    // Verifica email formato básico
    if (!email.includes('@')) {
      return reply.status(400).send({ error: 'Email inválido' });
    }

    try {
      // Verifica se email já existe
      const existing = await db.select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (existing.length > 0) {
        return reply.status(400).send({ error: 'Este email já está cadastrado' });
      }

      // Hash da senha
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Verifica se é o primeiro usuário (será admin)
      const userCount = await db.select({ id: users.id }).from(users).limit(1);
      const isFirstUser = userCount.length === 0;

      // Cria usuário
      const [newUser] = await db.insert(users).values({
        email: email.toLowerCase(),
        passwordHash,
        name: name || email.split('@')[0],
        role: isFirstUser ? 'admin' : 'user',
        isActive: true,
      }).returning();

      // Cria configurações padrão para o usuário
      await db.insert(userConfigs).values({
        userId: newUser.id,
        vipSenders: [],
        ignoreSenders: ['newsletter', 'marketing', 'noreply'],
      });

      console.log(`[Auth] Novo usuário registrado: ${newUser.email} (role: ${newUser.role})`);

      // Gera token
      const token = generateToken(newUser);

      return {
        success: true,
        message: isFirstUser 
          ? 'Conta de administrador criada com sucesso!' 
          : 'Conta criada com sucesso!',
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
        },
      };
    } catch (error) {
      console.error('[Auth] Erro no registro:', error);
      return reply.status(500).send({ 
        error: 'Erro ao criar conta. Tente novamente.' 
      });
    }
  });

  // ===========================================
  // Login
  // ===========================================
  app.post<{
    Body: { email: string; password: string };
  }>('/login', async (request, reply) => {
    const db = getDb();
    if (!db) {
      return reply.status(500).send({ error: 'Banco de dados não disponível' });
    }

    const { email, password } = request.body;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email e senha são obrigatórios' });
    }

    try {
      // Busca usuário
      const [user] = await db.select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (!user) {
        return reply.status(401).send({ error: 'Email ou senha incorretos' });
      }

      if (!user.isActive) {
        return reply.status(401).send({ error: 'Conta desativada' });
      }

      // Verifica senha
      const passwordValid = await bcrypt.compare(password, user.passwordHash);
      if (!passwordValid) {
        return reply.status(401).send({ error: 'Email ou senha incorretos' });
      }

      // Gera token
      const token = generateToken(user);

      console.log(`[Auth] Login: ${user.email}`);

      return {
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          hasGmailConnected: !!user.gmailTokens,
        },
      };
    } catch (error) {
      console.error('[Auth] Erro no login:', error);
      return reply.status(500).send({ error: 'Erro ao fazer login' });
    }
  });

  // ===========================================
  // Obter Usuário Atual
  // ===========================================
  app.get('/me', { preHandler: [authMiddleware] }, async (request, reply) => {
    const db = getDb();
    if (!db) {
      return reply.status(500).send({ error: 'Banco de dados não disponível' });
    }

    try {
      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, request.user!.id))
        .limit(1);

      if (!user) {
        return reply.status(404).send({ error: 'Usuário não encontrado' });
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          hasGmailConnected: !!user.gmailTokens,
          createdAt: user.createdAt,
        },
      };
    } catch (error) {
      console.error('[Auth] Erro ao buscar usuário:', error);
      return reply.status(500).send({ error: 'Erro ao buscar usuário' });
    }
  });

  // ===========================================
  // Atualizar Perfil
  // ===========================================
  app.put<{
    Body: { name?: string; currentPassword?: string; newPassword?: string };
  }>('/me', { preHandler: [authMiddleware] }, async (request, reply) => {
    const db = getDb();
    if (!db) {
      return reply.status(500).send({ error: 'Banco de dados não disponível' });
    }

    const { name, currentPassword, newPassword } = request.body;
    const userId = request.user!.id;

    try {
      const updates: Partial<{ name: string; passwordHash: string; updatedAt: Date }> = {
        updatedAt: new Date(),
      };

      if (name) {
        updates.name = name;
      }

      // Mudança de senha
      if (currentPassword && newPassword) {
        if (newPassword.length < 6) {
          return reply.status(400).send({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
        }

        const [user] = await db.select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        const passwordValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!passwordValid) {
          return reply.status(400).send({ error: 'Senha atual incorreta' });
        }

        updates.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      }

      await db.update(users)
        .set(updates)
        .where(eq(users.id, userId));

      return { success: true, message: 'Perfil atualizado' };
    } catch (error) {
      console.error('[Auth] Erro ao atualizar perfil:', error);
      return reply.status(500).send({ error: 'Erro ao atualizar perfil' });
    }
  });

  // ===========================================
  // Gmail OAuth - URL de Autorização
  // ===========================================
  app.get('/gmail/url', { preHandler: [authMiddleware] }, async (request, reply) => {
    const configs = await getGlobalConfigs();
    
    const clientId = configs['gmail.clientId'];
    const redirectUri = configs['gmail.redirectUri'] || 
      `${process.env.API_URL || 'http://localhost:3001'}/api/auth/gmail/callback`;
    
    if (!clientId) {
      return reply.status(400).send({ 
        error: 'Gmail não configurado pelo administrador',
        code: 'GMAIL_NOT_CONFIGURED'
      });
    }

    const userId = request.user!.id;

    // Codifica userId no state para recuperar no callback
    const state = Buffer.from(JSON.stringify({ 
      userId,
      timestamp: Date.now(),
    })).toString('base64');

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.send',
    ].join(' ');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `state=${state}`;

    return { authUrl };
  });

  // ===========================================
  // Gmail OAuth - Callback
  // ===========================================
  app.get<{ 
    Querystring: { code?: string; error?: string; state?: string } 
  }>('/gmail/callback', async (request, reply) => {
    const db = getDb();
    if (!db) {
      return reply.redirect('/settings?error=database_unavailable');
    }

    const { code, error, state } = request.query;
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:5173';

    if (error) {
      console.error('[Auth] Erro OAuth:', error);
      return reply.redirect(`${dashboardUrl}/settings?error=${error}`);
    }

    if (!code || !state) {
      return reply.redirect(`${dashboardUrl}/settings?error=missing_params`);
    }

    try {
      // Decodifica state para obter userId
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      const userId = stateData.userId;

      if (!userId) {
        return reply.redirect(`${dashboardUrl}/settings?error=invalid_state`);
      }

      console.log(`[Auth] Gmail callback para usuário: ${userId}`);

      // Carrega configs globais
      const configs = await getGlobalConfigs();
      const clientId = configs['gmail.clientId'];
      const clientSecret = configs['gmail.clientSecret'];
      const redirectUri = configs['gmail.redirectUri'] || 
        `${process.env.API_URL || 'http://localhost:3001'}/api/auth/gmail/callback`;

      // Troca o código por tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json() as { error_description?: string; error?: string };
        console.error('[Auth] Erro ao trocar código:', errorData);
        throw new Error(errorData.error_description || errorData.error || 'Erro ao obter tokens');
      }

      const tokens = await tokenResponse.json();
      console.log('[Auth] Tokens Gmail obtidos com sucesso!');

      // Salva tokens NO USUÁRIO ESPECÍFICO (não global!)
      await db.update(users)
        .set({ 
          gmailTokens: tokens,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      console.log(`[Auth] Tokens salvos para usuário ${userId}`);

      return reply.redirect(`${dashboardUrl}/settings?gmail_auth=success`);
    } catch (err) {
      console.error('[Auth] Erro:', err);
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      return reply.redirect(`${dashboardUrl}/settings?error=${encodeURIComponent(message)}`);
    }
  });

  // ===========================================
  // Status da Autenticação Gmail
  // ===========================================
  app.get('/gmail/status', { preHandler: [authMiddleware] }, async (request, reply) => {
    const db = getDb();
    if (!db) {
      return reply.status(500).send({ error: 'Banco de dados não disponível' });
    }

    try {
      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, request.user!.id))
        .limit(1);

      // Verifica se Gmail está configurado globalmente
      const configs = await getGlobalConfigs();
      const gmailConfigured = !!(configs['gmail.clientId'] && configs['gmail.clientSecret']);

      return {
        gmailConfiguredByAdmin: gmailConfigured,
        userHasConnected: !!user?.gmailTokens,
      };
    } catch (error) {
      console.error('[Auth] Erro ao verificar status:', error);
      return reply.status(500).send({ error: 'Erro ao verificar status' });
    }
  });

  // ===========================================
  // Desconectar Gmail
  // ===========================================
  app.post('/gmail/disconnect', { preHandler: [authMiddleware] }, async (request, reply) => {
    const db = getDb();
    if (!db) {
      return reply.status(500).send({ error: 'Banco de dados não disponível' });
    }

    try {
      await db.update(users)
        .set({ 
          gmailTokens: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, request.user!.id));

      console.log(`[Auth] Gmail desconectado para usuário ${request.user!.id}`);

      return { success: true, message: 'Gmail desconectado' };
    } catch (error) {
      console.error('[Auth] Erro ao desconectar:', error);
      return reply.status(500).send({ error: 'Erro ao desconectar Gmail' });
    }
  });

  // ===========================================
  // Status Geral de Autenticação (público)
  // ===========================================
  app.get('/status', async () => {
    const configs = await getGlobalConfigs();

    return {
      gmail: {
        configured: !!(configs['gmail.clientId'] && configs['gmail.clientSecret']),
      },
      anthropic: {
        configured: !!configs['anthropic.apiKey'],
      },
      alchemy: {
        configured: !!configs['alchemy.apiKey'],
      },
    };
  });
};
