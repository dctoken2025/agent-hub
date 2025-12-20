// Script para rodar migrations no banco de produção
import pkg from 'pg';
const { Client } = pkg;

const MIGRATION_SQL = `
-- Migration: Adicionar campo account_status na tabela users
-- Permite controle de aprovação de contas pelo admin

-- Adiciona a coluna account_status se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'account_status'
    ) THEN
        ALTER TABLE users ADD COLUMN account_status VARCHAR(20) NOT NULL DEFAULT 'active';
    END IF;
END $$;

-- Atualiza contas existentes para 'active' (já foram aprovadas implicitamente)
UPDATE users SET account_status = 'active' WHERE account_status IS NULL OR account_status = '';

-- Confirma a alteração
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'account_status';
`;

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL não configurado');
    process.exit(1);
  }

  console.log('🔧 Conectando ao banco de dados...');
  
  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('railway') ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados');
    
    console.log('📜 Executando migration: add_account_status...');
    const result = await client.query(MIGRATION_SQL);
    
    console.log('✅ Migration executada com sucesso!');
    
    // Mostra o resultado da verificação
    if (result && result.rows) {
      console.log('📋 Verificação da coluna:');
      console.log(result.rows);
    }
    
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();

