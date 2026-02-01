-- Migration 013: Motivo de Cancelamento e Reagendamento
-- Adiciona campos para registrar motivo de cancelamento, quem cancelou,
-- se foi via lembrete, no-show e informações de reagendamento
--
-- Campos adicionados:
-- - cancellation_reason: motivo do cancelamento (texto livre)
-- - cancelled_by: quem cancelou (patient/operator/system)
-- - cancelled_via_reminder: se cancelamento veio do link de lembrete
-- - no_show_at: quando foi marcado como falta
-- - rescheduled_to_appointment_id: link para novo agendamento
-- - rescheduled_notes: observações sobre reagendamento
--
-- Todos os campos são nullable para compatibilidade com registros existentes

-- Adicionar colunas de cancelamento e reagendamento
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(20),
ADD COLUMN IF NOT EXISTS cancelled_via_reminder BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rescheduled_to_appointment_id UUID REFERENCES appointments(id),
ADD COLUMN IF NOT EXISTS rescheduled_notes TEXT;

-- Comentários para documentação
COMMENT ON COLUMN appointments.cancellation_reason IS 'Motivo do cancelamento descrito pelo operador ou paciente.';
COMMENT ON COLUMN appointments.cancelled_by IS 'Quem cancelou: patient (link), operator (Proton), system (automático no-show).';
COMMENT ON COLUMN appointments.cancelled_via_reminder IS 'true se cancelamento veio do link de lembrete enviado por WhatsApp.';
COMMENT ON COLUMN appointments.no_show_at IS 'Data/hora em que foi marcado como falta (no-show) pelo sistema.';
COMMENT ON COLUMN appointments.rescheduled_to_appointment_id IS 'Se reagendado, ID do novo agendamento.';
COMMENT ON COLUMN appointments.rescheduled_notes IS 'Observação sobre reagendamento (ex.: data/hora para qual foi reagendado).';

-- Criar índices para consultas de estatísticas e dashboard
CREATE INDEX IF NOT EXISTS idx_appointments_cancelled_via_reminder 
ON appointments(cancelled_via_reminder) 
WHERE cancelled_via_reminder = true;

CREATE INDEX IF NOT EXISTS idx_appointments_no_show 
ON appointments(no_show_at) 
WHERE no_show_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_cancelled_by 
ON appointments(cancelled_by) 
WHERE cancelled_by IS NOT NULL;

-- Rollback (se necessário):
-- ALTER TABLE appointments
-- DROP COLUMN IF EXISTS cancellation_reason,
-- DROP COLUMN IF EXISTS cancelled_by,
-- DROP COLUMN IF EXISTS cancelled_via_reminder,
-- DROP COLUMN IF EXISTS no_show_at,
-- DROP COLUMN IF EXISTS rescheduled_to_appointment_id,
-- DROP COLUMN IF EXISTS rescheduled_notes;
-- DROP INDEX IF EXISTS idx_appointments_cancelled_via_reminder;
-- DROP INDEX IF EXISTS idx_appointments_no_show;
-- DROP INDEX IF EXISTS idx_appointments_cancelled_by;
