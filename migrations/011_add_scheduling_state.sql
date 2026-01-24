-- Migration: Tabela de estados do fluxo de agendamento
-- Permite rastrear onde cada conversa está no processo

-- Estados possíveis do fluxo de agendamento
CREATE TYPE scheduling_state AS ENUM (
    'idle',
    'intent_detected',
    'collecting_name',
    'collecting_type',
    'collecting_date',
    'collecting_time',
    'collecting_professional',
    'confirming',
    'booking',
    'completed',
    'failed',
    'cancelled'
);

-- Tabela de sessões de agendamento
CREATE TABLE IF NOT EXISTS scheduling_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Estado atual
    current_state scheduling_state NOT NULL DEFAULT 'idle',
    previous_state scheduling_state,
    
    -- Dados coletados
    collected_fields JSONB DEFAULT '{}',
    /* Estrutura esperada:
    {
        "name": "João Silva",
        "type": "Visita geral",
        "date": "segunda-feira",
        "time": "15h",
        "professional": "Carol",
        "phone": "43988466446"
    }
    */
    
    -- Metadados
    attempts INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    
    -- Audit trail
    state_history JSONB DEFAULT '[]',
    /* Estrutura:
    [
        {"state": "idle", "timestamp": "2026-01-24T18:00:00Z"},
        {"state": "collecting_name", "timestamp": "2026-01-24T18:00:05Z"}
    ]
    */
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '30 minutes',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_scheduling_sessions_lead ON scheduling_sessions(lead_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_sessions_company ON scheduling_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_sessions_state ON scheduling_sessions(current_state);
CREATE INDEX IF NOT EXISTS idx_scheduling_sessions_active ON scheduling_sessions(lead_id, current_state) 
    WHERE current_state NOT IN ('completed', 'failed', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_scheduling_sessions_expires ON scheduling_sessions(expires_at) 
    WHERE current_state NOT IN ('completed', 'failed', 'cancelled');

-- Função para transição de estado
CREATE OR REPLACE FUNCTION transition_scheduling_state(
    p_session_id UUID,
    p_new_state scheduling_state,
    p_collected_field_key TEXT DEFAULT NULL,
    p_collected_field_value TEXT DEFAULT NULL
) RETURNS scheduling_sessions AS $$
DECLARE
    v_session scheduling_sessions;
    v_state_entry JSONB;
BEGIN
    -- Buscar sessão atual
    SELECT * INTO v_session FROM scheduling_sessions WHERE id = p_session_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sessão não encontrada: %', p_session_id;
    END IF;
    
    -- Preparar entrada no histórico
    v_state_entry := jsonb_build_object(
        'from_state', v_session.current_state,
        'to_state', p_new_state,
        'timestamp', NOW(),
        'field', p_collected_field_key,
        'value', p_collected_field_value
    );
    
    -- Atualizar sessão
    UPDATE scheduling_sessions
    SET 
        previous_state = current_state,
        current_state = p_new_state,
        state_history = state_history || v_state_entry,
        collected_fields = CASE 
            WHEN p_collected_field_key IS NOT NULL THEN
                jsonb_set(collected_fields, ARRAY[p_collected_field_key], to_jsonb(p_collected_field_value))
            ELSE collected_fields
        END,
        completed_at = CASE 
            WHEN p_new_state IN ('completed', 'failed', 'cancelled') THEN NOW()
            ELSE completed_at
        END,
        updated_at = NOW()
    WHERE id = p_session_id
    RETURNING * INTO v_session;
    
    RETURN v_session;
END;
$$ LANGUAGE plpgsql;

-- Função para limpar sessões expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_scheduling_sessions()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        UPDATE scheduling_sessions
        SET current_state = 'failed',
            last_error = 'Sessão expirada (timeout de 30 minutos)',
            updated_at = NOW()
        WHERE expires_at < NOW()
          AND current_state NOT IN ('completed', 'failed', 'cancelled')
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_count FROM deleted;
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comentários
COMMENT ON TYPE scheduling_state IS 'Estados possíveis do fluxo de agendamento';
COMMENT ON TABLE scheduling_sessions IS 'Rastreia estado de cada conversa de agendamento';
COMMENT ON FUNCTION transition_scheduling_state IS 'Transição segura de estado com histórico';
COMMENT ON FUNCTION cleanup_expired_scheduling_sessions IS 'Limpa sessões expiradas (chamar via cron)';
