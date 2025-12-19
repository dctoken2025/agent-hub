import type { FastifyPluginAsync } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from './config.js';
import { getDb, appConfig } from '../db/index.js';
import { eq } from 'drizzle-orm';

const TOKEN_FILE = path.join(process.cwd(), 'gmail-tokens.json');

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Obtém URL de autorização do Gmail
  app.get('/gmail/url', async (_request, reply) => {
    const config = await loadConfig();
    
    const clientId = config.gmail.clientId;
    const redirectUri = config.gmail.redirectUri || 'http://localhost:3001/api/auth/gmail/callback';
    
    if (!clientId) {
      return reply.status(400).send({ error: 'GMAIL_CLIENT_ID não configurado' });
    }

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
      `prompt=consent`;

    return { authUrl };
  });

  // Callback do OAuth - troca código por tokens
  app.get<{ Querystring: { code?: string; error?: string } }>(
    '/gmail/callback',
    async (request, reply) => {
      const { code, error } = request.query;

      if (error) {
        console.error('[Auth] Erro OAuth:', error);
        return reply.redirect(`http://localhost:5173/settings?error=${error}`);
      }

      if (!code) {
        return reply.redirect('http://localhost:5173/settings?error=no_code');
      }

      try {
        console.log('[Auth] Código OAuth recebido, trocando por tokens...');
        
        const config = await loadConfig();
        const redirectUri = config.gmail.redirectUri || 'http://localhost:3001/api/auth/gmail/callback';

        // Troca o código por tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            code,
            client_id: config.gmail.clientId,
            client_secret: config.gmail.clientSecret,
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
        console.log('[Auth] Tokens obtidos com sucesso!');

        // Salva tokens em arquivo
        fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
        console.log('[Auth] Tokens salvos em', TOKEN_FILE);

        // Também salva no banco
        const db = getDb();
        if (db) {
          const tokenData = JSON.stringify(tokens);
          const existing = await db.select().from(appConfig).where(eq(appConfig.key, 'gmail.tokens'));
          
          if (existing.length > 0) {
            await db.update(appConfig)
              .set({ value: tokenData, isSecret: true, updatedAt: new Date() })
              .where(eq(appConfig.key, 'gmail.tokens'));
          } else {
            await db.insert(appConfig).values({ 
              key: 'gmail.tokens', 
              value: tokenData, 
              isSecret: true 
            });
          }
          console.log('[Auth] Tokens salvos no banco');
        }

        return reply.redirect('http://localhost:5173/settings?gmail_auth=success');
      } catch (err) {
        console.error('[Auth] Erro:', err);
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        return reply.redirect(`http://localhost:5173/settings?error=${encodeURIComponent(message)}`);
      }
    }
  );

  // Status da autenticação
  app.get('/status', async () => {
    const config = await loadConfig();
    
    // Verifica se temos tokens salvos
    const tokenExists = fs.existsSync(TOKEN_FILE);
    
    // Também verifica no banco
    const db = getDb();
    let tokensInDb = false;
    if (db) {
      const result = await db.select().from(appConfig).where(eq(appConfig.key, 'gmail.tokens'));
      tokensInDb = result.length > 0 && !!result[0].value;
    }

    return {
      gmail: {
        configured: !!config.gmail.clientId && !!config.gmail.clientSecret,
        authenticated: tokenExists || tokensInDb,
      },
      slack: {
        configured: !!config.notifications.slackWebhookUrl,
      },
      telegram: {
        configured: !!config.notifications.telegramBotToken,
      },
      database: {
        connected: db !== null,
      },
    };
  });

  // Revoga autenticação do Gmail
  app.post('/gmail/revoke', async () => {
    try {
      // Remove arquivo de tokens
      if (fs.existsSync(TOKEN_FILE)) {
        fs.unlinkSync(TOKEN_FILE);
      }

      // Remove do banco
      const db = getDb();
      if (db) {
        await db.delete(appConfig).where(eq(appConfig.key, 'gmail.tokens'));
      }

      return { success: true, message: 'Autenticação revogada' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro' };
    }
  });
};
