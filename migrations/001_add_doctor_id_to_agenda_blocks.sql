-- Adicionar doctor_id opcional na tabela agenda_blocks
-- NULL = bloqueio para clínica inteira
-- NOT NULL = bloqueio apenas para o profissional específico

ALTER TABLE agenda_blocks 
ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE;

-- Criar índice para melhorar performance das queries
CREATE INDEX IF NOT EXISTS idx_agenda_blocks_doctor_id ON agenda_blocks(doctor_id);

-- Comentário explicativo
COMMENT ON COLUMN agenda_blocks.doctor_id IS 'NULL = bloqueio para clínica inteira, NOT NULL = bloqueio apenas para este profissional';
