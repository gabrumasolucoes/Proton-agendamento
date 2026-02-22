# Plano de Integração Proton × Google Agenda (Google Calendar)

**Objetivo:** Documentar um plano completo de integração entre o Proton Agendamento e o Google Calendar, considerando aspectos técnicos, dificuldade, riscos e melhores práticas da comunidade. **Nenhuma implementação deve ser feita a partir deste documento sem decisão explícita.**

---

## 1. Visão geral da integração

### 1.1 O que é o Proton hoje

- Sistema de agendamento multi-tenant (cada empresa = `user_id` no Supabase).
- Agendamentos em tabela `appointments` com: `user_id`, `patient_id`, `patient_name`, `doctor_id`, `start_time`, `end_time`, `status`, `notes`, `source` (chatbot/manual), lembretes, no-show, etc.
- Fluxos: criação manual, criação via API (SDR/chatbot), confirmação/cancelamento por link, lembretes, bloqueios de agenda, horário de atendimento.

### 1.2 O que a integração com Google Agenda pode oferecer

| Cenário | Descrição |
|--------|-----------|
| **Exportar para Google** | Cada agendamento criado/alterado no Proton vira (ou atualiza) um evento no calendário do profissional/empresa no Google. |
| **Importar do Google** | Eventos criados no Google Calendar aparecem no Proton (ou bloqueiam horários). |
| **Sincronização bidirecional** | Alterações em qualquer lado refletem no outro, com regras de conflito. |
| **Só leitura no Google** | Apenas visualizar compromissos do Google no Proton (bloqueio de horário ou exibição). |

A complexidade e o esforço crescem na ordem acima.

---

## 2. Modelos de integração

### 2.1 Opção A – Proton → Google (one-way export)

- **O que é:** Todo agendamento criado/atualizado no Proton gera ou atualiza um evento em um calendário Google escolhido pelo usuário.
- **Prós:** Implementação mais simples, sem conflitos bidirecionais, usuário vê os agendamentos Proton no Google/App do celular.
- **Contras:** Alterações feitas no Google não voltam ao Proton.
- **Grau de dificuldade:** **Médio.**

### 2.2 Opção B – Google → Proton (one-way import / bloqueio)

- **O que é:** Eventos do Google Calendar são lidos e usados no Proton apenas para bloquear horários (ou exibir como “compromisso externo”), sem criar registros completos de appointment no Proton.
- **Prós:** Evita agendar no Proton em horários já ocupados no Google.
- **Contras:** Não há “um evento = um appointment”; é mais uma camada de bloqueio.
- **Grau de dificuldade:** **Médio** (sync + mapeamento de horários).

### 2.3 Opção C – Sincronização bidirecional

- **O que é:** Criação/edição/cancelamento tanto no Proton quanto no Google refletem nos dois lados; um “evento lógico” tem representação nos dois sistemas.
- **Prós:** Experiência unificada; usuário pode gerenciar pelo Proton ou pelo Google.
- **Contras:** Conflitos (mesmo evento editado nos dois lados), loops de sync, duplicatas, necessidade de mapeamento estável (IDs).
- **Grau de dificuldade:** **Alto.**

A recomendação da comunidade (e deste plano) é **começar pela Opção A** (Proton → Google), evoluir para B se fizer sentido e só depois avaliar C com regras claras de conflito e idempotência.

---

## 3. Aspectos técnicos

### 3.1 Autenticação e autorização (Google)

- **OAuth 2.0** é obrigatório para acessar o Google Calendar em nome do usuário.
- **Escopos típicos:**
  - `https://www.googleapis.com/auth/calendar.events` – criar/editar/remover eventos.
  - `https://www.googleapis.com/auth/calendar` – acesso amplo (inclui calendários secundários).
  - Para só leitura: `.../calendar.readonly` ou `.../calendar.events.readonly`.
- **Refresh token:** Fundamental em aplicações server-side. O usuário autoriza uma vez; o backend guarda o refresh token (criptografado) e renova o access token quando necessário. A biblioteca oficial (`google-auth-library` / `googleapis`) já faz a renovação.
- **Multi-tenant:** Cada empresa/usuário Proton que quiser integração terá seu próprio par de tokens (por `user_id`). Não usar um único token global para todos.
- **Boas práticas (Google):**
  - Não guardar client secret em código; usar variáveis de ambiente ou secret manager.
  - Autorização incremental: pedir só os escopos necessários no momento (ex.: ao clicar “Conectar Google Agenda”).
  - Revogar tokens ao desvincular a integração.

