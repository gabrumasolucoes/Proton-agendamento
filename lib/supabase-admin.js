/**
 * Cliente Supabase Admin (Service Role Key) para operações que precisam bypass de RLS
 * USO APENAS NO BACKEND - NUNCA NO FRONTEND
 */

const { createClient } = require('@supabase/supabase-js');

// Service Role Key do Proton (mesmo Supabase do SDR)
// ⚠️ CRÍTICO: NUNCA hardcode chaves de segurança. Use apenas variáveis de ambiente.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ [supabase-admin] SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar configurados como variáveis de ambiente.');
    console.error('   Configure no Railway/Vercel ou no arquivo .env');
}

// Cliente admin que bypass RLS (criar apenas se as variáveis estiverem configuradas)
const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
    : null;

const isAdminConfigured = 
    SUPABASE_URL && 
    SUPABASE_SERVICE_ROLE_KEY && 
    SUPABASE_URL !== 'https://placeholder.supabase.co' &&
    !SUPABASE_SERVICE_ROLE_KEY.includes('placeholder');

module.exports = { supabaseAdmin, isAdminConfigured };
