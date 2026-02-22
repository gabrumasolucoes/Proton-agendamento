# Varredura: Índices e Relatórios do Proton

Verificação feita para garantir que todos os números, totais e relatórios refletem a função real (exclusão de cancelados onde deve, contagem de no-shows, etc.).

---

## 1. Relatórios (ReportsView)

| Item | Fonte | Comportamento | Status |
|------|--------|----------------|--------|
| **Total de Atendimentos** | `filteredAppointments.length` | Filtro: período + profissional + **status !== 'cancelled'** | ✅ Atendimentos = só não cancelados no período |
| **Média Diária** | `totalPatients / 5` ou `/ 20` | Mesma base (não cancelados) | ✅ |
| **Taxa de Cancelamento** | `cancelledAppointments / (total + cancelled)` | Cancelados no período no denominador | ✅ |
| **Procedimentos Mais Realizados** | `filteredAppointments` | Só não cancelados | ✅ |
| **Timeline (gráfico por dia/mês)** | `filteredAppointments` | Só não cancelados | ✅ |
| **Filtro por profissional** | `doctorFilteredAppointments` | Todos os status; depois ReportsView aplica `status !== 'cancelled'` em `filteredAppointments` | ✅ |

---

## 2. No-Show Analytics (F10)

| Item | Fonte | Comportamento | Status |
|------|--------|----------------|--------|
| **Total de Faltas (card)** | `totalNoShows + noShowsDetectedNotMarked` | Marcadas no banco + detectadas (confirmed/pending passou + tolerância) | ✅ |
| **Cancelamentos (card)** | `totalCancellations` = outros cancelamentos (sem no_show_at) | ✅ |
| **Origem: Pelo Cliente** | `cancelledByPatient` | Cancelados com `cancelled_by === 'patient'` e sem no_show_at | ✅ |
| **Origem: Pelo Operador** | `cancelledByOperator` | `cancelled_by === 'operator'` | ✅ |
| **Origem: Falta (Sistema)** | `totalNoShows` | Cancelados com `no_show_at` preenchido | ✅ |
| **Distribuição por Dia** | `byDayOfWeek` | noShows vs cancellations por dia | ✅ |
| **Reincidentes** | `frequentOffenders` | Pacientes com 2+ ocorrências (no-show ou cancelamento) no período | ✅ |
| **Faltas detectadas não marcadas** | Query confirmed/pending no período, `no_show_at` null, start_time + tolerância < now | ✅ |

Serviço: `services/no-show-analytics.ts` — busca direto no Supabase por período e `status = 'cancelled'`, depois separa por `no_show_at` e `cancelled_by`.

---

## 3. Estatísticas de Lembretes (F7)

| Item | Fonte | Comportamento | Status |
|------|--------|----------------|--------|
| **Total enviados** | Agendamentos com `reminder_sent_at` no período | ✅ |
| **Confirmados / Cancelados / Sem resposta** | `confirmed_at` e `cancelled_at` nos mesmos registros | Reflete resposta ao lembrete, não status atual | ✅ |

Serviço: `services/reminder-stats.ts` — não filtra por status atual; métricas são “lembretes enviados” e “quem confirmou/cancelou pelo link”. Correto para funnel de lembrete.

---

## 4. Agenda (CalendarGrid)

| Item | Comportamento | Status |
|------|----------------|--------|
| **Lista de agendamentos** | Recebe `filteredAppointments` do App (só filtro por médico ativo) | Inclui cancelados |
| **Estilo** | Cancelados: `grayscale`, `line-through`, borda cinza | ✅ Mostra realidade; cancelados visíveis mas diferenciados |

---

## 5. Aba Clientes (PatientsView)

| Item | Comportamento | Status |
|------|----------------|--------|
| **Próximo retorno** | Primeiro agendamento **futuro** com **status !== 'cancelled'** | ✅ Corrigido (antes incluía cancelados) |
| **Status do próximo retorno** | Confirmado / Pendente / Em atendimento conforme `nextAppointmentData.status` | ✅ |
| **Total Consultas** | Soma de **todos** os agendamentos do paciente (inclui cancelados) | ✅ “Total de consultas agendadas” no histórico |
| **Última Visita** | Último agendamento **passado** (qualquer status) | ✅ |
| **Histórico (timeline)** | Todos os agendamentos; status em português | ✅ |

---

## 6. App.tsx – filtro global

| Item | Comportamento | Status |
|------|----------------|--------|
| **filteredAppointments** | `appointments` filtrados só por **médico ativo** (não exclui cancelados) | ✅ Calendar e Clientes precisam ver cancelados; Relatórios aplicam seu próprio filtro `!== 'cancelled'` |

---

## 7. API get-user-data (admin/export)

| Item | Comportamento | Status |
|------|----------------|--------|
| **stats.totalAppointments** | `appointmentsData?.length` (todos os agendamentos do usuário) | ✅ Contagem bruta para export/auditoria; não é “atendimentos ativos” |

---

## 8. Tipos (types.ts)

- **NoShowAnalytics**: Interface alinhada com o retorno de `no-show-analytics.ts` (totalCancelled, cancelledByPatient, cancelledByOperator, cancelledViaReminder, byDayOfWeek, byTimeSlot, frequentOffenders).  
- **noShowRate** mantido opcional (serviço não calcula atualmente).

---

## Resumo

- **Relatórios**: Total de Atendimentos, gráficos e taxa de cancelamento usam apenas agendamentos **não cancelados** no período; no-show analytics usa cancelados no período e separa faltas (no_show_at) de outros cancelamentos e origens.
- **Agenda**: Mostra todos os agendamentos (incluindo cancelados), com estilo distinto para cancelados.
- **Clientes**: Próximo retorno só considera ativos (não cancelados) e exibe status real; Total Consultas e histórico incluem cancelados de forma coerente com “histórico completo”.
- **Lembretes**: Métricas baseadas em envio e resposta ao lembrete; sem inconsistência com status atual do agendamento.

Nenhuma correção de lógica foi necessária além da já feita no “Próximo retorno” e do alinhamento do tipo `NoShowAnalytics`.
