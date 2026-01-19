/**
 * Cliente Supabase Admin (Service Role Key) para operações que precisam bypass de RLS
 * USO APENAS NO BACKEND - NUNCA NO FRONTEND
 */

const { createClient } = require('@supabase/supabase-js');

// Service Role Key do Proton (mesmo Supabase do SDR)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxxasmvsfxbbauepeiyn.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4eGFzbXZzZnhiYmF1ZXBlaXluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTg2NTEwMSwiZXhwIjoyMDgxNDQxMTAxfQ.sFExdUPr-RbbtNrbis8M2lRnPfRL6ykOrlBO6M6j7x8';

// Cliente admin que bypass RLS
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const isAdminConfigured = 
    SUPABASE_URL && 
    SUPABASE_SERVICE_ROLE_KEY && 
    SUPABASE_URL !== 'https://placeholder.supabase.co' &&
    !SUPABASE_SERVICE_ROLE_KEY.includes('placeholder');

module.exports = { supabaseAdmin, isAdminConfigured };
