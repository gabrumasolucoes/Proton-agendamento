# Proton - Sistema de Agendamento Inteligente

Sistema de agendamento para clínicas, integrado ao **App SDR** (IA Vigil) para agendamentos via WhatsApp com IA.

## Estado atual (fev/2026)

- **Stack:** React, Vite, TailwindCSS, Supabase (banco e auth)
- **Multi-tenant:** Cada empresa (usuário) tem seus profissionais, pacientes, agenda e configurações
- **Integração SDR:** O App SDR chama as APIs do Proton para verificar disponibilidade e criar/confirmar agendamentos quando o lead agenda via WhatsApp

### Funcionalidades

| Área | Descrição |
|------|-----------|
| **Agenda** | Calendário (dia/semana/mês), filtro por profissional, novo agendamento (N), busca (/); no mobile: FAB no rodapé, vista mensal otimizada |
| **Clientes** | Cadastro, histórico de agendamentos, próximo retorno, criar agendamento a partir do cliente |
| **Relatórios** | Atendimentos, média diária, taxa de cancelamento, procedimentos mais realizados, timeline; Estatísticas de Lembretes; Faltas e Cancelamentos (no-show, reincidentes, origem) |
| **Configurações** | Profissionais (cor, especialidade), Agenda (bloqueios por dia/período), Horário de atendimento (por dia da semana), Lembretes (WhatsApp, template, dias antes), Conta (nome, nome da empresa) |
| **Lembretes** | Envio de lembrete por WhatsApp com link de confirmação/cancelamento; confirmação/cancelamento por link |
| **No-show** | Marcar falta no detalhe do agendamento; relatório de faltas e cancelamentos (F10) |
| **Central de Ajuda** | Dúvidas frequentes, Suporte Técnico (link), Atalhos de teclado (N = novo agendamento, / = busca) |
| **Admin Master** | Apenas para usuário admin: gestão de usuários Proton (criar, listar, redefinir senha, estatísticas de segurança) |

### APIs (uso pelo SDR)

- `GET /api/check-availability` – slots disponíveis (date, protonUserId, duration)
- `POST /api/create-appointment` – criar agendamento (dateTime ISO com timezone, duration, paciente, etc.)
- `GET/POST /api/confirm-appointment` – confirmação/cancelamento por link (token)

Outros endpoints: `closed-dates`, `get-user-data`, `public-config`; admin: `auth-admin`, `list-users`, `create-proton-user`, `reset-user-password`, `get-no-show-analytics`, `get-reminder-stats`, `security-stats`.

## Requisitos

- Node.js 18+
- NPM ou Yarn
- Conta Supabase (banco e auth)

## Instalação local

```bash
cd Proton-agendamento
npm install
```

Crie `.env` na raiz do Proton (ou use as variáveis do projeto pai):

```env
VITE_SUPABASE_URL=sua_url_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
```

Para rodar só o Proton (front + API Express):

```bash
npm run dev
```

## Build e deploy

```bash
npm run build
```

O conteúdo de `dist/` deve ser servido estático (ex.: Caddy em `proton.gabruma.com.br`). **SPA:** redirecionar todas as rotas para `index.html`.

## Banco de dados (Supabase)

Tabelas principais: `profiles`, `doctors`, `patients`, `appointments`, `agenda_blocks`, `scheduling_sessions` (SDR), `company_feature_flags`. Migrations em `migrations/`.

## Estrutura

```
Proton-agendamento/
├── api/              # Endpoints Express (check-availability, create-appointment, confirm-appointment, etc.)
├── components/       # React (Header, Sidebar, CalendarGrid, PatientsView, ReportsView, SettingsModal, etc.)
├── services/         # api.ts, supabase
├── lib/              # proton-cache, supabase client
├── server.js         # Servidor Express
└── migrations/       # SQL migrations
```

## Documentação (nesta pasta)

| Documento | Descrição |
|-----------|-----------|
| **HORARIO_TIMEZONE_SDR_PROTON.md** | Convenção de horário e timezone (SDR envia ISO com -03:00; Proton exibe BRT) |
| **PLANO_HORARIOS_ATENDIMENTO_E_EXCECOES.md** | Horários de atendimento por dia e exceção manual (plano/referência) |
| **PLANO_INTERVALO_AGENDAMENTO_30_OU_60_MIN.md** | Intervalo de slots 30 min ou 60 min (plano; configuração por empresa no SDR) |
| **PLANO_UNICO_CADASTRO_POR_TELEFONE.md** | Um único paciente por telefone (normalização E.164, evitar duplicatas) |
| **PLANO_INTEGRACAO_GOOGLE_AGENDA.md** | Plano de integração Proton × Google Calendar (não implementado) |
| **VARREDURA_INDICES_RELATORIOS.md** | Varredura de relatórios e índices (comportamento de totais, no-show, lembretes) |
| **migrations/README_MIGRATIONS_LEMBRETES.md** | Migrations de lembretes |

O índice geral do projeto (SDR + Proton) está em **DOCUMENTACAO.md** na raiz do repositório.

---

**Produção:** `https://proton.gabruma.com.br`  
**Repositório:** Parte do [gabrumasolucoes/App-SDR](https://github.com/gabrumasolucoes/App-SDR) (pasta `Proton-agendamento/`).
