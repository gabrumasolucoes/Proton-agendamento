/**
 * Sistema de auditoria de segurança - Proton
 * 
 * Loga tentativas de acesso não autorizado, rate limit excedido, etc.
 * Versão JavaScript (CommonJS) do security-audit do SDR.
 */

/**
 * Tipos de eventos de segurança
 */
const SecurityEventType = {
    UNAUTHORIZED_ACCESS: 'unauthorized_access',
    RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
    LOGIN_FAILED: 'login_failed',
    LOGIN_SUCCESS: 'login_success',
    ADMIN_ACTION: 'admin_action',
    ADMIN_TOKEN_INVALID: 'admin_token_invalid',
    ADMIN_TOKEN_EXPIRED: 'admin_token_expired',
    STARTUP_CHECK_FAILED: 'startup_check_failed',
    STARTUP_CHECK_WARNING: 'startup_check_warning',
    INSECURE_CONFIG_DETECTED: 'insecure_config_detected',
    CORS_BLOCKED: 'cors_blocked',
    SUSPICIOUS_PATTERN: 'suspicious_pattern'
};

/**
 * Armazena eventos de segurança (em memória)
 * Em produção, considerar usar banco de dados ou serviço de logging
 */
const securityEvents = [];
const MAX_EVENTS = 1000; // Limitar quantidade de eventos em memória

/**
 * Loga um evento de segurança
 * 
 * @param {string} type - Tipo do evento (SecurityEventType)
 * @param {Object} req - Request do Express (pode ser null para eventos de startup)
 * @param {string} severity - Severidade: 'low', 'medium', 'high', 'critical'
 * @param {any} details - Detalhes adicionais
 */
function logSecurityEvent(type, req, severity = 'medium', details = null) {
    const event = {
        type,
        timestamp: new Date(),
        ip: req ? (req.ip || req.socket?.remoteAddress || 'unknown') : 'system',
        userAgent: req ? req.headers['user-agent'] : undefined,
        path: req ? req.path : '/system',
        method: req ? req.method : 'SYSTEM',
        userId: req?.adminSession?.email || (req?.headers && req.headers['x-user-id']) || undefined,
        details: sanitizeDetails(details),
        severity
    };

    // Adicionar evento
    securityEvents.push(event);

    // Limitar quantidade de eventos
    if (securityEvents.length > MAX_EVENTS) {
        securityEvents.shift(); // Remover o mais antigo
    }

    // Logar no console com formatação apropriada
    const emoji = getSeverityEmoji(severity);
    const logMessage = `${emoji} [Proton Security] ${type} - IP: ${event.ip} - Path: ${event.method} ${event.path}${event.userId ? ` - User: ${event.userId}` : ''}`;

    if (severity === 'critical' || severity === 'high') {
        console.error(logMessage, details || '');
    } else if (severity === 'medium') {
        console.warn(logMessage, details || '');
    } else {
        console.log(logMessage, details || '');
    }
}

/**
 * Loga evento de startup check (sem req, chamado antes do servidor subir)
 * 
 * @param {boolean} failed - Se o check falhou
 * @param {string} mode - 'strict' ou 'warn'
 * @param {string[]} errors - Lista de erros
 */
function logStartupCheckEvent(failed, mode, errors) {
    const event = {
        type: failed ? SecurityEventType.STARTUP_CHECK_FAILED : SecurityEventType.STARTUP_CHECK_WARNING,
        timestamp: new Date(),
        ip: 'startup',
        userAgent: `Node ${process.version}`,
        path: '/startup',
        method: 'STARTUP',
        severity: failed && mode === 'strict' ? 'critical' : (failed ? 'high' : 'medium'),
        details: { mode, errors, env: process.env.NODE_ENV }
    };

    securityEvents.push(event);

    if (securityEvents.length > MAX_EVENTS) {
        securityEvents.shift();
    }

    const emoji = getSeverityEmoji(event.severity);
    const logMessage = `${emoji} [Proton Security] ${event.type} - Mode: ${mode} - Errors: ${errors.length}`;

    if (event.severity === 'critical' || event.severity === 'high') {
        console.error(logMessage, errors);
    } else {
        console.warn(logMessage, errors);
    }
}

/**
 * Retorna emoji baseado na severidade
 */
function getSeverityEmoji(severity) {
    switch (severity) {
        case 'critical': return '🚨';
        case 'high': return '⚠️';
        case 'medium': return '🔒';
        case 'low': return 'ℹ️';
        default: return '📝';
    }
}

/**
 * Sanitiza detalhes para logging (remove dados sensíveis)
 */