### 3.2 APIs do Google Calendar

- **Recursos principais:**
  - **Events: list, insert, update, delete, patch** – CRUD de eventos.
  - **CalendarList: list** – listar calendários do usuário (primário e secundários).
  - **Sync:** Uso de `syncToken` (incremental) para listar apenas mudanças desde a última sincronização.
- **Push notifications (webhooks):** O Calendar oferece “watch” em recursos (ex.: Events de um calendário). O Google envia POST para uma URL HTTPS sua quando há mudança; o payload não traz o evento, só indica que deve fazer sync (ex.: list com `syncToken`). Reduz necessidade de polling.
- **Limites (resumo):**
  - Quotas por minuto por projeto e por usuário (sliding window). Não há limite rígido “por dia” de eventos; o que importa é não estourar requisições por minuto.
  - Respostas 403 “usageLimits” ou 429: implementar **backoff exponencial** e, se possível, distribuir chamadas ao longo do tempo (evitar picos à meia-noite).

### 3.3 Mapeamento Proton ↔ Google

| Proton (appointments) | Google Calendar (Event) |
|-----------------------|--------------------------|
| `id` (UUID) | `id` opcional; usar em updates. Ou guardar em `extendedProperties.private.protonId` |
| `start_time` / `end_time` | `start.dateTime`, `end.dateTime` (ISO com timezone) |
| `patient_name` / título | `summary` |
| `notes` | `description` |
| `doctor_id` / profissional | `extendedProperties.private.doctorId` ou no `description` |
| Status (confirmed, cancelled, etc.) | `status`: `confirmed` / `cancelled`; ou removido |
| Link de confirmação / origem | `description` ou custom field |

- **Calendário alvo:** Definir se cada empresa usa um calendário único (ex.: “Agenda Proton”) ou um calendário por profissional. Um calendário por profissional exige mais configuração e mais watches.
- **ID estável:** Para sync bidirecional, manter em todo evento Google um identificador Proton (ex.: `extendedProperties.private.protonAppointmentId = appointment.id`) e, no Proton, um campo `google_event_id` (e opcionalmente `google_calendar_id`) para evitar duplicatas e loops.

### 3.4 Infraestrutura necessária

- **Backend (Node/Proton):**
  - Rotas para: “Conectar Google” (redirect OAuth), callback OAuth, salvar tokens por `user_id`.
  - Serviço que, ao criar/atualizar/remover appointment no Proton, chama a API do Google (usando o token do `user_id`).
  - Se houver import ou bidirecional: job/fila que lê mudanças do Google (sync token ou push) e aplica no Proton.
- **Webhook (push) Google:**
  - Endpoint HTTPS público (ex.: `https://proton.seudominio.com/api/webhooks/google-calendar`) que recebe POST do Google.
  - Verificação do request (ex.: validação de token/header se documentado).
  - Resposta 200 rápida; processamento pesado em fila (job) para não estourar timeout do Google.
- **Armazenamento:**
  - Tabela ou documento por tenant: `google_calendar_tokens` (ou no `profiles`): `user_id`, `refresh_token` (criptografado), `access_token`, `expires_at`, `calendar_id` escolhido, opcional `sync_token` para eventos.
  - Se bidirecional: tabela de mapeamento `proton_appointment_id` ↔ `google_event_id` e metadados de sync.

### 3.5 Conflitos e idempotência (para sync bidirecional)

- **Conflito:** Mesmo slot ou mesmo evento editado no Proton e no Google em paralelo.
- **Estratégias comuns:**
  - “Last write wins” (timestamp da última alteração).
  - “Proton wins” ou “Google wins” por configuração.
  - Merge de campos (ex.: título do Proton, descrição do Google) com regras fixas.
  - Marcar conflito e pedir resolução manual no Proton (UI de “conflitos de sincronização”).
- **Idempotência:** Usar IDs estáveis nas chamadas à API do Google (insert com `id` opcional ou update por `event.id`) e, no Proton, evitar criar dois appointments para o mesmo evento Google (buscar por `google_event_id` antes de criar).

---

## 4. Grau de dificuldade (resumo)

