# Plano: Horários de atendimento configuráveis e agendamento manual (exceções)

Este documento descreve a pesquisa em melhores práticas e o plano para: (1) configurar horário de atendimento geral (ex.: 8:00–18:00) com dias da semana configuráveis; (2) permitir agendamento manual mesmo em horários fechados (exceções). **Nenhuma implementação de código está sendo feita neste momento** — serve como guia para desenvolvimento futuro.

---

## 1. O que você precisa (resumo)

| Necessidade | Descrição |
|-------------|-----------|
| **Horário geral** | Definir início e fim do expediente (ex.: 8:00–18:00). Fora desse intervalo, o dia fica “fechado” para agendamento automático (API/SDR). |
| **Por dia da semana** | Escolher em quais dias esse horário vale; poder ter horário diferente no sábado (ex.: sábado 8:00–12:00). |
| **Exceção manual** | Mesmo em horário ou dia “fechado”, permitir criar agendamento manual (ex.: pelo botão “Novo Agendamento” no Proton) para tratar exceções. |

---

## 2. Melhores práticas (pesquisa em fóruns e documentação)

### 2.1 Horários de negócio (business hours)

- **Configuração por dia da semana:** Sistemas como Bird API, Cisco UCCE e Wix usam grade semanal: para cada dia (segunda a domingo) definem início e fim em HH:MM. Alguns suportam múltiplos intervalos no mesmo dia (ex.: 8–12 e 14–18 para almoço).
- **Timezone:** Sempre configurar e armazenar o timezone (ex.: `America/Sao_Paulo`) para evitar ambiguidade entre servidor (UTC) e usuário.
- **Status e próximos eventos:** APIs costumam expor `currentStatus` (open/closed), `nextOpenTime`, `nextCloseTime` para facilitar mensagens (“Abrimos às 8h”).
- **Atualização:** Ao salvar horários, reescrever a configuração inteira (array/objeto) em vez de atualizar campos soltos, para evitar inconsistência (Wix, Cisco).

### 2.2 Horários diferentes por dia (ex.: sábado)

- **Padrão:** Cada dia da semana pode ter seu próprio par (início, fim). Fins de semana costumam vir “fechados” por padrão e podem ser ativados com horário reduzido (ex.: sábado 8–12).
- **Múltiplos intervalos:** Alguns sistemas permitem mais de um intervalo no mesmo dia (ex.: 8–12 e 14–18). O Proton já tem “almoço” (12–13) no código; isso pode ser generalizado como “intervalo” ou “segundo bloco”.
- **Dias sem expediente:** Dias não configurados ou com “fechado” explícito não geram slots na API de disponibilidade.

### 2.3 Agendamento manual fora do horário (exceção)

- **Separação de fluxos:** O agendamento **automático** (API/chatbot) respeita os horários configurados. O agendamento **manual** (feito por um operador no sistema) pode ignorar restrições de horário para exceções (Zenoti, Microsoft Bookings, Calendly).
- **Identificação da origem:** Manter campo `source` (ex.: `chatbot` vs `manual`) no agendamento permite: (1) relatórios; (2) regras diferentes (ex.: manual pode ser em qualquer horário). O Proton já tem `source: 'chatbot'` no create-appointment da API; o “Novo Agendamento” no front pode gravar `source: 'manual'`.
- **Permissão:** A exceção deve estar disponível apenas para usuários autenticados (admin/operador), não para o canal automático (WhatsApp/SDR).

Resumo: **horário configurável por dia + fora desse horário = fechado para API; agendamento manual (UI) pode ignorar “fechado” e criar exceção.**

---

## 3. Estado atual no Proton

| Componente | Situação |
|-----------|----------|
| **check-availability.js** | `WORKING_HOURS` fixo no código: `start: 8`, `end: 18`, `lunchStart: 12`, `lunchEnd: 13`, `slotDuration: 30`. Geração de slots (`generateDaySlots`) usa esse objeto. Não há configuração por dia da semana. |
| **constants.ts (front)** | `HOURS_OF_OPERATION`: `start: 7`, `end: 19` — usado no calendário (CalendarGrid). Não está sincronizado com o backend. |
| **agenda-blocks.js** | Bloqueios por **dia** (weekdays, specific_date, date_range). Não define “horário de abertura/fechamento” dentro do dia; apenas “este dia está fechado”. |
| **create-appointment.js** | Verifica apenas: (1) dia bloqueado (`isDateBlocked`); (2) conflito com outro agendamento. **Não** verifica se o horário está dentro do expediente. A API é usada pelo SDR (chatbot); não há flag “manual” para ignorar horário. |
| **Botão “Novo Agendamento”** | No front (perfil do cliente), permite criar agendamento; atualmente o backend da API (create-appointment) não diferencia “manual” de “chatbot” para liberar horário fechado. |