function sanitizeDetails(details) {
    if (!details) return undefined;
    
    if (typeof details === 'string') return details;
    
    if (typeof details === 'object') {
        const sanitized = { ...details };
        const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'cookie'];
        
        for (const key of Object.keys(sanitized)) {
            if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
                sanitized[key] = '[REDACTED]';
            }
        }
        
        return sanitized;
    }
    
    return details;
}

/**
 * Obtém eventos de segurança filtrados
 */
function getSecurityEvents(filters = {}) {
    let filtered = [...securityEvents];

    if (filters.type) {
        filtered = filtered.filter(e => e.type === filters.type);
    }
    if (filters.ip) {
        filtered = filtered.filter(e => e.ip === filters.ip);
    }
    if (filters.userId) {
        filtered = filtered.filter(e => e.userId === filters.userId);
    }
    if (filters.severity) {
        filtered = filtered.filter(e => e.severity === filters.severity);
    }
    if (filters.since) {
        filtered = filtered.filter(e => e.timestamp >= filters.since);
    }

    // Ordenar por timestamp (mais recente primeiro)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Limitar quantidade
    if (filters.limit) {
        filtered = filtered.slice(0, filters.limit);
    }

    return filtered;
}

/**
 * Conta eventos por tipo
 */
function countEventsByType(since = null) {
    const counts = {};
    const events = since ? securityEvents.filter(e => e.timestamp >= since) : securityEvents;

    for (const event of events) {
        counts[event.type] = (counts[event.type] || 0) + 1;
    }

    return counts;
}

/**
 * Detecta padrões suspeitos
 */
function detectSuspiciousPatterns() {
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);
    const recentEvents = securityEvents.filter(e => e.timestamp >= lastHour);

    const ipCounts = {};

    for (const event of recentEvents) {
        if (!ipCounts[event.ip]) {
            ipCounts[event.ip] = { failedLogins: 0, rateLimits: 0, unauthorized: 0 };
        }

        if (event.type === SecurityEventType.LOGIN_FAILED) {
            ipCounts[event.ip].failedLogins++;
        } else if (event.type === SecurityEventType.RATE_LIMIT_EXCEEDED) {
            ipCounts[event.ip].rateLimits++;
        } else if (event.type === SecurityEventType.UNAUTHORIZED_ACCESS) {
            ipCounts[event.ip].unauthorized++;
        }
    }

    return {
        multipleFailedLogins: Object.entries(ipCounts)
            .filter(([_, counts]) => counts.failedLogins >= 5)
            .map(([ip]) => ip),
        multipleRateLimits: Object.entries(ipCounts)
            .filter(([_, counts]) => counts.rateLimits >= 10)
            .map(([ip]) => ip),
        multipleUnauthorized: Object.entries(ipCounts)
            .filter(([_, counts]) => counts.unauthorized >= 5)
            .map(([ip]) => ip)
    };
}

/**
 * Obtém estatísticas de segurança
 */
function getSecurityStats() {
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

    const lastHourEvents = securityEvents.filter(e => e.timestamp >= oneHourAgo);
    const last24HoursEvents = securityEvents.filter(e => e.timestamp >= oneDayAgo);

    const bySeverity = {};
    const byType = {};

    for (const event of securityEvents) {
        bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
        byType[event.type] = (byType[event.type] || 0) + 1;
    }

    const suspicious = detectSuspiciousPatterns();
    const suspiciousIps = [
        ...suspicious.multipleFailedLogins,
        ...suspicious.multipleRateLimits,
        ...suspicious.multipleUnauthorized
    ];

    return {
        totalEvents: securityEvents.length,
        lastHour: lastHourEvents.length,
        last24Hours: last24HoursEvents.length,
        bySeverity,
        byType,
        suspiciousIps: [...new Set(suspiciousIps)] // Remover duplicatas
    };
}

/**
 * Limpa eventos antigos (mais de 24 horas)
 */
function cleanupOldEvents() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const initialLength = securityEvents.length;

    // Remover eventos mais antigos que 24 horas
    while (securityEvents.length > 0 && securityEvents[0].timestamp < oneDayAgo) {
        securityEvents.shift();
    }

    return initialLength - securityEvents.length;
}

// Limpar eventos antigos a cada hora
setInterval(() => {
    const removed = cleanupOldEvents();
    if (removed > 0) {
        console.log(`🧹 [Proton Security] Removidos ${removed} eventos antigos`);
    }
}, 60 * 60 * 1000);

module.exports = {
    SecurityEventType,
    logSecurityEvent,
    logStartupCheckEvent,
    getSecurityEvents,
    countEventsByType,
    detectSuspiciousPatterns,
    getSecurityStats,
    cleanupOldEvents
};
