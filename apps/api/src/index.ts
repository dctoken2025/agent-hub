import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Carrega .env da raiz do projeto
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { initDatabase } from './db/index.js';
import { agentRoutes } from './routes/agents.js';
import { emailRoutes } from './routes/emails.js';
import { authRoutes } from './routes/auth.js';
import { configRoutes } from './routes/config.js';
import { legalRoutes } from './routes/legal.js';
import { stablecoinRoutes } from './routes/stablecoins.js';
import { financialRoutes } from './routes/financial.js';
import { aiUsageRoutes } from './routes/ai-usage.js';
import { getAgentManager } from './services/agent-manager.js';

// Inicializa banco de dados
initDatabase();

const PORT = parseInt(process.env.PORT || process.env.API_PORT || '3001');

// Verifica se JWT_SECRET está configurado
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET não configurado. Gerando um temporário...');
  console.warn('⚠️  IMPORTANTE: Configure JWT_SECRET no .env para produção!');
  process.env.JWT_SECRET = 'temporary-secret-change-in-production-' + Date.now();
}

async function main() {
  const app = Fastify({
    logger: true,
  });

  // CORS para o dashboard
  const corsOrigins = process.env.CORS_ORIGINS;
  const allowedOrigins = corsOrigins === '*' 
    ? true 
    : corsOrigins 
      ? corsOrigins.split(',') 
      : ['http://localhost:5173', 'http://localhost:3000'];
  
  await app.register(cors, {
    origin: allowedOrigins,
    credentials: corsOrigins !== '*',
  });

  // Registra rotas
  await app.register(agentRoutes, { prefix: '/api/agents' });
  await app.register(emailRoutes, { prefix: '/api/emails' });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(configRoutes, { prefix: '/api/config' });
  await app.register(legalRoutes, { prefix: '/api/legal' });
  await app.register(stablecoinRoutes, { prefix: '/api/stablecoins' });
  await app.register(financialRoutes, { prefix: '/api/financial' });
  await app.register(aiUsageRoutes, { prefix: '/api/ai-usage' });

  // Health check (público)
  app.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Inicia servidor
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`\n🚀 API rodando em http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:5173`);
    console.log(`\n🔐 Sistema de autenticação ativo`);
    console.log(`   POST /api/auth/register - Criar conta`);
    console.log(`   POST /api/auth/login    - Fazer login`);
    console.log(`   GET  /api/auth/me       - Dados do usuário`);
    console.log(`\n📧 Agentes autônomos`);
    console.log(`   Auto-iniciando agentes de usuários ativos...\n`);

    // Auto-inicia agentes após servidor subir (com delay para garantir que DB está pronto)
    setTimeout(async () => {
      try {
        const agentManager = getAgentManager();
        await agentManager.autoStartAgents();
      } catch (error) {
        console.error('[Server] Erro ao auto-iniciar agentes:', error);
      }
    }, 3000); // 3 segundos de delay

  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
