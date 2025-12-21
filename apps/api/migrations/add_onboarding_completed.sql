-- Adiciona campo para marcar se o usuário completou o onboarding
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

COMMENT ON COLUMN users.onboarding_completed IS 'Se o usuário já completou o tutorial de onboarding';
