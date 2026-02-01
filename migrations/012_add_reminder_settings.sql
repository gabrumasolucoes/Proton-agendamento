-- Migration 012: Configuração de Lembretes por Clínica
-- Adiciona campos para configurar lembretes de confirmação de agendamento via WhatsApp
-- 
-- Campos adicionados:
-- - reminder_enabled: toggle para habilitar/desabilitar envio de lembretes
-- - reminder_days_before: dias de antecedência (1-7)
-- - reminder_send_time: horário do envio (HH:mm)
-- - reminder_timezone: timezone IANA para cálculo correto
-- - max_reminders_per_day: limite de segurança
-- - no_show_tolerance_minutes: tempo para marcar falta
--
-- Todos os campos são opcionais com defaults que mantêm comportamento atual

-- Adicionar colunas de configuração de lembretes
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS reminder_days_before INT DEFAULT 1 CHECK (reminder_days_before BETWEEN 1 AND 7),
ADD COLUMN IF NOT EXISTS reminder_send_time VARCHAR(5) DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS reminder_timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
ADD COLUMN IF NOT EXISTS max_reminders_per_day INT DEFAULT 50,
ADD COLUMN IF NOT EXISTS no_show_tolerance_minutes INT DEFAULT 30;

-- Comentários para documentação
COMMENT ON COLUMN profiles.reminder_enabled IS 'Se true, a clínica recebe envio de lembretes de confirmação via WhatsApp. false = não enviar.';
COMMENT ON COLUMN profiles.reminder_days_before IS 'Dias de antecedência para envio do lembrete (1 a 7). Default 1.';
COMMENT ON COLUMN profiles.reminder_send_time IS 'Horário do envio no dia (HH:mm) no timezone da clínica. Default 08:00.';
COMMENT ON COLUMN profiles.reminder_timezone IS 'Timezone IANA (ex: America/Sao_Paulo, America/Fortaleza) para cálculo correto do horário de envio.';
COMMENT ON COLUMN profiles.max_reminders_per_day IS 'Limite de segurança: máximo de lembretes enviados por dia por esta clínica. Default 50.';
COMMENT ON COLUMN profiles.no_show_tolerance_minutes IS 'Minutos após start_time para marcar como no-show. Default 30min.';

-- Criar índice para consultas otimizadas do job de lembretes
CREATE INDEX IF NOT EXISTS idx_profiles_reminder_enabled ON profiles(reminder_enabled) WHERE reminder_enabled = true;

-- Rollback (se necessário):
-- ALTER TABLE profiles
-- DROP COLUMN IF EXISTS reminder_enabled,
-- DROP COLUMN IF EXISTS reminder_days_before,
-- DROP COLUMN IF EXISTS reminder_send_time,
-- DROP COLUMN IF EXISTS reminder_timezone,
-- DROP COLUMN IF EXISTS max_reminders_per_day,
-- DROP COLUMN IF EXISTS no_show_tolerance_minutes;
-- DROP INDEX IF EXISTS idx_profiles_reminder_enabled;
