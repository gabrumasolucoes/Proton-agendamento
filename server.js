// Servidor para Railway - Proton Agendamento
// Inclui API de integração com SDR

const express = require('express');
const path = require('path');
const cors = require('cors');

// Importar handlers da API
const createAppointmentHandler = require('./api/create-appointment');
const checkAvailabilityHandler = require('./api/check-availability');

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

// Criar agendamento (usado pelo SDR)
app.post('/api/create-appointment', createAppointmentHandler);

// Verificar disponibilidade (usado pelo SDR)
app.get('/api/check-availability', checkAvailabilityHandler);

// ===== ARQUIVOS ESTÁTICOS =====

// Servir arquivos estáticos da pasta dist
app.use(express.static(path.join(__dirname, 'dist')));

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
    console.log(`   - GET  /api/health`);
});
