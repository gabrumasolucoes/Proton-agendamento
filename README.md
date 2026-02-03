# Proton - Sistema de Agendamento Inteligente

Sistema de agendamento para clínicas, integrado ao **App SDR** (IA Vigil) para agendamentos via WhatsApp com IA.

## 🎯 Visão Geral

- **Stack:** React, Vite, TailwindCSS, Supabase, Google Gemini
- **Integração SDR:** O App SDR usa o Proton para criar/confirmar agendamentos quando o lead agenda via WhatsApp

## 🚀 Requisitos

- Node.js 18+
- NPM ou Yarn
- Conta Supabase (banco e auth)
- Chave API Google Gemini (opcional)

## 📦 Instalação Local

```bash
npm install
```

Crie `.env` na raiz do Proton:

```env
API_KEY=sua_chave_gemini
VITE_SUPABASE_URL=sua_url_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
```

```bash
npm run dev
```

## 🛠️ Build e Deploy

```bash
npm run build
```

O conteúdo de `dist/` deve ser servido estático (ex: via Caddy em `proton.gabruma.com.br`).

**SPA:** redirecionar todas as rotas para `index.html` (ex: `try_files $uri $uri/ /index.html` no Nginx).

## 🔗 Integração com App SDR

- O **App SDR** chama as APIs do Proton para criar consultas e verificar disponibilidade
- O Proton usa `SUPABASE_SERVICE_ROLE_KEY` para operações server-side
- Endpoints usados pelo SDR: `check-availability`, `create-appointment`, `confirm-appointment`

## 🗄️ Banco de Dados (Supabase)

Tabelas principais:
- `profiles`, `doctors`, `patients`, `appointments`
- `agenda_blocks` (bloqueios)
- `scheduling_sessions` (sessões do orquestrador SDR)
- `company_feature_flags` (features por empresa)

## 📁 Estrutura

```
Proton-agendamento/
├── api/              # Endpoints Express
├── components/       # Componentes React
├── services/         # api.ts, geminiService.ts
├── lib/              # proton-cache, supabase
├── server.js         # Servidor Express
└── migrations/       # SQL migrations
```

## 📚 Documentação Adicional

- **HORARIO_TIMEZONE_SDR_PROTON.md** – Timezone SDR vs Proton
- **migrations/README_MIGRATIONS_LEMBRETES.md** – Migrations de lembretes

---

**Repositório:** [gabrumasolucoes/Proton-agendamento](https://github.com/gabrumasolucoes/Proton-agendamento)  
**Produção:** `https://proton.gabruma.com.br`