Conclusão: hoje o “expediente” é fixo (8–18, sem sábado diferente) e não existe exceção “manual” para horário fechado.

---

## 4. Proposta de implementação (plano)

### 4.1 Modelo de dados: horários de atendimento por dia

- **Onde guardar:** No Proton, por usuário (cada “conta” Proton = um usuário). Duas opções:
  - **Opção A – Tabela `business_hours`:**  
    `user_id`, `day_of_week` (0–6, 0=domingo), `start_time` (ex.: "08:00"), `end_time` (ex.: "18:00"), `lunch_start` (opcional, ex.: "12:00"), `lunch_end` (opcional, ex.: "13:00"), `active` (boolean).  
    Um registro por dia ativo; se não houver registro para um dia, esse dia fica fechado.
  - **Opção B – JSON em `profiles`:**  
    Coluna `business_hours` em `profiles`: objeto ou array por dia, ex.:  
    `{ "1": { "start": "08:00", "end": "18:00", "lunch": ["12:00","13:00"] }, "6": { "start": "08:00", "end": "12:00" } }` (1=segunda, 6=sábado).

- **Default:** Se não houver configuração, usar fallback atual: seg–sex 8–18, almoço 12–13; sábado e domingo fechados (ou apenas domingo, conforme regra atual).

### 4.2 check-availability (API)

- Obter configuração de horários do usuário para o **dia da semana** da `date` solicitada.
- Se o dia estiver fechado (sem registro ou `active: false`), retornar `available: false`, `availableSlots: []`, mensagem adequada.
- `generateDaySlots`: em vez de `WORKING_HOURS` fixo, usar `start`/`end` (e opcionalmente `lunch`) da configuração daquele dia. Manter timezone (ex.: Brasília) explícito.
- Continuar respeitando `agenda_blocks` (weekdays, specific_date, date_range) para “dia fechado” ou “período de férias”.

### 4.3 create-appointment (API) – fluxo chatbot

- Manter comportamento atual para chamadas da API (SDR/chatbot): validar dia não bloqueado e slot livre.
- **Incluir validação:** se o horário do `dateTime` estiver **fora** do expediente configurado para aquele dia, retornar 409 com mensagem do tipo “Fora do horário de atendimento”. Assim, o agendamento automático nunca cria exceção.

### 4.4 Agendamento manual (exceção)

- **Frontend (Proton):** ao criar agendamento pelo “Novo Agendamento” (ou equivalente), enviar um indicador de que é manual, ex.: `source: 'manual'` ou `allowOutsideHours: true` no body (conforme preferência de API).
- **Backend:** novo parâmetro no body, ex.: `source` (valores: `chatbot` | `manual`) ou `allowOutsideHours: true`.
  - Se `source === 'manual'` (ou `allowOutsideHours === true`): **não** validar se o horário está dentro do expediente; validar apenas (1) dia não bloqueado por `agenda_blocks` (opcionalmente permitir até isso para “exceção total”) e (2) não sobreposição com outro agendamento.
  - Se `source === 'chatbot'` ou ausente: manter validação de horário dentro do expediente (quando implementada).
- **Segurança:** a API de create-appointment hoje usa token compartilhado (PROTON_API_TOKEN). O frontend do Proton que chama “create appointment” deve usar autenticação de usuário (session). Ou seja: apenas requisições autenticadas (feitas pelo painel Proton) podem enviar `source: 'manual'`; o SDR continua enviando sem esse parâmetro (ou `source: 'chatbot'`).

### 4.5 Calendário (CalendarGrid) e constants

- Alinhar o calendário à configuração: ler `business_hours` (por dia da semana) e usar para desenhar as linhas de hora e para não permitir arrastar/criar em horário “fechado” — exceto se a ação for “manual”, nesse caso permitir qualquer horário dentro do dia (ou conforme regra de exceção).
- Ou manter `HOURS_OF_OPERATION` no front como “visão mínima” (ex.: 7–19) e a validação real no backend; o importante é a API e o create-appointment usarem a mesma fonte de verdade (tabela ou `profiles.business_hours`).

### 4.6 UI de configuração

- Tela ou modal em “Configurações” (ou “Horário de atendimento”): para cada dia da semana, ativo (checkbox) + início + fim + opcional intervalo de almoço. Ex.: Sábado ativo com 08:00–12:00. Salvar na tabela ou em `profiles.business_hours`.

---

## 5. Ordem sugerida de implementação

