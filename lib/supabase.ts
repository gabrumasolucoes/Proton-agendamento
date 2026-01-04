
import { createClient } from '@supabase/supabase-js';

// Credenciais fornecidas pelo usuário
const PROJECT_URL = 'https://kxxasmvsfxbbauepeiyn.supabase.co';
const PROJECT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4eGFzbXZzZnhiYmF1ZXBlaXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NjUxMDEsImV4cCI6MjA4MTQ0MTEwMX0.0kf2DF0qpC74J4vonTywDwHoPhdegzqjkMU1P_MvefY';

// Tenta pegar do localStorage (configuração manual) ou das variáveis de ambiente
const getStoredConfig = () => {
  try {
    const localUrl = localStorage.getItem('proton_supabase_url');
    const localKey = localStorage.getItem('proton_supabase_key');
    
    // Ordem de prioridade: 
    // 1. LocalStorage (se o usuário sobrescreveu manualmente na UI)
    // 2. Variáveis de ambiente (Vite)
    // 3. Constantes hardcoded (fornecidas agora)
    const env = (import.meta as any).env || {};
    return {
      url: localUrl || env.VITE_SUPABASE_URL || PROJECT_URL,
      key: localKey || env.VITE_SUPABASE_ANON_KEY || PROJECT_KEY
    };
  } catch (e) {
    return { url: PROJECT_URL, key: PROJECT_KEY };
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
