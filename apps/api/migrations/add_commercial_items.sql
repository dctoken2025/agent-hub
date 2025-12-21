-- Migration: add_commercial_items
-- Description: Adiciona tabela para itens comerciais (cotações, propostas, oportunidades)
-- Date: 2024-12-21

-- Tabela de itens comerciais
CREATE TABLE IF NOT EXISTS commercial_items (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email_id VARCHAR(255) NOT NULL,
  thread_id VARCHAR(255),
  
  -- Contexto do email original
  email_subject TEXT,
  email_from VARCHAR(255),
  email_date TIMESTAMP,

  -- Tipo e status
  type VARCHAR(20) NOT NULL, -- quote_request, proposal, negotiation, order, follow_up, complaint, renewal, opportunity, outro
  status VARCHAR(20) NOT NULL DEFAULT 'new', -- new, in_progress, quoted, negotiating, won, lost, cancelled, on_hold
  
  -- Cliente/Contato
  client_name VARCHAR(255) NOT NULL,
  client_company VARCHAR(255),
  client_email VARCHAR(255),
  client_phone VARCHAR(50),
  client_type VARCHAR(20), -- prospect, new_client, existing_client, strategic_client, partner, distributor, other
  
  -- Detalhes da oportunidade
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  products_services TEXT, -- JSON array
  estimated_value INTEGER, -- Valor em centavos
  currency VARCHAR(10) DEFAULT 'BRL',
  quantity VARCHAR(255),
  
  -- Prazos
  deadline_date TIMESTAMP,
  desired_delivery_date TIMESTAMP,
  
  -- Competição
  has_competitors BOOLEAN DEFAULT FALSE,
  competitor_names TEXT, -- JSON array
  is_urgent_bid BOOLEAN DEFAULT FALSE,
  
  -- Priorização
  priority VARCHAR(10) DEFAULT 'normal', -- critical, high, normal, low
  priority_reason VARCHAR(255),
  
  -- Próximas ações
  suggested_action TEXT,
  suggested_response TEXT,
  
  -- Resolução
  won_at TIMESTAMP,
  lost_at TIMESTAMP,
  lost_reason TEXT,
  won_value INTEGER, -- Valor final fechado em centavos
  
  -- Responsável
  assigned_to VARCHAR(255),
  assigned_at TIMESTAMP,
  
  -- Tags e notas
  tags TEXT, -- JSON array
  notes TEXT,
  
  -- Metadados
  confidence INTEGER, -- 0-100
  analyzed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_commercial_items_user_id ON commercial_items(user_id);
CREATE INDEX IF NOT EXISTS idx_commercial_items_status ON commercial_items(status);
CREATE INDEX IF NOT EXISTS idx_commercial_items_type ON commercial_items(type);
CREATE INDEX IF NOT EXISTS idx_commercial_items_priority ON commercial_items(priority);
CREATE INDEX IF NOT EXISTS idx_commercial_items_email_id ON commercial_items(email_id);
CREATE INDEX IF NOT EXISTS idx_commercial_items_created_at ON commercial_items(created_at);

-- Adiciona coluna commercial_agent_config na tabela user_configs se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_configs' AND column_name = 'commercial_agent_config'
  ) THEN
    ALTER TABLE user_configs ADD COLUMN commercial_agent_config JSONB DEFAULT '{
      "enabled": true,
      "autoAnalyze": true,
      "commercialKeywords": [
        "cotação", "orçamento", "quote", "proposta comercial",
        "pedido de preço", "solicitação de preço", "quanto custa",
        "pedido", "compra", "aquisição", "interesse em adquirir",
        "negociação", "desconto", "condições comerciais",
        "licitação", "pregão", "concorrência", "edital",
        "renovação", "parceria", "distribuição"
      ],
      "vipClients": [],
      "productsServices": [],
      "highValueThreshold": 10000000,
      "urgentDaysBeforeDeadline": 2
    }'::jsonb;
  END IF;
END $$;

-- Atualiza agent_contexts para incluir commercial se não existir
UPDATE user_configs
SET agent_contexts = agent_contexts || '{"commercial": null}'::jsonb
WHERE agent_contexts IS NOT NULL 
  AND NOT agent_contexts ? 'commercial';

