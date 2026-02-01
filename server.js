// Servidor para Railway - Proton Agendamento
// Inclui API de integração com SDR

const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

// Executar checagens de segurança de startup
const { runSecurityChecks } = require('./lib/security-startup-checks');
runSecurityChecks();

// Importar handlers da API
const createAppointmentHandler = require('./api/create-appointment');
const checkAvailabilityHandler = require('./api/check-availability');
const authAdminHandler = require('./api/auth-admin');
const listUsersHandler = require('./api/list-users');
const getUserDataHandler = require('./api/get-user-data');
const resetUserPasswordHandler = require('./api/reset-user-password');
const deleteUserHandler = require('./api/delete-user');
const createProtonUserHandler = require('./api/create-proton-user');
const confirmAppointmentHandler = require('./api/confirm-appointment');
const publicConfigHandler = require('./api/public-config');
const closedDatesHandler = require('./api/closed-dates');
const securityStatsHandler = require('./api/security-stats');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== ARQUIVOS ESTÁTICOS (ANTES DOS MIDDLEWARES DE SEGURANÇA) =====
// Servir arquivos estáticos ANTES de aplicar middlewares pesados
// Isso evita rate limiting e outros checks desnecessários para assets
app.use(express.static(path.join(__dirname, 'dist')));

// Middleware de segurança: headers HTTP
const { securityHeaders } = require('./middleware/security-headers');
app.use(securityHeaders);

// Configuração de CORS com lista de origens permitidas
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = process.env.PROTON_ALLOWED_ORIGINS 
    ? process.env.PROTON_ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : (isProduction 
        ? [] // Em produção sem config: lista vazia (logar aviso)
        : [
            'http://localhost:3000', 
            'http://127.0.0.1:3000', 
            'http://localhost:5173',
            'http://127.0.0.1:5173'
          ]
    );

if (isProduction && allowedOrigins.length === 0) {
    console.warn('\n⚠️  [CORS] PROTON_ALLOWED_ORIGINS não definido em produção.');
    console.warn('   → CORS está desprotegido (aceita todas as origens).');
    console.warn('   → Configure: PROTON_ALLOWED_ORIGINS=https://proton.seudominio.com,https://app.seudominio.com\n');
}

app.use(cors({
    origin: (origin, callback) => {
        // Requisições sem origin (ex.: curl, Postman, servidor-para-servidor)
        if (!origin) {
            return callback(null, true);
        }

        // Verificar se origin está na lista permitida
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            callback(null, true);
        } else {
            // Em produção sem config, permitir (mas já avisamos acima)
            if (isProduction && allowedOrigins.length === 0) {
                callback(null, true);
            } else {
                console.warn(`⚠️  [CORS] Origem bloqueada: ${origin}`);
                callback(new Error('CORS: origem não permitida'));
            }
        }
    },
    credentials: true, // Permite cookies e autenticação
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token', 'X-Requested-With']
}));

// Parse JSON body
app.use(express.json());

// Carregar middleware de rate limiting
const { rateLimitMiddleware, rateLimitConfigs } = require('./middleware/rate-limit');

// Carregar middleware de autenticação admin
const { requireProtonAdmin } = require('./middleware/admin-auth');

// ===== ROTAS DA API =====

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'Proton Agendamento API',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Config pública para o frontend (Supabase URL e Anon Key em runtime)
app.get('/api/public-config', publicConfigHandler);

// Criar agendamento (usado pelo SDR) - rate limit restritivo
app.post('/api/create-appointment',
    rateLimitMiddleware({ path: 'create-appointment', ...rateLimitConfigs.mutation }),
    createAppointmentHandler
);

// Verificar disponibilidade (usado pelo SDR)
app.get('/api/check-availability', checkAvailabilityHandler);

// Dias fechados (usado pelo SDR / ferramentas futuras)
app.get('/api/closed-dates', closedDatesHandler);

// Admin Master APIs - protegidas por requireProtonAdmin (controlado por REQUIRE_PROTON_ADMIN_AUTH)
app.post('/api/auth-admin',
    rateLimitMiddleware({ path: 'auth-admin', ...rateLimitConfigs.auth }),
    authAdminHandler
);

// Rotas de gerenciamento (exigem token admin se REQUIRE_PROTON_ADMIN_AUTH=true)
app.get('/api/list-users', requireProtonAdmin, listUsersHandler);
app.get('/api/get-user-data', requireProtonAdmin, getUserDataHandler);
app.post('/api/reset-user-password', requireProtonAdmin, resetUserPasswordHandler);
app.delete('/api/delete-user', requireProtonAdmin, deleteUserHandler);
app.post('/api/delete-user', requireProtonAdmin, deleteUserHandler); // Fallback POST
app.post('/api/create-proton-user', requireProtonAdmin, createProtonUserHandler);

// Estatísticas de segurança (admin only)
app.get('/api/security-stats', requireProtonAdmin, securityStatsHandler);

// Confirmação de agendamento (público, sem autenticação) - rate limit permissivo
app.get('/api/confirm-appointment',
    rateLimitMiddleware({ path: 'confirm-appointment', ...rateLimitConfigs.public }),
    confirmAppointmentHandler
);
app.post('/api/confirm-appointment',
    rateLimitMiddleware({ path: 'confirm-appointment', ...rateLimitConfigs.public }),
    confirmAppointmentHandler
);

// ===== ROTAS ESPECIAIS =====

// Rota especial para página de confirmação (cp2/[token])
app.get('/cp2/:token', (req, res) => {
    const confirmPath = path.join(__dirname, 'dist', 'confirm.html');
    res.sendFile(confirmPath);
});

// SPA fallback - rotas que não são API retornam index.html
app.get('*', (req, res) => {
    // Não aplicar fallback para rotas /api
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Endpoint não encontrado' });
    }
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Proton Agendamento rodando na porta ${PORT}`);
    console.log(`📡 API disponível em /api`);
    console.log(`   - POST /api/create-appointment`);
    console.log(`   - GET  /api/check-availability`);
    console.log(`   - GET  /api/closed-dates`);
    console.log(`   - GET  /api/health`);
    console.log(`   - POST /api/auth-admin (Admin Master)`);
    console.log(`   - GET  /api/list-users (Admin Master)`);
    console.log(`   - GET  /api/get-user-data (Admin Master)`);
    console.log(`   - POST /api/reset-user-password (Admin Master)`);
    console.log(`   - DELETE/POST /api/delete-user (Admin Master)`);
    console.log(`   - POST /api/create-proton-user (Admin Master)`);
});
