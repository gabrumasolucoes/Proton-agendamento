-- Migration: Sistema de Feature Flags para Rollback Seguro
-- Permite ativar/desativar funcionalidades por empresa

-- Tabela de feature flags
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flag_key VARCHAR(100) NOT NULL UNIQUE,
    flag_name VARCHAR(200) NOT NULL,
    description TEXT,
    default_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de flags por empresa
CREATE TABLE IF NOT EXISTS company_feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    flag_key VARCHAR(100) NOT NULL REFERENCES feature_flags(flag_key) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    enabled_at TIMESTAMP WITH TIME ZONE,
    enabled_by VARCHAR(200),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, flag_key)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(flag_key);
CREATE INDEX IF NOT EXISTS idx_company_flags_company ON company_feature_flags(company_id);
CREATE INDEX IF NOT EXISTS idx_company_flags_enabled ON company_feature_flags(enabled) WHERE enabled = true;

-- Inserir flags principais
INSERT INTO feature_flags (flag_key, flag_name, description, default_enabled) VALUES
    ('hybrid_scheduling_v2', 'Agendamento Híbrido V2', 'Nova arquitetura com state machine + LLM para agendamentos', false),
    ('rag_knowledge_base', 'Base de Conhecimento RAG', 'Respostas baseadas em busca vetorial ao invés de prompt', false),
    ('smart_llm_routing', 'Roteamento Inteligente de LLM', 'Usa modelo pequeno para queries simples', false),
    ('structured_logging', 'Logging Estruturado', 'Logs detalhados de cada etapa do fluxo', true)
ON CONFLICT (flag_key) DO NOTHING;

-- Função para verificar se flag está ativa
CREATE OR REPLACE FUNCTION is_feature_enabled(
    p_company_id UUID,
    p_flag_key VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_enabled BOOLEAN;
    v_default BOOLEAN;
BEGIN
    -- Verificar flag específica da empresa
    SELECT enabled INTO v_enabled
    FROM company_feature_flags
    WHERE company_id = p_company_id AND flag_key = p_flag_key;
    
    -- Se não existe configuração específica, usar default
    IF v_enabled IS NULL THEN
        SELECT default_enabled INTO v_default
        FROM feature_flags
        WHERE flag_key = p_flag_key;
        
        RETURN COALESCE(v_default, false);
    END IF;
    
    RETURN v_enabled;
END;
$$ LANGUAGE plpgsql;

-- Comentários
COMMENT ON TABLE feature_flags IS 'Feature flags globais do sistema';
COMMENT ON TABLE company_feature_flags IS 'Feature flags ativadas por empresa (permite rollback seletivo)';
COMMENT ON FUNCTION is_feature_enabled IS 'Verifica se uma feature está ativa para uma empresa';
