import type { FastifyPluginAsync } from 'fastify';
import { getScheduler } from '@agent-hub/core';
import type { EmailAgent } from '@agent-hub/email-agent';

export const authRoutes: FastifyPluginAsync = async (app) => {
  const scheduler = getScheduler();

  // Obtém URL de autorização do Gmail
  app.get('/gmail/url', async (request, reply) => {
    const agents = scheduler.getAgents();
    const emailAgentInfo = agents.find(a => a.config.id === 'email-agent');
    
    if (!emailAgentInfo) {
      return reply.status(404).send({ error: 'Email Agent não configurado' });
    }

    // Acessa o agente real através do scheduler interno
    // Por enquanto retornamos uma URL baseada nas env vars
    const clientId = process.env.GMAIL_CLIENT_ID;
    const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3001/api/auth/gmail/callback';
    
    if (!clientId) {
      return reply.status(400).send({ error: 'GMAIL_CLIENT_ID não configurado' });
    }

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
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

  // Callback do OAuth
  app.get<{ Querystring: { code?: string; error?: string } }>(
    '/gmail/callback',
    async (request, reply) => {
      const { code, error } = request.query;

      if (error) {
        return reply.redirect(`http://localhost:5173/settings?error=${error}`);
      }

      if (!code) {
        return reply.redirect('http://localhost:5173/settings?error=no_code');
      }

      try {
        // Aqui faria a troca do código por tokens
        // Por enquanto, apenas confirma recebimento
        console.log('[Auth] Código OAuth recebido:', code.substring(0, 20) + '...');
        
        return reply.redirect('http://localhost:5173/settings?success=true');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        return reply.redirect(`http://localhost:5173/settings?error=${encodeURIComponent(message)}`);
      }
    }
  );

  // Status da autenticação
  app.get('/status', async () => {
    // Verifica se temos tokens salvos
    const fs = await import('fs');
    const tokenExists = fs.existsSync('./token.json');

    return {
      gmail: {
        configured: !!process.env.GMAIL_CLIENT_ID,
        authenticated: tokenExists,
      },
      slack: {
        configured: !!process.env.SLACK_WEBHOOK_URL,
      },
      telegram: {
        configured: !!process.env.TELEGRAM_BOT_TOKEN,
      },
    };
  });
};
