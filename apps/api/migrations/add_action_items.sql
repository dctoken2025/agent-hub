-- Migration: Criar tabela action_items para o Task Agent
-- Armazena tarefas/action items extraídos de emails

CREATE TABLE IF NOT EXISTS action_items (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email_id VARCHAR(255) NOT NULL,
  thread_id VARCHAR(255),
  
  -- Contexto do email
  email_subject TEXT NOT NULL,
  email_from VARCHAR(255) NOT NULL,
  email_date TIMESTAMP,
  
  -- Stakeholder
  stakeholder_name VARCHAR(255) NOT NULL,
  stakeholder_company VARCHAR(255),
  stakeholder_role VARCHAR(255),
  stakeholder_email VARCHAR(255),
  stakeholder_phone VARCHAR(50),
  stakeholder_importance VARCHAR(20) DEFAULT 'normal', -- vip, high, normal
  
  -- Projeto
  project_name VARCHAR(255),
  project_code VARCHAR(100),
  project_type VARCHAR(100),
  
  -- A tarefa
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  original_text TEXT NOT NULL,
  category VARCHAR(30) NOT NULL, -- confirmation, status_update, deadline, document, approval, action, question, information, followup
  
  -- Prazo
  deadline_date TIMESTAMP,
  deadline_relative VARCHAR(255), -- "semana que vem", "15dc após"
  deadline_is_explicit BOOLEAN DEFAULT false,
  deadline_depends_on TEXT, -- "após liquidação integral das NC"
  deadline_urgency VARCHAR(20), -- immediate, soon, normal, flexible
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, in_progress, waiting, done, cancelled
  
  -- Resposta
  response_text TEXT,
  responded_at TIMESTAMP,
  responded_by VARCHAR(255),
  
  -- Prioridade
  priority VARCHAR(20) NOT NULL DEFAULT 'medium', -- critical, high, medium, low
  priority_reason VARCHAR(255),
  
  -- Sugestões da IA
  suggested_response TEXT,
  suggested_action TEXT,
  related_documents TEXT, -- JSON array
  blocked_by_external VARCHAR(255),
  
  -- Confiança
  confidence INTEGER, -- 0-100
  
  -- Metadados
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_action_items_user_id ON action_items(user_id);
CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items(status);
CREATE INDEX IF NOT EXISTS idx_action_items_priority ON action_items(priority);
CREATE INDEX IF NOT EXISTS idx_action_items_email_id ON action_items(email_id);
CREATE INDEX IF NOT EXISTS idx_action_items_project ON action_items(project_name);
CREATE INDEX IF NOT EXISTS idx_action_items_deadline ON action_items(deadline_date);
