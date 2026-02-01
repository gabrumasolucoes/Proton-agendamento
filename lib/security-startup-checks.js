/**
 * Security Startup Checks - Proton
 * 
 * Valida configurações críticas de segurança antes de subir o servidor Proton.
 * Controla nível de enforcement por SECURITY_MODE:
 * - 'strict': falha startup (process.exit(1)) se algo crítico estiver inseguro
 * - 'warn' (default): loga erro crítico mas deixa subir
 */

const { logStartupCheckEvent } = require('./security-audit');

/**
 * Executa todas as checagens de segurança de startup do Proton
 */
function runSecurityChecks() {
  const mode = (process.env.SECURITY_MODE || 'warn').toLowerCase();
  const isProduction = process.env.NODE_ENV === 'production';
  const errors = [];
  const warnings = [];

  console.log(`\n🔒 [Proton Security] Executando checagens de segurança...`);
  console.log(`   Modo: ${mode.toUpperCase()} | Ambiente: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}\n`);

  // Checagens aplicáveis apenas em produção
  if (isProduction) {
    // 1. API_SECRET_TOKEN
    const apiSecretToken = process.env.API_SECRET_TOKEN;
    if (!apiSecretToken || apiSecretToken === 'proton-sdr-integration-secret-2026') {
      errors.push(
        'API_SECRET_TOKEN está com valor default ou vazio em produção.\n' +
        '   → Gerar: openssl rand -hex 32\n' +
        '   → Definir: API_SECRET_TOKEN=<valor_gerado>\n' +
        '   → IMPORTANTE: usar o MESMO valor no SDR'
      );
    } else {
      console.log('   ✅ API_SECRET_TOKEN: configurado');
    }

    // 2. ADMIN_PASSWORD_HASH vs ADMIN_PASSWORD
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
    const adminPasswordPlain = process.env.ADMIN_PASSWORD;

    if (!adminPasswordHash || adminPasswordHash.trim() === '') {
      if (adminPasswordPlain && adminPasswordPlain.trim() !== '') {
        errors.push(
          'ADMIN_PASSWORD (texto plano) não é permitido em produção.\n' +
          '   → Gerar hash: node -e "const bcrypt = require(\'bcrypt\'); bcrypt.hash(\'suaSenha\', 10).then(console.log);"\n' +
          '   → Definir: ADMIN_PASSWORD_HASH=<hash_gerado>\n' +
          '   → Remover: ADMIN_PASSWORD (não usar em produção)'
        );
      } else {
        errors.push(
          'ADMIN_PASSWORD_HASH não configurado em produção.\n' +
          '   → Gerar hash: node -e "const bcrypt = require(\'bcrypt\'); bcrypt.hash(\'suaSenha\', 10).then(console.log);"\n' +
          '   → Definir: ADMIN_PASSWORD_HASH=<hash_gerado>'
        );
      }
    } else {
      console.log('   ✅ ADMIN_PASSWORD_HASH: configurado');
      
      if (adminPasswordPlain && adminPasswordPlain.trim() !== '') {
        warnings.push(
          'ADMIN_PASSWORD está definido junto com ADMIN_PASSWORD_HASH.\n' +
          '   → Remover ADMIN_PASSWORD (não é necessário quando o hash está configurado).'
        );
      }
    }

    // 3. SUPABASE_SERVICE_ROLE_KEY
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      errors.push(
        'SUPABASE_SERVICE_ROLE_KEY não configurado em produção.\n' +
        '   → Obter: Painel Supabase → Settings → API → service_role (secret)\n' +
        '   → Definir: SUPABASE_SERVICE_ROLE_KEY=<key>'
      );
    } else {
      console.log('   ✅ SUPABASE_SERVICE_ROLE_KEY: configurado');
    }

    // 4. SUPABASE_URL
    if (!process.env.SUPABASE_URL) {
      errors.push(
        'SUPABASE_URL não configurado em produção.\n' +
        '   → Obter: Painel Supabase → Settings → API → Project URL'
      );
    } else {
      console.log('   ✅ SUPABASE_URL: configurado');
    }

    // 5. PROTON_ALLOWED_ORIGINS
    if (!process.env.PROTON_ALLOWED_ORIGINS || process.env.PROTON_ALLOWED_ORIGINS.trim() === '') {
      warnings.push(
        'PROTON_ALLOWED_ORIGINS não configurado em produção.\n' +
        '   → CORS está permissivo (aceita todas as origens).\n' +
        '   → Recomendado: definir lista de origens permitidas (CSV).\n' +
        '   → Exemplo: PROTON_ALLOWED_ORIGINS=https://proton.seudominio.com,https://app.seudominio.com'
      );
    }

    // 6. ADMIN_MASTER_EMAILS
    if (!process.env.ADMIN_MASTER_EMAILS) {
      warnings.push(
        'ADMIN_MASTER_EMAILS não configurado.\n' +
        '   → Lista de emails admin está hardcoded no código (inseguro).\n' +
        '   → Recomendado: definir no env.\n' +
        '   → Exemplo: ADMIN_MASTER_EMAILS=admin@clinica.com,ti@clinica.com'
      );
    }

    // 7. REQUIRE_PROTON_ADMIN_AUTH
    const requireAuth = process.env.REQUIRE_PROTON_ADMIN_AUTH;
    if (requireAuth !== 'true') {
      warnings.push(
        'REQUIRE_PROTON_ADMIN_AUTH não está ativo.\n' +
        '   → Rotas admin (list-users, delete-user, etc.) não exigem autenticação.\n' +
        '   → Recomendado: definir REQUIRE_PROTON_ADMIN_AUTH=true após front pronto.'
      );
    }
  } else {
    // Desenvolvimento: apenas avisos leves
    console.log('   ℹ️  Modo desenvolvimento: checagens de produção desabilitadas');
    
    const apiSecretToken = process.env.API_SECRET_TOKEN;
    if (!apiSecretToken || apiSecretToken === 'proton-sdr-integration-secret-2026') {
      console.log('   ⚠️  API_SECRET_TOKEN usando default (ok para dev, mas mudar em produção)');
    }

    if (!process.env.ADMIN_PASSWORD_HASH && !process.env.ADMIN_PASSWORD) {
      console.log('   ⚠️  ADMIN_PASSWORD_HASH e ADMIN_PASSWORD não configurados');
    }
  }

  // Resultado
  const passed = errors.length === 0;

  if (errors.length > 0) {
    console.error('\n🔴 ========== ERROS CRÍTICOS DE SEGURANÇA (PROTON) ==========');
    errors.forEach((e, i) => {
      console.error(`\n   ❌ Erro ${i + 1}:`);
      e.split('\n').forEach(line => console.error(`      ${line}`));
    });
    console.error('\n🔴 ===========================================================\n');

    // S9: Logar evento de auditoria
    logStartupCheckEvent(true, mode, errors);

    if (mode === 'strict') {
      console.error('💥 [Proton Security] SECURITY_MODE=strict: servidor NÃO VAI SUBIR.');
      console.error('   Corrija os erros acima e tente novamente.\n');
      process.exit(1);
    } else {
      console.warn('⚠️  [Proton Security] SECURITY_MODE=warn: servidor VAI SUBIR, mas corrija esses problemas URGENTEMENTE.');
      console.warn('   Em produção, esses erros comprometem a segurança do sistema.\n');
    }
  }

  if (warnings.length > 0 && isProduction) {
    console.warn('\n🟡 ========== AVISOS DE SEGURANÇA (PROTON) ==========');
    warnings.forEach((w, i) => {
      console.warn(`\n   ⚠️  Aviso ${i + 1}:`);
      w.split('\n').forEach(line => console.warn(`      ${line}`));
    });
    console.warn('\n🟡 ====================================================\n');

    // S9: Logar avisos de auditoria
    if (warnings.length > 0) {
      logStartupCheckEvent(false, mode, warnings);
    }
  }

  if (passed && errors.length === 0) {
    console.log('\n✅ [Proton Security] Todas as checagens críticas de startup passaram!\n');
  }

  return { passed, errors, warnings };
}

module.exports = { runSecurityChecks };