| Aspecto | Dificuldade | Observação |
|--------|-------------|------------|
| OAuth 2.0 e guardar tokens por tenant | Média | Bem documentado; cuidado com segurança (refresh token criptografado). |
| Exportar Proton → Google (Opção A) | Média | Um fluxo por appointment (create/update/delete); mapeamento de campos direto. |
| Escolher calendário e UI “Conectar Google” | Baixa a média | UX e armazenamento de preferência por usuário. |
| Importar / bloquear por eventos Google (Opção B) | Média a alta | Sync incremental ou push + transformar eventos em blocos ou “compromissos externos”. |
| Sincronização bidirecional (Opção C) | Alta | Conflitos, loops, duplicatas, testes de carga e cenários edge. |
| Push notifications (watch) | Média | Requer HTTPS, resposta rápida e job assíncrono. |
| Rate limits e backoff | Baixa a média | Usar biblioteca oficial e política de retry. |

**Dificuldade global sugerida:**  
- **Só export Proton → Google:** **Média.**  
- **Export + import/bloqueio:** **Média-alta.**  
- **Bidirecional completa:** **Alta.**

---

## 5. Principais pontos de atenção

1. **Segurança**
   - Nunca expor refresh token no frontend; armazenar apenas no backend, criptografado.
   - Validar em todas as rotas que o token Google usado pertence ao `user_id` do tenant autenticado (evitar vazamento entre tenants).
   - HTTPS obrigatório para redirect OAuth e webhook.

2. **Multi-tenant**
   - Sempre escopo por `user_id`: tokens, calendário escolhido e eventos criados devem ser por empresa/usuário Proton.
   - Em modo “admin master”, não usar integração Google de um tenant para outro sem consentimento explícito.

3. **Timezone**
   - Google Calendar usa timezone por evento ou do calendário. Proton provavelmente usa UTC ou timezone da empresa. Converter de forma consistente (ex.: salvar e enviar em ISO com timezone da empresa).

4. **Cancelamento e status**
   - No Google, evento cancelado pode ser removido ou mantido com `status: "cancelled"`. Definir uma política (ex.: marcar como cancelado mantém histórico no Google).

5. **Loops de sincronização (se bidirecional)**
   - Ao aplicar mudança vinda do Google no Proton, não reenviar essa mesma mudança de volta para o Google. Usar flags “origem: google” ou “sync_id” e ignorar eventos que você mesmo acabou de escrever.

6. **Expiração de canais de push**
   - Canais de “watch” do Google expiram (ex.: 7 dias). É necessário re-registrar periodicamente (job que reaplica `watch` antes de expirar).

7. **Calendários secundários**
   - Usuário pode ter vários calendários. Definir se a integração é “um calendário por empresa” ou “um por profissional” e como escolher na UI.

---

## 6. Pesquisa em comunidades – práticas recomendadas

- **Sync eficiente:** Usar **sincronização incremental** com `syncToken` (Google) em vez de listar todos os eventos a cada vez. Documentação oficial: “Synchronize resources efficiently”.
- **Menos polling:** Usar **push notifications** (watch) para eventos do Calendar; ao receber o POST, fazer uma listagem incremental com o `syncToken` armazenado para obter as mudanças reais.
- **OAuth:** Usar **autorização incremental**, guardar tokens de forma segura (secret manager em produção), usar **google-auth-library** / **googleapis** no Node para renovação automática do access token.
- **Conflitos:** Em sync bidirecional, ter um **Conflict Resolver** definido (last-write-wins, ou “Proton wins”, ou fila de conflitos para resolução manual). Evitar merge automático sem regras claras.
- **Arquitetura:** Separar **Sync Engine** (detecta mudanças, transforma dados), **Webhook Receiver** (só recebe e enfileira), **Queue/Job** (processa em background) e **Event Store** (Proton + metadados de sync). Evitar lógica pesada dentro do handler do webhook.
- **Rate limits:** **Backoff exponencial** em erros 403/429; espalhar sincronizações ao longo do tempo para não concentrar muitas requisições no mesmo minuto.

---

## 7. Fases sugeridas (sem executar)

### Fase 1 – Preparação e OAuth

- Criar projeto no Google Cloud Console; ativar Google Calendar API; configurar tela de consentimento OAuth.
- Obter Client ID e Client Secret; configurar redirect URI no Proton (ex.: `/api/integrations/google/callback`).
- Implementar fluxo OAuth no backend: rota “Conectar Google”, callback, troca de código por tokens, armazenamento seguro do refresh token por `user_id`.
- Tela no Proton (ex.: Configurações / Integrações): botão “Conectar Google Agenda”, escolha de calendário (lista de calendários do usuário) e salvar `calendar_id` por tenant.

