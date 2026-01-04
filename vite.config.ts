import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente (como VITE_BASE_PATH ou API_KEY)
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    // Permite hospedar em subpastas (ex: seudominio.com/agendamento)
    // Para usar um slug, defina a variável VITE_BASE_PATH no seu build command
    base: env.VITE_BASE_PATH || '/',
    
    plugins: [react()],
    define: {
      // Garante que a chave da API esteja disponível no build
      'process.env.API_KEY': JSON.stringify(env.API_KEY || '')
    },
    build: {
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'date-fns', 'lucide-react', '@supabase/supabase-js', '@google/genai'],
          },
        },
      },
    },
  };
});