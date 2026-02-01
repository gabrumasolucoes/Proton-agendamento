/**
 * Endpoint de estatísticas de segurança (admin only)
 * 
 * Retorna métricas e eventos de auditoria de segurança.
 * Útil para monitoramento e análise de incidentes.
 */

const { 
    getSecurityStats, 
    getSecurityEvents, 
    detectSuspiciousPatterns 
} = require('../lib/security-audit');

async function securityStatsHandler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        // Obter estatísticas gerais
        const stats = getSecurityStats();

        // Obter eventos recentes (últimas 50 entradas)
        const recentEvents = getSecurityEvents({ limit: 50 });

        // Detectar padrões suspeitos
        const suspicious = detectSuspiciousPatterns();

        return res.status(200).json({
            success: true,
            stats,
            recentEvents,
            suspicious,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ [Proton Security Stats] Erro:', error);
        return res.status(500).json({ 
            error: error.message || 'Erro interno do servidor'
        });
    }
}

module.exports = securityStatsHandler;
