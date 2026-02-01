/**
 * Rate Limiting Middleware - Proton
 * 
 * Protege endpoints contra:
 * - Brute force attacks (ex.: tentativas de login)
 * - Denial of Service (DoS)
 * - Abuso de APIs públicas
 * 
 * Implementação em memória (Map).
 * Para produção multi-instância, considerar Redis.
 */

const { logSecurityEvent, SecurityEventType } = require('../lib/security-audit');

// Armazena contadores de requisições por IP e path
const requestCounts = new Map();

// Limpeza periódica de entradas antigas (a cada 5 minutos)
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requestCounts.entries()) {
        if (now > data.resetTime) {
            requestCounts.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * Cria middleware de rate limiting configurável
 * 
 * @param {Object} config - Configuração do rate limit
 * @param {string} config.path - Nome do path (para logging e key)
 * @param {number} config.windowMs - Janela de tempo em ms (ex.: 60000 = 1 min)
 * @param {number} config.maxRequests - Máximo de requisições permitidas na janela
 * @returns {Function} Middleware Express
 */
function rateLimitMiddleware(config) {
    const { path: pathName, windowMs, maxRequests } = config;

    return (req, res, next) => {
        // Obter IP do cliente
        const ip = req.ip || req.socket.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
        const now = Date.now();
        const key = `${ip}:${pathName}`;

        // Buscar dados do contador
        let data = requestCounts.get(key);

        // Se não existe ou a janela expirou, criar novo contador
        if (!data || now > data.resetTime) {
            data = {
                count: 1,
                resetTime: now + windowMs,
                firstRequestAt: now
            };
            requestCounts.set(key, data);
            return next();
        }

        // Incrementar contador
        data.count++;

        // Verificar se excedeu o limite
        if (data.count > maxRequests) {
            const remainingTime = Math.ceil((data.resetTime - now) / 1000);
            console.warn(`⚠️  [Proton Rate Limit] IP ${ip} excedeu limite em ${pathName} (${data.count}/${maxRequests})`);
            
            // S9: Logar evento de auditoria
            logSecurityEvent(
                SecurityEventType.RATE_LIMIT_EXCEEDED,
                req,
                'medium',
                { path: pathName, count: data.count, limit: maxRequests }
            );
            
            return res.status(429).json({
                error: 'Muitas requisições. Tente novamente em alguns segundos.',
                retryAfter: remainingTime
            });
        }

        // Adicionar headers informativos
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - data.count));
        res.setHeader('X-RateLimit-Reset', new Date(data.resetTime).toISOString());

        next();
    };
}

/**
 * Configurações pré-definidas para diferentes níveis de proteção
 */
const rateLimitConfigs = {
    // Rotas de autenticação (mais restritivo)
    auth: {
        windowMs: 60000, // 1 minuto
        maxRequests: 10
    },
    // Rotas de criação/modificação (restritivo)
    mutation: {
        windowMs: 60000, // 1 minuto
        maxRequests: 30
    },
    // Rotas públicas (permissivo, só contra abuso)
    public: {
        windowMs: 60000, // 1 minuto
        maxRequests: 100
    }
};

module.exports = { 
    rateLimitMiddleware,
    rateLimitConfigs
};
