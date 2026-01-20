import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Cliente criado após ensureSupabase(). Uso via export supabase (Proxy).
let _client: SupabaseClient | null = null;

/**
 * Obtém URL e Anon Key: localStorage > import.meta.env > /api/public-config
 */
async function resolveConfig(): Promise<{ url: string; key: string }> {
  const localUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('proton_supabase_url') : null;
  const localKey = typeof localStorage !== 'undefined' ? localStorage.getItem('proton_supabase_key') : null;

  let url = localUrl || (import.meta as any).env?.VITE_SUPABASE_URL || null;
  let key = localKey || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || null;

  if (url && key && url !== 'https://placeholder.supabase.co' && !key.includes('placeholder')) {
    return { url, key };
  }

  try {
    const res = await fetch('/api/public-config');
    if (res.ok) {
      const j = await res.json();
      if (j.supabaseUrl && j.supabaseAnonKey) {
        return { url: j.supabaseUrl, key: j.supabaseAnonKey };
      }
    }
  } catch (e) {
    console.warn('[Proton Supabase] Erro ao buscar /api/public-config:', e);
  }

  throw new Error(
    'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY no servidor (Railway) ou VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no build.'
  );
}

/**
 * Inicializa o cliente Supabase. Deve ser chamado antes de qualquer uso de `supabase`.
 */
export async function ensureSupabase(): Promise<SupabaseClient> {
  if (_client) return _client;

  const { url, key } = await resolveConfig();
  _client = createClient(url, key, {
    auth: { autoRefreshToken: true, persistSession: true },
  });
  return _client;
}

export function isSupabaseConfigured(): boolean {
  return _client != null;
}

/**
 * Acesso ao cliente. Só use após ensureSupabase() ter sido await.
 * Se usar antes, o Proxy lança erro.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    if (!_client) {
      throw new Error(
        'Supabase não inicializado. Chame await ensureSupabase() antes de usar supabase.'
      );
    }
    return (_client as Record<string | symbol, unknown>)[prop];
  },
});
