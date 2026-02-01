/**
 * Security Headers Middleware - Proton
 * 
 * Adiciona headers HTTP de segurança para proteger contra ataques comuns:
 * - XSS (Cross-Site Scripting)
 * - Clickjacking
 * - MIME sniffing
 * - Information leakage
 * 
 * Headers aplicados:
 * - Content-Security-Policy (CSP)
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - X-XSS-Protection
 * - Referrer-Policy
 * - Permissions-Policy
 * - Strict-Transport-Security (HSTS) - apenas em produção
 */

function securityHeaders(req, res, next) {
    const isProduction = process.env.NODE_ENV === 'production';

    // Content Security Policy
    // Política permissiva para compatibilidade inicial; ajustar conforme necessário
    const cspDirectives = [
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
        "style-src 'self' 'unsafe-inline' https:",
        "img-src 'self' data: https: blob:",
        "font-src 'self' data: https:",
        "connect-src 'self' https: wss: ws:",  // Adiciona wss: e ws: para WebSockets
        "frame-ancestors 'none'", // Impede embedding em iframes
        "base-uri 'self'",
        "form-action 'self'"
    ].join('; ');

    res.setHeader('Content-Security-Policy', cspDirectives);

    // Impede que a página seja carregada em um iframe (proteção contra clickjacking)
    res.setHeader('X-Frame-Options', 'DENY');

    // Impede MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Proteção XSS legada (navegadores antigos)
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Controla quanto de informação do Referer é enviado
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Desabilita features desnecessárias do navegador
    const permissionsPolicy = [
        'geolocation=()',
        'microphone=()',
        'camera=()',
        'payment=()',
        'usb=()',
        'magnetometer=()',
        'gyroscope=()',
        'accelerometer=()'
    ].join(', ');
    res.setHeader('Permissions-Policy', permissionsPolicy);

    // HSTS - força HTTPS (apenas em produção)
    if (isProduction) {
        // max-age=31536000 = 1 ano
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // Remove headers que revelam informações desnecessárias
    res.removeHeader('X-Powered-By');

    next();
}

module.exports = { securityHeaders };
