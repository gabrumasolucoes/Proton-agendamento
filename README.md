
# Proton - Sistema de Agendamento Inteligente

Sistema de agendamento para clínicas desenvolvido com React, Vite, TailwindCSS, Supabase e Integração com IA (Gemini).

## 🚀 Requisitos

- Node.js (v18 ou superior)
- NPM ou Yarn
- Conta no Supabase (para Banco de Dados e Auth)
- Chave de API Google Gemini (Opcional, para recursos de IA)

## 📦 Instalação Local (Cursor / VS Code)

1. **Baixe os arquivos:** Copie a estrutura de arquivos gerada para uma pasta no seu computador.
2. **Instale as dependências:**
   ```bash
   npm install
   ```
3. **Configure as Variáveis de Ambiente:**
   Crie um arquivo `.env` na raiz do projeto (baseado no exemplo abaixo) ou configure direto no seu sistema de build:
   ```env
   # API Key do Google Gemini (para IA)
   API_KEY=sua_chave_aqui
   
   # Opcionais (se for alterar a conexão do Supabase via env)
   VITE_SUPABASE_URL=sua_url_supabase
   VITE_SUPABASE_ANON_KEY=sua_chave_anonima
   ```
4. **Rodar em Desenvolvimento:**
   ```bash
   npm run dev
   ```

## 🛠️ Build e Deploy em Servidor Próprio

Para hospedar no seu servidor (ex: `proton.gabruma.com.br`), siga os passos:

### 1. Gerar o Build
Gere a pasta estática de produção. Se o site for rodar na raiz do domínio (ex: `proton.gabruma.com.br/`), rode:

```bash
npm run build
```

*Nota: Se for rodar em uma subpasta (ex: `gabruma.com.br/proton`), use: `VITE_BASE_PATH=/proton/ npm run build`*

### 2. Upload
Faça o upload de todo o conteúdo da pasta `dist` gerada para a pasta pública do seu servidor (ex: `public_html` ou `/var/www/proton.gabruma.com.br`).

### 3. Configuração do Servidor Web

Como é uma SPA (Single Page Application), você precisa redirecionar todas as rotas para o `index.html`.

#### Apache (.htaccess)
Crie um arquivo `.htaccess` na raiz do site com este conteúdo:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

#### Nginx (nginx.conf)
Adicione a diretiva `try_files` no bloco `location /`:

```nginx
server {
    listen 80;
    server_name proton.gabruma.com.br;
    root /var/www/proton.gabruma.com.br;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 🗄️ Banco de Dados (Supabase)

Ao rodar o projeto pela primeira vez, clique no ícone de **Engrenagem (Configurações)** na tela de Login para ver o script SQL necessário.

Resumo das tabelas necessárias:
- `profiles`
- `doctors`
- `patients`
- `appointments`

## 🤝 Suporte

Para dúvidas sobre a integração com IA ou Auth, verifique os arquivos em `services/api.ts` e `services/geminiService.ts`.
