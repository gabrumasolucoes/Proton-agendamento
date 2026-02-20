-- Migration 014: Horários de atendimento por dia da semana (business_hours)
-- Permite configurar início/fim e opcional almoço por dia (0=domingo .. 6=sábado).
-- Se não houver registro para um dia, o sistema usa default (seg-sex 8-18, sáb/dom fechado).
-- Ref: PLANO_HORARIOS_ATENDIMENTO_E_EXCECOES.md

CREATE TABLE IF NOT EXISTS business_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time VARCHAR(5) NOT NULL DEFAULT '08:00',
    end_time VARCHAR(5) NOT NULL DEFAULT '18:00',
    lunch_start VARCHAR(5),
    lunch_end VARCHAR(5),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, day_of_week)
);

COMMENT ON TABLE business_hours IS 'Horário de atendimento por dia da semana por usuário Proton. day_of_week: 0=domingo, 6=sábado.';
COMMENT ON COLUMN business_hours.start_time IS 'Início do expediente (HH:MM) no timezone da clínica.';
COMMENT ON COLUMN business_hours.end_time IS 'Fim do expediente (HH:MM).';
COMMENT ON COLUMN business_hours.lunch_start IS 'Início do intervalo de almoço (opcional).';
COMMENT ON COLUMN business_hours.lunch_end IS 'Fim do intervalo de almoço (opcional).';

CREATE INDEX IF NOT EXISTS idx_business_hours_user_id ON business_hours(user_id);
