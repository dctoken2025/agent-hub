-- Adiciona campo para contexto personalizado de cada agente
-- O contexto é gerado pela IA através do fluxo "Ensinar Agente"

ALTER TABLE user_configs 
ADD COLUMN IF NOT EXISTS agent_contexts jsonb DEFAULT '{
  "email": null,
  "legal": null,
  "financial": null,
  "stablecoin": null,
  "task": null
}'::jsonb;

COMMENT ON COLUMN user_configs.agent_contexts IS 'Contexto personalizado de cada agente, gerado pelo fluxo de ensino com IA';