### Fase 2 – Exportação Proton → Google (Opção A)

- Ao criar appointment no Proton (manual ou via API), após persistir no Supabase, chamar serviço “sync to Google”: se o tenant tiver token e `calendar_id`, criar evento no Google com mapeamento Proton → Event.
- Ao atualizar appointment (horário, título, status, etc.), atualizar o evento correspondente no Google (usar `google_event_id` guardado em appointment ou em tabela de mapeamento).
- Ao cancelar/remover appointment, marcar evento como cancelado ou deletar no Google.
- Guardar `google_event_id` (e opcionalmente `google_calendar_id`) no appointment ou em tabela de integração para updates futuros.
- Tratar erros (token revogado, calendário removido): notificar usuário e desativar integração até reconectar.

### Fase 3 – Opcional: importação / bloqueio (Opção B)

- Definir se eventos do Google viram “bloqueios” em `agenda_blocks` ou uma entidade “compromisso externo” só para exibição.
- Implementar sync incremental (syncToken) ou push (watch) para ler eventos do Google; transformar em blocos ou lista de indisponibilidades no Proton.
- Garantir que o agendamento no Proton respeite esses blocos (já existe lógica de bloqueio; reutilizar).

### Fase 4 – Opcional: bidirecional (Opção C)

- Armazenar mapeamento estável Proton ↔ Google; ao receber mudança do Google (via push + sync), identificar evento por `extendedProperties` ou por `google_event_id` e atualizar (ou criar) appointment no Proton.
- Implementar regras de conflito (last-write-wins ou resolução manual) e evitar reenvio em loop (marcar origem da alteração).
- Testes extensivos: edição simultânea, exclusão em um lado, múltiplos dispositivos.

### Fase 5 – Robustez e operação

- Renovação automática de canais de push antes da expiração.
- Fila de jobs (ex.: Bull, BullMQ, SQS) para envio ao Google e processamento de webhooks.
- Logs e métricas (ex.: quantos eventos sincronizados, falhas por tenant) e alertas para token inválido ou quota.

---

## 8. Dependências e requisitos

- **Google:** Conta Google Cloud, projeto com Calendar API ativado, OAuth 2.0 configurado (tipo “Web application” para server-side).
- **Proton:** Backend Node com suporte a variáveis de ambiente (client id/secret), HTTPS em produção para OAuth e webhook.
- **Banco:** Novas colunas ou tabelas para tokens e mapeamento (ex.: `profiles` ou `integrations`: `google_refresh_token_enc`, `google_calendar_id`, `google_sync_token`; e em `appointments` ou tabela de sync: `google_event_id`).
- **Bibliotecas sugeridas:** `googleapis` ou `google-auth-library` (Node); opcionalmente lib de fila (Bull, etc.) para jobs assíncronos.

---

## 9. Riscos resumidos

| Risco | Mitigação |
|-------|------------|
| Vazamento de tokens entre tenants | Sempre filtrar por `user_id`; nunca usar token de um usuário em outro. |
| Token revogado pelo usuário | Tratar 401/403 na API Google; desativar integração e avisar para reconectar. |
| Loops em sync bidirecional | Marcar origem (Proton vs Google) e não reenviar alterações que vieram do Google. |
| Rate limit (429/403) | Backoff exponencial; distribuir sync no tempo; considerar fila com throttling. |
| Webhook fora do ar | Google pode parar de enviar; manter job de polling com syncToken como fallback. |
| Timezone inconsistente | Definir timezone da empresa no Proton e converter sempre ao falar com a API. |

---

## 10. Conclusão

- A integração **Proton → Google (export only)** é **viável e de dificuldade média**, com maior ganho imediato (agendamentos visíveis no Google/App) e menor risco.
- **Importação / bloqueio** a partir do Google aumenta um pouco a complexidade, mas continua gerenciável com sync incremental ou push.
- **Sincronização bidirecional** é **complexa** e exige design explícito de conflitos, idempotência e testes; recomendável só após as fases 1 e 2 estáveis.

Este plano serve como base para decisão de produto e escopo técnico; a implementação deve ser feita em etapas, com revisão após cada fase. **Nenhuma alteração de código ou infraestrutura foi executada neste documento.**
