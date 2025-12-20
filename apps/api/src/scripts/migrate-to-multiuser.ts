/**
 * Script de Migração: Mono-usuário → Multi-usuário
 * 
 * Este script:
 * 1. Cria as novas tabelas (users, global_config, user_configs)
 * 2. Migra o primeiro usuário como admin
 * 3. Migra configurações globais
 * 4. Associa todos os dados existentes ao admin
 * 
 * Uso: npx tsx apps/api/src/scripts/migrate-to-multiuser.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import * as readline from 'readline';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não configurada');
  process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function migrate() {
  console.log('🚀 Iniciando migração para multi-usuário...\n');

  try {
    // ===========================================
    // 1. Criar novas tabelas
    // ===========================================
    console.log('📦 Criando novas tabelas...');

    // Tabela users
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        role VARCHAR(20) NOT NULL DEFAULT 'user',
        gmail_tokens JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `));
    console.log('   ✅ Tabela users criada');

    // Tabela global_config
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS global_config (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) NOT NULL UNIQUE,
        value TEXT,
        is_secret BOOLEAN DEFAULT false,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `));
    console.log('   ✅ Tabela global_config criada');

    // Tabela user_configs
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS user_configs (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        vip_senders TEXT[],
        ignore_senders TEXT[],
        email_agent_config JSONB DEFAULT '{"enabled": true, "intervalMinutes": 10, "maxEmailsPerRun": 50, "processContracts": true, "unreadOnly": true, "customRules": []}',
        legal_agent_config JSONB DEFAULT '{"enabled": true, "autoAnalyze": true, "maxDocumentSizeMB": 10}',
        stablecoin_agent_config JSONB DEFAULT '{"enabled": false, "checkInterval": 60}',
        notification_config JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `));
    console.log('   ✅ Tabela user_configs criada');

    // ===========================================
    // 2. Adicionar colunas user_id nas tabelas existentes
    // ===========================================
    console.log('\n📝 Adicionando colunas user_id...');

    const tablesToUpdate = [
      'classified_emails',
      'agent_logs',
      'legal_analyses',
      'stablecoins',
      'stablecoin_events',
      'stablecoin_anomalies',
      'supply_snapshots',
      'daily_stats',
    ];

    for (const table of tablesToUpdate) {
      try {
        await db.execute(sql.raw(`
          ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
        `));
        console.log(`   ✅ Coluna user_id adicionada em ${table}`);
      } catch (error) {
        console.log(`   ⚠️ ${table}: ${(error as Error).message}`);
      }
    }

    // ===========================================
    // 3. Verificar se já existe dados
    // ===========================================
    console.log('\n🔍 Verificando dados existentes...');

    const existingUsers = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM users`));
    const userCount = parseInt((existingUsers as any[])[0]?.count || '0');

    if (userCount > 0) {
      console.log(`   ℹ️ Já existem ${userCount} usuários. Pulando criação do admin.`);
    } else {
      // ===========================================
      // 4. Criar usuário admin
      // ===========================================
      console.log('\n👤 Criando usuário administrador...');

      // Busca email e tokens do app_config antigo
      let adminEmail = '';
      let gmailTokens = null;

      try {
        const emailResult = await db.execute(sql.raw(`
          SELECT value FROM app_config WHERE key = 'user.email'
        `));
        adminEmail = (emailResult as any[])[0]?.value || '';

        const tokensResult = await db.execute(sql.raw(`
          SELECT value FROM app_config WHERE key = 'gmail.tokens'
        `));
        if ((tokensResult as any[])[0]?.value) {
          gmailTokens = (tokensResult as any[])[0].value;
        }
      } catch {
        console.log('   ⚠️ Tabela app_config não encontrada ou vazia');
      }

      if (!adminEmail) {
        adminEmail = await prompt('   Email do administrador: ');
      } else {
        console.log(`   📧 Email encontrado: ${adminEmail}`);
      }

      const adminPassword = await prompt('   Senha do administrador (mínimo 6 caracteres): ');
      
      if (adminPassword.length < 6) {
        console.error('❌ Senha deve ter pelo menos 6 caracteres');
        process.exit(1);
      }

      const passwordHash = await bcrypt.hash(adminPassword, 10);

      const insertResult = await db.execute(sql.raw(`
        INSERT INTO users (email, password_hash, name, role, gmail_tokens)
        VALUES ('${adminEmail.toLowerCase()}', '${passwordHash}', 'Administrador', 'admin', ${gmailTokens ? `'${gmailTokens}'::jsonb` : 'NULL'})
        RETURNING id
      `));

      const adminId = (insertResult as any[])[0]?.id;
      console.log(`   ✅ Admin criado com ID: ${adminId}`);

      // Cria user_configs para o admin
      await db.execute(sql.raw(`
        INSERT INTO user_configs (user_id, vip_senders, ignore_senders)
        VALUES ('${adminId}', ARRAY[]::text[], ARRAY['newsletter', 'marketing', 'noreply'])
      `));
      console.log('   ✅ Configurações do admin criadas');

      // ===========================================
      // 5. Migrar configurações globais
      // ===========================================
      console.log('\n⚙️ Migrando configurações globais...');

      const globalKeys = [
        'anthropic.apiKey',
        'gmail.clientId',
        'gmail.clientSecret',
        'gmail.redirectUri',
        'alchemy.apiKey',
      ];

      for (const key of globalKeys) {
        try {
          const result = await db.execute(sql.raw(`
            SELECT value, is_secret FROM app_config WHERE key = '${key}'
          `));
          
          if ((result as any[])[0]?.value) {
            const value = (result as any[])[0].value;
            const isSecret = (result as any[])[0].is_secret || false;
            
            await db.execute(sql.raw(`
              INSERT INTO global_config (key, value, is_secret)
              VALUES ('${key}', '${value.replace(/'/g, "''")}', ${isSecret})
              ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            `));
            console.log(`   ✅ Migrado: ${key}`);
          }
        } catch (error) {
          console.log(`   ⚠️ ${key}: não encontrado`);
        }
      }

      // ===========================================
      // 6. Associar dados existentes ao admin
      // ===========================================
      console.log('\n🔗 Associando dados existentes ao admin...');

      for (const table of tablesToUpdate) {
        try {
          await db.execute(sql.raw(`
            UPDATE ${table} SET user_id = '${adminId}' WHERE user_id IS NULL
          `));
          console.log(`   ✅ ${table} atualizado`);
        } catch (error) {
          console.log(`   ⚠️ ${table}: ${(error as Error).message}`);
        }
      }
    }

    // ===========================================
    // 7. Criar índices
    // ===========================================
    console.log('\n📊 Criando índices...');

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_classified_emails_user_id ON classified_emails(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_agent_logs_user_id ON agent_logs(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_legal_analyses_user_id ON legal_analyses(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_stablecoins_user_id ON stablecoins(user_id)',
    ];

    for (const indexSql of indexes) {
      try {
        await db.execute(sql.raw(indexSql));
        console.log(`   ✅ Índice criado`);
      } catch (error) {
        console.log(`   ⚠️ ${(error as Error).message}`);
      }
    }

    console.log('\n✅ Migração concluída com sucesso!');
    console.log('\n📋 Próximos passos:');
    console.log('   1. Configure JWT_SECRET no .env');
    console.log('   2. Faça deploy da API');
    console.log('   3. Faça deploy do Dashboard');
    console.log('   4. Faça login com o email/senha do admin\n');

  } catch (error) {
    console.error('\n❌ Erro na migração:', error);
    process.exit(1);
  }

  await client.end();
  process.exit(0);
}

migrate();
