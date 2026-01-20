
import { createClient } from '@supabase/supabase-js';

// ⚠️ CRÍTICO: NUNCA hardcode chaves de segurança. Use apenas variáveis de ambiente.
// As credenciais devem ser fornecidas via variáveis de ambiente ou localStorage (configuração manual do usuário)
const PROJECT_URL = null; // Removido hardcode por segurança
const PROJECT_KEY = null; // Removido hardcode por segurança

// Tenta pegar do localStorage (configuração manual) ou das variáveis de ambiente
const getStoredConfig = () => {
  try {
    const localUrl = localStorage.getItem('proton_supabase_url');
    const localKey = localStorage.getItem('proton_supabase_key');
    
    // Ordem de prioridade: 
    // 1. LocalStorage (se o usuário sobrescreveu manualmente na UI)
    // 2. Variáveis de ambiente (Vite)
    // ⚠️ NÃO usar valores hardcoded por segurança
    const env = (import.meta as any).env || {};
    return {
      url: localUrl || env.VITE_SUPABASE_URL || null,
      key: localKey || env.VITE_SUPABASE_ANON_KEY || null
    };
  } catch (e) {
    return { url: null, key: null };
  }
};

const config = getStoredConfig();

export const isSupabaseConfigured = 
  config.url && 
  config.key && 
  config.url !== 'https://placeholder.supabase.co' &&
  !config.url.includes('placeholder');

// Initialize client.
export const supabase = createClient(
  config.url || 'https://placeholder.supabase.co',
  config.key || 'placeholder'
);