1. **Migration:** criar tabela `business_hours` (ou coluna `business_hours` em `profiles`) e função/helper para ler “horário do dia” por `user_id` e `day_of_week`.
2. **check-availability:** usar essa config para gerar slots apenas dentro do expediente; dia sem config = fechado.
3. **create-appointment (chatbot):** adicionar validação “dentro do expediente”; recusar se fora.
4. **create-appointment (manual):** adicionar parâmetro `source: 'manual'` (ou `allowOutsideHours`) e, quando presente, pular validação de expediente.
5. **Frontend Proton:** na criação de agendamento pela UI, enviar `source: 'manual'`; opcionalmente, permitir escolher horário fora da grade (ex.: input livre de data/hora).
6. **CalendarGrid / constants:** (opcional) alimentar a grade a partir de `business_hours` ou manter range amplo e confiar no backend.
7. **Tela de configuração:** CRUD de horários por dia da semana.

---

## 6. Resumo

| Tópico | Decisão |
|--------|---------|
| **Horário geral** | Configurável por dia da semana (início, fim, opcional almoço). Fora = fechado para API. |
| **Sábado diferente** | Suportado: cada dia tem seu próprio par start/end (e opcional lunch). |
| **Exceção manual** | Agendamento criado com `source: 'manual'` (ou flag equivalente) pode ser fora do horário de atendimento; apenas validação de conflito e, se desejado, de dia não bloqueado. |
| **Onde configurar** | No Proton (por usuário): tabela `business_hours` ou `profiles.business_hours`. |
| **API e SDR** | check-availability e create-appointment (chatbot) respeitam horário; create-appointment (manual) pode ignorar horário quando sinalizado. |

---

## 7. Dificuldade e viabilidade no Cursor (IA)

### 7.1 Nível de dificuldade

| Aspecto | Avaliação |
|--------|-----------|
| **Nível geral** | **Média.** Tudo fica dentro do repositório Proton (migrations, API, frontend); não há dependência de outro serviço ou codebase. A lógica é bem delimitada: ler config por dia → gerar slots / validar horário → exceção manual por parâmetro. |
| **Backend** | Migration (tabela ou coluna), helper para "horário do dia", alteração em `check-availability.js` (gerar slots a partir da config) e em `create-appointment.js` (validar expediente + aceitar `source: 'manual'`). Código existente é claro; risco maior é timezone (Brasília) em vários pontos. |
| **Frontend** | (1) Enviar `source: 'manual'` ao criar agendamento pela UI; (2) tela/modal de configuração de horários por dia da semana. Requer localizar onde o "Novo Agendamento" chama a API e incluir o parâmetro; a tela de config é CRUD simples mas exige desenho de formulário (7 dias, start/end, opcional lunch). |
| **Segurança** | Hoje a API usa token único (PROTON_API_TOKEN). Se o SDR e o front Proton chamarem o mesmo endpoint, é essencial que **apenas** a UI autenticada possa enviar `source: 'manual'` (ex.: validar session/cookie no create-appointment quando `source === 'manual'`). Isso pode exigir ajuste na API (dois caminhos: token para SDR, session para UI) ou um segundo endpoint interno. |

### 7.2 Cursor (IA) consegue implementar sem dificuldades?

| Pergunta | Resposta |
|----------|----------|
| **Cursor consegue fazer a implementação?** | **Sim, com revisão humana.** O repositório Proton está no workspace; o agente consegue: escrever a migration, criar o helper de business hours, alterar `check-availability.js` e `create-appointment.js`, e ajustar o front para enviar `source: 'manual'` e (se pedido) esboçar a tela de configuração. |
| **Onde pode errar ou precisar de revisão?** | (1) **Timezone:** garantir que "08:00" na config seja sempre interpretado no fuso do usuário (ex.: America/Sao_Paulo) em check-availability e create-appointment. (2) **Segurança:** garantir que só a UI autenticada possa usar `source: 'manual'`; se a API hoje não diferencia chamada SDR de chamada do painel, um humano deve definir como fazer essa distinção (session, header, ou endpoint separado). (3) **Defaults:** comportamento quando não houver nenhuma linha em `business_hours` (ou `profiles.business_hours` vazio) deve ficar explícito (ex.: seg–sex 8–18, sáb/dom fechado). (4) **CalendarGrid:** alimentar a grade a partir da config é opcional mas melhora a UX; pode exigir refinar depois. |
| **Resumo** | **Implementação: sim.** Backend e migrations são diretos; exceção manual é um branch por parâmetro. A parte que mais exige cuidado é segurança (quem pode enviar `source: 'manual'`) e consistência de timezone; a tela de configuração de horários é trabalhosa mas mecânica. Recomenda-se implementar em etapas (migration → API → front envio de `source` → tela de config) e revisar cada etapa. |

Este plano pode ser seguido em etapas; a pesquisa em melhores práticas apoia a separação entre "regra automática" (respeitar horário) e "exceção manual" (permitir fora do horário com controle de quem cria). a pesquisa em melhores práticas apoia a separação entre “regra automática” (respeitar horário) e “exceção manual” (permitir fora do horário com controle de quem cria).
