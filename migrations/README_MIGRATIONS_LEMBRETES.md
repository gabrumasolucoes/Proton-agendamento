# 🚀 Guia de Aplicação das Migrations de Lembretes

Este guia explica como aplicar as migrations 012 e 013 para habilitar o sistema de lembretes configuráveis.

---

## ⚠️ Pré-requisitos

- ✅ Backup do banco de dados
- ✅ Acesso ao Supabase (SQL Editor ou pg_admin)
- ✅ Sistema em manutenção (opcional, mas recomendado)

---

## 📋 Ordem de Aplicação

### 1. Migration 012 - Configuração de Lembretes (`profiles`)

**Arquivo:** `Proton-agendamento/migrations/012_add_reminder_settings.sql`

**O que faz:**
- Adiciona 6 campos em `profiles` para configurar lembretes
- Cria índice otimizado para o job de lembretes
- Defaults mantêm comportamento atual (todos habilitados)

**Como aplicar:**

```bash
# Via Supabase SQL Editor:
# 1. Abra https://supabase.com/dashboard/project/YOUR_PROJECT/sql
# 2. Cole o conteúdo de 012_add_reminder_settings.sql
# 3. Execute (Run)
```

**Validação:**
```sql
-- Verificar se colunas foram criadas
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
    AND column_name LIKE 'reminder%'
    OR column_name IN ('max_reminders_per_day', 'no_show_tolerance_minutes');

-- Deve retornar 6 linhas
```

---

### 2. Migration 013 - Cancelamento e Reagendamento (`appointments`)

**Arquivo:** `Proton-agendamento/migrations/013_add_cancellation_and_reschedule_fields.sql`

**O que faz:**
- Adiciona 6 campos em `appointments` para rastrear cancelamentos
- Cria 3 índices otimizados para queries de estatísticas
- Nullable - não afeta registros existentes

**Como aplicar:**

```bash
# Via Supabase SQL Editor:
# 1. Abra https://supabase.com/dashboard/project/YOUR_PROJECT/sql
# 2. Cole o conteúdo de 013_add_cancellation_and_reschedule_fields.sql
# 3. Execute (Run)
```

**Validação:**
```sql
-- Verificar se colunas foram criadas
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'appointments'
    AND (column_name LIKE 'cancel%'
        OR column_name LIKE 'no_show%'
        OR column_name LIKE 'rescheduled%');

-- Deve retornar 6 linhas, todas is_nullable = YES
```

---

## ✅ Checklist Pós-Aplicação

- [ ] Migration 012 aplicada com sucesso
- [ ] Migration 013 aplicada com sucesso
- [ ] Validações SQL executadas (6 + 6 colunas)
- [ ] Índices criados (verificar com `\di` ou pgAdmin)
- [ ] Sistema testado (login Proton, visualizar perfil)
- [ ] Nenhum erro nos logs do servidor

---

## 🔄 Rollback (se necessário)

### Reverter Migration 013 (appointments)

```sql
ALTER TABLE appointments
DROP COLUMN IF EXISTS cancellation_reason,
DROP COLUMN IF EXISTS cancelled_by,
DROP COLUMN IF EXISTS cancelled_via_reminder,
DROP COLUMN IF EXISTS no_show_at,
DROP COLUMN IF EXISTS rescheduled_to_appointment_id,
DROP COLUMN IF EXISTS rescheduled_notes;

DROP INDEX IF EXISTS idx_appointments_cancelled_via_reminder;
DROP INDEX IF EXISTS idx_appointments_no_show;
DROP INDEX IF EXISTS idx_appointments_cancelled_by;
```

### Reverter Migration 012 (profiles)

```sql
ALTER TABLE profiles
DROP COLUMN IF EXISTS reminder_enabled,
DROP COLUMN IF EXISTS reminder_days_before,
DROP COLUMN IF EXISTS reminder_send_time,
DROP COLUMN IF EXISTS reminder_timezone,
DROP COLUMN IF EXISTS max_reminders_per_day,
DROP COLUMN IF EXISTS no_show_tolerance_minutes;

DROP INDEX IF EXISTS idx_profiles_reminder_enabled;
```

---

## 📊 Verificação de Defaults

Após aplicar as migrations, todos os perfis existentes terão:

```sql
-- Verificar defaults aplicados
SELECT 
    id,
    email,
    reminder_enabled,          -- deve ser true
    reminder_days_before,       -- deve ser 1
    reminder_send_time,         -- deve ser '08:00'
    reminder_timezone,          -- deve ser 'America/Sao_Paulo'
    max_reminders_per_day,      -- deve ser 50
    no_show_tolerance_minutes   -- deve ser 30
FROM profiles
LIMIT 5;
```

---

## 🚨 Troubleshooting

### Erro: "column already exists"
**Causa:** Migration já foi aplicada  
**Solução:** Pular para próxima migration

### Erro: "CHECK constraint failed"
**Causa:** Valor de `reminder_days_before` fora do range 1-7  
**Solução:** Corrigir valor antes de aplicar migration

### Erro: "foreign key constraint"
**Causa:** `rescheduled_to_appointment_id` referencia ID inexistente  
**Solução:** Campo é nullable, não deve dar erro. Verificar integridade dos dados

---

## 📝 Próximos Passos

Após aplicar as migrations com sucesso:

1. ✅ **Fase 2**: Implementar backend Proton (ler/gravar configs)
2. ✅ **Fase 3**: Criar UI no SettingsModal (aba Lembretes)
3. ✅ **Fase 4**: Atualizar job SDR para respeitar configs
4. ✅ **Fase 5-7**: Implementar estatísticas e motivos
5. ✅ **Fase 9-10**: No-show e dashboard

---

**Dúvidas?** Consulte `PLANO_LEMBRETES_CONFIGURAVEIS.md` e `ANALISE_MELHORIAS_LEMBRETES.md`
