-- Migration: Adiciona novos campos ao financial_items para formas de pagamento e recorrência
-- Data: 2025-12-20
-- Descrição: Adiciona campos para PIX, dados bancários e recorrência de cobranças

-- Adiciona campo para chave PIX
ALTER TABLE financial_items 
ADD COLUMN IF NOT EXISTS pix_key VARCHAR(255);

-- Adiciona campo para tipo de chave PIX (email, phone, cpf, cnpj, random)
ALTER TABLE financial_items 
ADD COLUMN IF NOT EXISTS pix_key_type VARCHAR(10);

-- Adiciona campo para dados bancários (JSON)
ALTER TABLE financial_items 
ADD COLUMN IF NOT EXISTS bank_account JSONB;

-- Adiciona campo para recorrência (once, weekly, monthly, quarterly, semiannual, annual)
ALTER TABLE financial_items 
ADD COLUMN IF NOT EXISTS recurrence VARCHAR(20);

-- Comentários para documentação
COMMENT ON COLUMN financial_items.pix_key IS 'Chave PIX para pagamento (email, telefone, CPF, CNPJ ou chave aleatória)';
COMMENT ON COLUMN financial_items.pix_key_type IS 'Tipo da chave PIX: email, phone, cpf, cnpj, random';
COMMENT ON COLUMN financial_items.bank_account IS 'Dados bancários para transferência: { bank, agency, account, accountType, holder }';
COMMENT ON COLUMN financial_items.recurrence IS 'Tipo de recorrência: once, weekly, monthly, quarterly, semiannual, annual';

