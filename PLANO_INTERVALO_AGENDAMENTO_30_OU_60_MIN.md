# Plano: Intervalo de agendamento configurável (30 min ou 1 h)

**Objetivo:** Permitir que a empresa escolha se os agendamentos são exibidos e oferecidos de **30 em 30 minutos** ou de **1 hora em 1 hora**, sem quebrar a leitura que o SDR faz no Proton para disponibilidade e criação de agendamento.

**Escopo:** Apenas plano — nenhuma execução neste documento.

---

## 1. Estado atual

| Onde | Comportamento |
|------|----------------|
| **Proton `check-availability`** | Gera slots com passo fixo de 30 min (`WORKING_HOURS.slotDuration: 30`). Aceita query `duration` (default 30), mas a geração de slots usa `slotDuration` hardcoded no loop (`minute += slotDuration`), então hoje sempre 08:00, 08:30, 09:00, ... |
| **Proton `create-appointment`** | Aceita body `duration` (default 30). Usado para calcular `end_time` do agendamento. |
| **SDR `proton-integration`** | `checkAvailability`: não envia `duration` (Proton usa 30). `scheduleAppointment`: envia `duration: params.duration \|\| 30`. |
| **SDR Orchestrator** | Sempre aplica `filterHourlySlots()` aos slots retornados pelo Proton (mantém só horários terminados em `:00`). Efeito: mesmo com Proton retornando 08:00, 08:30, 09:00..., o usuário vê só 08:00, 09:00, ... |

Conclusão: hoje tudo funciona como “30 min” no Proton; no SDR a oferta ao cliente é “de hora em hora” por causa do filtro.

---

## 2. Contrato que não pode quebrar (SDR ↔ Proton)

- **GET /api/check-availability**: query `date`, `protonUserId`, opcional `doctorName`, e (a partir desta feature) `duration` (30 ou 60). Resposta: `availableSlots[]` com `{ time, dateTime, period }` — formato inalterado.
- **POST /api/create-appointment**: body com `dateTime`, `duration`, `protonUserId`, etc. Resposta inalterada.
- O SDR usa apenas a lista `availableSlots` e o `suggestedMessage`; não depende de “quantos minutos tem cada slot” além de enviar o mesmo `duration` na criação. Desde que Proton retorne slots coerentes com o `duration` pedido, a leitura do SDR continua válida.

---

## 3. Onde guardar a escolha da empresa

**Recomendação:** Configuração no **SDR** (uma única fonte de verdade por empresa).

- **Tabela:** `business_configs` (já usada para labels de agendamento e tipo de negócio).
- **Campo novo:** `slot_interval_minutes` INT: apenas **30** ou **60**. Default **30** (comportamento atual).
- **Motivo:** A “empresa” é entidade do SDR; o Proton não tem conceito de empresa, só de usuário. Manter a escolha em `business_configs` evita duplicar configuração e permite um único lugar (dashboard SDR ou script) para alterar.

Alternativa (não recomendada aqui): guardar no Proton (ex.: `profiles.slot_interval_minutes`) e o Proton usar esse valor quando `duration` não vier na requisição; exigiria UI/config no Proton e possível duplicação com o SDR.

---

## 4. Alterações por componente

### 4.1 SDR – Banco de dados

- **Migration (Supabase):**
  - Em `business_configs`, adicionar:
    - `slot_interval_minutes INT DEFAULT 30 CHECK (slot_interval_minutes IN (30, 60))`
  - Comentário: “Intervalo de slots de agendamento em minutos: 30 ou 60. Usado na integração Proton (check-availability e create-appointment).”

### 4.2 SDR – Config e integração Proton

- **`lib/business-config.ts`:**
  - Incluir `slotIntervalMinutes?: number` em `BusinessConfig`.
  - No `select` e no mapeamento de `business_configs`, ler `slot_interval_minutes`; default 30 se null/undefined.
- **`services/proton-integration.ts`:**
  - Em `checkAvailability`: obter config de negócio (ex.: `getBusinessConfig(params.companyId)` se já não tiver); adicionar ao query string do Proton o parâmetro `duration` com valor `config.slotIntervalMinutes ?? 30`. Validar que seja 30 ou 60 antes de enviar.
  - Em `scheduleAppointment`: idem — obter `slotIntervalMinutes` (ex.: via `getBusinessConfig(companyId)` ou parâmetro já existente) e enviar no body `duration: slotIntervalMinutes ?? 30` (em vez de só `params.duration || 30` quando não vier preenchido pela IA). Garantir que criação use o mesmo intervalo da empresa.
  - Manter compatibilidade: se não houver `companyId` ou config, usar 30.

### 4.3 SDR – Orchestrator (não quebrar a “leitura” dos slots)

- **Comportamento desejado:**
  - **Intervalo 60 min:** Proton já retorna só 08:00, 09:00, 10:00…; o SDR pode continuar usando esses slots como hoje (com ou sem `filterHourlySlots` — o resultado é o mesmo).
  - **Intervalo 30 min:** Proton retorna 08:00, 08:30, 09:00…; o SDR deve **mostrar todos** esses horários ao usuário (não aplicar o filtro que deixa só :00).
