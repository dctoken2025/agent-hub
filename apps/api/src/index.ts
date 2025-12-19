import Fastify from 'fastify';
import cors from '@fastify/cors';
import { getScheduler, Notifier } from '@agent-hub/core';
import { EmailAgent, type EmailAgentConfig } from '@agent-hub/email-agent';
import { agentRoutes } from './routes/agents.js';
import { emailRoutes } from './routes/emails.js';
import { authRoutes } from './routes/auth.js';

const PORT = parseInt(process.env.API_PORT || '3001');

async function main() {
  const app = Fastify({
    logger: true,
  });

  // CORS para o dashboard
  await app.register(cors, {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  });

  // Registra rotas
  await app.register(agentRoutes, { prefix: '/api/agents' });
  await app.register(emailRoutes, { prefix: '/api/emails' });
  await app.register(authRoutes, { prefix: '/api/auth' });

  // Health check
  app.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Inicializa o Email Agent se configurado
  if (process.env.GMAIL_CLIENT_ID) {
    const emailConfig: EmailAgentConfig = {
      userEmail: process.env.USER_EMAIL || '',
      vipSenders: (process.env.VIP_SENDERS || '').split(',').filter(Boolean),
      ignoreSenders: (process.env.IGNORE_SENDERS || '').split(',').filter(Boolean),
      labelsToProcess: ['INBOX'],
      maxEmailsPerRun: 50,
      unreadOnly: true,
    };

    const notifier = process.env.SLACK_WEBHOOK_URL
      ? new Notifier({ slack: { webhookUrl: process.env.SLACK_WEBHOOK_URL } })
      : undefined;

    const emailAgent = new EmailAgent(
      {
        id: 'email-agent',
        name: 'Email Agent',
        description: 'Agente de classificação e triagem de emails',
        enabled: true,
        schedule: {
          type: 'interval',
          value: parseInt(process.env.EMAIL_CHECK_INTERVAL || '5'),
        },
      },
      emailConfig,
      notifier
    );

    const scheduler = getScheduler();
    scheduler.register(emailAgent);

    console.log('📧 Email Agent registrado');
  }

  // Inicia servidor
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 API rodando em http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:5173`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
