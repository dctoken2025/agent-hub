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
  // LOGIN COM GOOGLE (Principal)
  // ===========================================
  
  // URL para iniciar login com Google
  app.get('/google/url', async (request, reply) => {
    const configs = await getGlobalConfigs();
    
    const clientId = configs['gmail.clientId'];
    const redirectUri = configs['gmail.redirectUri'] || 
      `${process.env.API_URL || 'http://localhost:3001'}/api/auth/google/callback`;
    
    if (!clientId) {
      return reply.status(400).send({ 
        error: 'Google OAuth não configurado pelo administrador',
        code: 'GOOGLE_NOT_CONFIGURED'
      });
    }

    // State para segurança (CSRF protection)
    const state = Buffer.from(JSON.stringify({ 
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(7),
    })).toString('base64');

    // Escopos: perfil do usuário + Gmail
    const scopes = [
      'openid',
      'email',
      'profile',
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

    // Retorna URL ou redireciona dependendo do Accept header
    const acceptHeader = request.headers.accept || '';
    if (acceptHeader.includes('application/json')) {
      return { authUrl };
    }
    
    return reply.redirect(authUrl);
  });

  // Callback do Google OAuth (Login/Registro)
  app.get<{ 
    Querystring: { code?: string; error?: string; state?: string } 
  }>('/google/callback', async (request, reply) => {
    const db = getDb();
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:5173';

    if (!db) {
      return reply.redirect(`${dashboardUrl}?error=database_unavailable`);
    }

    const { code, error } = request.query;

    if (error) {
      console.error('[Auth] Erro Google OAuth:', error);
      return reply.redirect(`${dashboardUrl}?error=${error}`);
    }

    if (!code) {
      return reply.redirect(`${dashboardUrl}?error=missing_code`);
    }

    try {
      // Carrega configs globais
      const configs = await getGlobalConfigs();
      const clientId = configs['gmail.clientId'];
      const clientSecret = configs['gmail.clientSecret'];
      const redirectUri = configs['gmail.redirectUri'] || 
        `${process.env.API_URL || 'http://localhost:3001'}/api/auth/google/callback`;

      // 1. Troca o código por tokens
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

      const tokens = await tokenResponse.json() as {
        access_token: string;
        refresh_token?: string;
        id_token?: string;
        expires_in: number;
        scope: string;
      };

      // 2. Obtém informações do usuário do Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      if (!userInfoResponse.ok) {
        throw new Error('Erro ao obter informações do usuário');
      }

      const googleUser = await userInfoResponse.json() as {
        id: string;
        email: string;
        name: string;
        picture?: string;
      };

      console.log(`[Auth] Login Google: ${googleUser.email}`);

      // 3. Cria ou atualiza usuário
      let [existingUser] = await db.select()
        .from(users)
        .where(eq(users.email, googleUser.email.toLowerCase()))
        .limit(1);

      let user;
      let isNewUser = false;

      if (existingUser) {
        // Atualiza tokens do Gmail
        await db.update(users)
          .set({ 
            gmailTokens: tokens,
            name: existingUser.name || googleUser.name, // Atualiza nome se não tinha
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingUser.id));

        user = { ...existingUser, gmailTokens: tokens };
        console.log(`[Auth] Usuário existente atualizado: ${user.email}`);
      } else {
        // Verifica se é o primeiro usuário (será admin)
        const userCount = await db.select({ id: users.id }).from(users).limit(1);
        const isFirstUser = userCount.length === 0;

        // Cria novo usuário (sem senha - login apenas via Google)
        // Primeiro usuário é admin e já ativo, demais entram em trial de 7 dias
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 7); // 7 dias de trial
        
        const [newUser] = await db.insert(users).values({
          email: googleUser.email.toLowerCase(),
          passwordHash: '', // Sem senha - apenas Google login
          name: googleUser.name,
          role: isFirstUser ? 'admin' : 'user',
          gmailTokens: tokens,
          isActive: true, // Todos os usuários começam ativos
          accountStatus: isFirstUser ? 'active' : 'active', // Todos começam ativos (trial controla o acesso)
          trialEndsAt: isFirstUser ? null : trialEndsAt, // Admin não tem trial, demais têm 7 dias
        }).returning();

        // Cria configurações padrão
        await db.insert(userConfigs).values({
          userId: newUser.id,
          vipSenders: [],
          ignoreSenders: ['newsletter', 'marketing', 'noreply'],
        });

        user = newUser;
        isNewUser = true;
        console.log(`[Auth] Novo usuário criado: ${user.email} (role: ${user.role})`);
      }

      // 4. Gera JWT
      const jwtToken = generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      // 5. Redireciona para o dashboard com o token
      const redirectUrl = new URL(dashboardUrl);
      redirectUrl.searchParams.set('token', jwtToken);
      if (isNewUser) {
        redirectUrl.searchParams.set('welcome', 'true');
      }

      return reply.redirect(redirectUrl.toString());
    } catch (err) {
      console.error('[Auth] Erro no callback Google:', err);
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      return reply.redirect(`${dashboardUrl}?error=${encodeURIComponent(message)}`);
    }
  });

  // ===========================================
  // Registro Manual (backup - ainda disponível)
  // ===========================================
  app.post<{
    Body: { email: string; password: string; name?: string };
  }>('/register', async (request, reply) => {
    const db = getDb();
    if (!db) {
      return reply.status(500).send({ error: 'Banco de dados não disponível' });
    }

    const { email, password, name } = request.body;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email e senha são obrigatórios' });
    }

    if (password.length < 6) {
      return reply.status(400).send({ error: 'Senha deve ter pelo menos 6 caracteres' });
    }

    if (!email.includes('@')) {
      return reply.status(400).send({ error: 'Email inválido' });
    }

    try {
      const existing = await db.select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (existing.length > 0) {
        return reply.status(400).send({ error: 'Este email já está cadastrado' });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const userCount = await db.select({ id: users.id }).from(users).limit(1);
      const isFirstUser = userCount.length === 0;

      // Primeiro usuário é admin e já ativo, demais entram em trial de 7 dias
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 7); // 7 dias de trial
      
      const [newUser] = await db.insert(users).values({
        email: email.toLowerCase(),
        passwordHash,
        name: name || email.split('@')[0],
        role: isFirstUser ? 'admin' : 'user',
        isActive: true,
        accountStatus: 'active',
        trialEndsAt: isFirstUser ? null : trialEndsAt, // Admin não tem trial
      }).returning();

      await db.insert(userConfigs).values({
        userId: newUser.id,
        vipSenders: [],
        ignoreSenders: ['newsletter', 'marketing', 'noreply'],
      });

      const token = generateToken(newUser);

      return {
        success: true,
        message: isFirstUser ? 'Conta de administrador criada!' : 'Conta criada!',
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
      return reply.status(500).send({ error: 'Erro ao criar conta' });
    }
  });

  // ===========================================
  // Login Manual (backup)
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

      // Se usuário foi criado via Google (sem senha), orienta usar Google
      if (!user.passwordHash) {
        return reply.status(401).send({ 
          error: 'Esta conta usa Login com Google. Clique em "Entrar com Google".',
          useGoogle: true,
        });
      }

      const passwordValid = await bcrypt.compare(password, user.passwordHash);
      if (!passwordValid) {
        return reply.status(401).send({ error: 'Email ou senha incorretos' });
      }

      const token = generateToken(user);

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

      // Calcula dias restantes do trial
      let trialDaysRemaining: number | null = null;
      let isTrialExpired = false;
      
      if (user.trialEndsAt && user.role !== 'admin') {
        const now = new Date();
        const diffTime = user.trialEndsAt.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        trialDaysRemaining = Math.max(0, diffDays);
        isTrialExpired = diffDays <= 0;
        
        // Se expirou, atualiza o status
        if (isTrialExpired && user.accountStatus === 'active') {
          await db.update(users)
            .set({ accountStatus: 'trial_expired' })
            .where(eq(users.id, user.id));
          user.accountStatus = 'trial_expired';
        }
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          accountStatus: user.accountStatus,
          hasGmailConnected: !!user.gmailTokens,
          createdAt: user.createdAt,
          trialEndsAt: user.trialEndsAt,
          trialDaysRemaining,
          isTrialExpired,
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

      if (currentPassword && newPassword) {
        if (newPassword.length < 6) {
          return reply.status(400).send({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
        }

        const [user] = await db.select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user.passwordHash) {
          return reply.status(400).send({ error: 'Conta usa Login com Google, não é possível definir senha' });
        }

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
  // Gmail OAuth - Reconectar (para usuários já logados)
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

  // Gmail callback para reconexão
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
      return reply.redirect(`${dashboardUrl}/settings?error=${error}`);
    }

    if (!code || !state) {
      return reply.redirect(`${dashboardUrl}/settings?error=missing_params`);
    }

    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      const userId = stateData.userId;

      if (!userId) {
        return reply.redirect(`${dashboardUrl}/settings?error=invalid_state`);
      }

      const configs = await getGlobalConfigs();
      const clientId = configs['gmail.clientId'];
      const clientSecret = configs['gmail.clientSecret'];
      const redirectUri = configs['gmail.redirectUri'] || 
        `${process.env.API_URL || 'http://localhost:3001'}/api/auth/gmail/callback`;

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json() as { error_description?: string };
        throw new Error(errorData.error_description || 'Erro ao obter tokens');
      }

      const tokens = await tokenResponse.json();

      await db.update(users)
        .set({ gmailTokens: tokens, updatedAt: new Date() })
        .where(eq(users.id, userId));

      return reply.redirect(`${dashboardUrl}/settings?gmail_auth=success`);
    } catch (err) {
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

      const configs = await getGlobalConfigs();
      const gmailConfigured = !!(configs['gmail.clientId'] && configs['gmail.clientSecret']);

      return {
        gmailConfiguredByAdmin: gmailConfigured,
        userHasConnected: !!user?.gmailTokens,
      };
    } catch (error) {
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
        .set({ gmailTokens: null, updatedAt: new Date() })
        .where(eq(users.id, request.user!.id));

      return { success: true, message: 'Gmail desconectado' };
    } catch (error) {
      return reply.status(500).send({ error: 'Erro ao desconectar Gmail' });
    }
  });

  // ===========================================
  // Status Geral (público)
  // ===========================================
  app.get('/status', async () => {
    const configs = await getGlobalConfigs();

    return {
      googleLogin: {
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
