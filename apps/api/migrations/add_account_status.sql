-- Migration: Adicionar campo account_status na tabela users
-- Permite controle de aprovação de contas pelo admin

-- Adiciona a coluna account_status
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'active';

-- Atualiza contas existentes para 'active' (já foram aprovadas implicitamente)
UPDATE users SET account_status = 'active' WHERE account_status = 'pending';

-- Para novos usuários, o default será 'pending' (será configurado na aplicação)
-- O primeiro usuário (admin) será automaticamente 'active'

-- Comentário sobre os status possíveis:
-- 'pending'   - Conta nova aguardando aprovação do admin
-- 'active'    - Conta ativa com acesso total
-- 'suspended' - Conta suspensa pelo admin (não pode usar agentes)

