-- Adiciona campo trial_ends_at para controle do período de teste
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP;

-- Define trial_ends_at para usuários existentes com status 'active' (sem limite de trial)
-- Usuários ativos antes dessa feature não terão limite
-- Novos usuários terão trial_ends_at definido automaticamente no registro

-- Para usuários pending existentes, define trial de 7 dias a partir de agora
UPDATE users 
SET trial_ends_at = NOW() + INTERVAL '7 days'
WHERE account_status = 'pending' AND trial_ends_at IS NULL;

-- Usuários ativos não precisam de trial_ends_at (null = sem limite)
-- UPDATE users SET trial_ends_at = NULL WHERE account_status = 'active';

