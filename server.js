// Servidor para Railway - Proton Agendamento
// Inclui API de integração com SDR

const express = require('express');
const path = require('path');
const cors = require('cors');

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

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Permitir CORS para integração com SDR
app.use(express.json()); // Parse JSON body

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

// Criar agendamento (usado pelo SDR)
app.post('/api/create-appointment', createAppointmentHandler);

// Verificar disponibilidade (usado pelo SDR)
app.get('/api/check-availability', checkAvailabilityHandler);

// Dias fechados (usado pelo SDR / ferramentas futuras)
app.get('/api/closed-dates', closedDatesHandler);

// Admin Master APIs
app.post('/api/auth-admin', authAdminHandler);
app.get('/api/list-users', listUsersHandler);
app.get('/api/get-user-data', getUserDataHandler);
app.post('/api/reset-user-password', resetUserPasswordHandler);
app.delete('/api/delete-user', deleteUserHandler);
app.post('/api/delete-user', deleteUserHandler); // Fallback POST
app.post('/api/create-proton-user', createProtonUserHandler);

// Confirmação de agendamento (público, sem autenticação)
app.get('/api/confirm-appointment', confirmAppointmentHandler);
app.post('/api/confirm-appointment', confirmAppointmentHandler);

// ===== ARQUIVOS ESTÁTICOS =====

// Servir arquivos estáticos da pasta dist
app.use(express.static(path.join(__dirname, 'dist')));

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
