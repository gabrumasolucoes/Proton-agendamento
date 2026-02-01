/**
 * Admin Authentication Middleware - Proton
 * 
 * Sistema de autenticação por token de sessão para rotas admin.
 * 
 * Fluxo:
 * 1. Admin faz login em /api/auth-admin
 * 2. Backend valida credenciais e gera token único
 * 3. Token é retornado no JSON de resposta
 * 4. Front guarda token (localStorage ou sessionStorage)
 * 5. Front envia token em todas as chamadas admin (header X-Admin-Token ou Authorization)
 * 6. Middleware valida token antes de processar requisição
 * 
 * Controle por env:
 * - REQUIRE_PROTON_ADMIN_AUTH=true: exige token (produção recomendada)
 * - REQUIRE_PROTON_ADMIN_AUTH=false (default): não exige (transição gradual)
 */

const crypto = require('crypto');
const { logSecurityEvent, SecurityEventType } = require('../lib/security-audit');

// Map de sessões admin: token -> { email, expiresAt, createdAt }
const adminSessions = new Map();

// Limpeza periódica de sessões expiradas (a cada 10 minutos)
setInterval(() => {
    const now = Date.now();
    for (const [token, session] of adminSessions.entries()) {
        if (now > session.expiresAt) {
            console.log(`🗑️  [Admin Auth] Sessão expirada removida: ${session.email}`);
            adminSessions.delete(token);
        }
    }
}, 10 * 60 * 1000);

/**
 * Gera um token de sessão admin
 * 
 * @param {string} email - Email do admin
 * @param {number} expiresInMs - Validade do token em ms (default: 1 hora)
 * @returns {string} Token gerado
 */
function generateAdminToken(email, expiresInMs = 60 * 60 * 1000) {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    
    adminSessions.set(token, {
        email,
        createdAt: now,
        expiresAt: now + expiresInMs
    });

    console.log(`🔑 [Admin Auth] Token gerado para ${email} (expira em ${expiresInMs / 1000 / 60} min)`);
    
    return token;
}

/**
 * Valida um token de sessão admin
 * 
 * @param {string} token - Token a validar
 * @returns {Object|null} Sessão se válida, null se inválida/expirada
 */
function validateAdminToken(token) {
    if (!token) {
        return null;
    }

    const session = adminSessions.get(token);
    if (!session) {
        return null;
    }

    const now = Date.now();
    if (now > session.expiresAt) {
        adminSessions.delete(token);
        return null;
    }

    return session;
}

/**
 * Invalida (remove) um token de sessão admin
 * 
 * @param {string} token - Token a invalidar
 * @returns {boolean} true se removido, false se não existia
 */
function revokeAdminToken(token) {
    if (adminSessions.has(token)) {
        const session = adminSessions.get(token);
        console.log(`🔓 [Admin Auth] Token revogado: ${session.email}`);
        adminSessions.delete(token);
        return true;
    }
    return false;
}

/**
 * Middleware: requer autenticação admin com token
 * 
 * Comportamento controlado por REQUIRE_PROTON_ADMIN_AUTH:
 * - 'true': exige token válido (401 se ausente/inválido)
 * - 'false' ou não definido: não exige (comportamento atual)
 */
function requireProtonAdmin(req, res, next) {
    const requireAuth = process.env.REQUIRE_PROTON_ADMIN_AUTH === 'true';

    // Se autenticação não é obrigatória, pular validação
    if (!requireAuth) {
        return next();
    }

    // Extrair token do header (X-Admin-Token ou Authorization Bearer)
    const tokenFromHeader = req.headers['x-admin-token'];
    const authHeader = req.headers['authorization'];
    const tokenFromAuth = authHeader && authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : null;

    const token = tokenFromHeader || tokenFromAuth;

    if (!token) {
        console.warn(`⚠️  [Admin Auth] Tentativa de acesso sem token: ${req.method} ${req.path}`);
        
        // S9: Logar evento de auditoria
        logSecurityEvent(
            SecurityEventType.UNAUTHORIZED_ACCESS,
            req,
            'medium',
            { reason: 'Token ausente', path: req.path }
        );
        
        return res.status(401).json({
            error: 'Autenticação admin necessária',
            message: 'Token de sessão admin não fornecido'
        });
    }

    // Validar token
    const session = validateAdminToken(token);
    if (!session) {
        console.warn(`⚠️  [Admin Auth] Token inválido ou expirado: ${req.method} ${req.path}`);
        
        // S9: Logar evento de auditoria
        logSecurityEvent(
            SecurityEventType.ADMIN_TOKEN_INVALID,
            req,
            'medium',
            { reason: 'Token inválido ou expirado', path: req.path }
        );
        
        return res.status(401).json({
            error: 'Token inválido ou expirado',
            message: 'Faça login novamente'
        });
    }

    // Token válido: adicionar info da sessão no req para uso nos handlers
    req.adminSession = session;
    next();
}

/**
 * Retorna estatísticas das sessões admin (para debugging)
 * 
 * @returns {Object} Estatísticas
 */
function getAdminSessionStats() {
    const now = Date.now();
    let active = 0;
    let expired = 0;

    for (const session of adminSessions.values()) {
        if (now > session.expiresAt) {
            expired++;
        } else {
            active++;
        }
    }

    return {
        total: adminSessions.size,
        active,
        expired
    };
}

module.exports = {
    generateAdminToken,
    validateAdminToken,
    revokeAdminToken,
    requireProtonAdmin,
    getAdminSessionStats
};