- **Implementação sugerida:**
  - O orchestrator já recebe `businessConfig` no `context` em vários fluxos. Incluir `slotIntervalMinutes` no `BusinessConfig` (acima) e, em todos os pontos onde hoje se faz `filterHourlySlots(availableTimes)`:
    - Se `businessConfig?.slotIntervalMinutes === 30`: usar `availableTimes` sem filtrar (mostrar 30 em 30).
    - Caso contrário (60 ou undefined): manter comportamento atual, ou seja, `filterHourlySlots(availableTimes)` (para compatibilidade e para 60 min).
  - Garantir que `businessConfig` (com `slotIntervalMinutes`) esteja disponível nos fluxos que chamam `checkAvailability` e montam a mensagem de horários (ex.: `getAvailabilityMessage`, `buildAvailability`, e demais trechos que usam `availableSlots` e `filterHourlySlots`).

Assim a “leitura” que o SDR faz (lista de slots + envio do mesmo intervalo na criação) permanece correta e única fonte de verdade é a config da empresa.

### 4.4 Proton – check-availability

- **`api/check-availability.js`:**
  - Manter `duration` vindo do query (já existe), default 30.
  - Validar: aceitar apenas `duration` 30 ou 60 (retornar 400 se outro valor).
  - **Função `generateDaySlots(date, duration)`:**
    - Hoje o loop usa `WORKING_HOURS.slotDuration` (30) para o passo (`minute += slotDuration`). Alterar para usar o parâmetro `duration` como passo: `minute += duration`. Assim, com `duration=60`, os slots serão 08:00, 09:00, 10:00…; com `duration=30`, 08:00, 08:30, 09:00…
  - O restante (filtrar slots ocupados, formato de resposta) já usa `duration` para o fim do slot; não é necessário mudar formato de resposta. Manter `availableSlots[]` com `time`, `dateTime`, `period`.

### 4.5 Proton – create-appointment

- **`api/create-appointment.js`:**
  - Manter `duration` no body (default 30).
  - Validar: aceitar apenas 30 ou 60; em caso contrário retornar 400.
  - O cálculo de `endDate` já usa `duration`; nenhuma mudança de lógica além da validação.

---

## 5. UI / Como a empresa “escolhe”

- **Opção mínima (só backend):** Migration + script ou SQL para atualizar `business_configs.slot_interval_minutes` por empresa (30 ou 60). Sem tela.
- **Opção desejável:** No dashboard SDR, na tela de configuração da empresa (ou “Integração Proton” / “Agendamento”), um campo ou select: “Intervalo de horários para agendamento: 30 minutos | 1 hora”. Salvar em `business_configs.slot_interval_minutes`.
- Não é obrigatório ter UI no Proton para isso se a escolha ficar no SDR.

---

## 6. Ordem de implementação sugerida

1. **Migration SDR:** adicionar `slot_interval_minutes` em `business_configs`.
2. **SDR business-config:** incluir `slotIntervalMinutes` no tipo e no carregamento.
3. **Proton check-availability:** usar `duration` no passo do loop em `generateDaySlots`; validar 30 ou 60.
4. **Proton create-appointment:** validar `duration` 30 ou 60.
5. **SDR proton-integration:** enviar `duration` (a partir de `business_configs.slot_interval_minutes`) em check-availability e create-appointment.
6. **SDR orchestrator:** condicionar `filterHourlySlots` ao `slotIntervalMinutes` (mostrar todos quando 30; filtrar para :00 quando 60 ou undefined).
7. **Testes:** empresa com 30 min → slots 08:00, 08:30… e criação com 30 min; empresa com 60 min → slots 08:00, 09:00… e criação com 60 min. Garantir que o SDR não quebra (mesma leitura de slots e mesma criação).
8. **UI (opcional):** campo na config da empresa para escolher 30 ou 60 min.

---

## 7. Riscos e compatibilidade

- **Retrocompatibilidade:** Default 30 mantém o comportamento atual. Empresas sem o campo ou com null continuam com intervalos de 30 min.
- **Proton sem `duration`:** Se o SDR não enviar `duration`, Proton continua com default 30; depois que o SDR for alterado para enviar, tudo fica coerente.
- **Orchestrator sem `businessConfig`:** Em cenários onde `businessConfig` não estiver disponível, tratar como 30 (ou como 60, conforme regra de negócio) para não quebrar.

---

## 8. Resumo

| Componente | Alteração |
|------------|-----------|
| **SDR DB** | `business_configs.slot_interval_minutes` (30 \| 60, default 30). |
| **SDR business-config** | Expor `slotIntervalMinutes` em `BusinessConfig`. |
| **SDR proton-integration** | Enviar `duration` em check-availability e create-appointment com base em `slotIntervalMinutes`. |
| **SDR orchestrator** | Usar `slotIntervalMinutes`: se 30, não aplicar `filterHourlySlots`; se 60 ou undefined, manter filtro (slots já ou só :00). |
| **Proton check-availability** | Usar `duration` no passo do loop (`generateDaySlots`); validar 30 ou 60. |
| **Proton create-appointment** | Validar `duration` 30 ou 60. |
| **UI (opcional)** | Config da empresa: escolha 30 min ou 1 h. |

Com isso, a empresa passa a escolher entre 30 em 30 minutos ou 1 h em 1 h, e a leitura que o SDR faz para agendamento (disponibilidade + criação) permanece correta e alinhada a essa escolha.
