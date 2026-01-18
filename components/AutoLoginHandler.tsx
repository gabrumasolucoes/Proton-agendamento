import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { apiAuth } from '../services/api';
import { User } from '../types';

interface AutoLoginHandlerProps {
  onAutoLogin: (user: User) => void;
}

/**
 * Componente para processar magic links do Supabase e fazer login automático
 * Detecta o hash #access_token=... na URL e processa automaticamente
 */
export function AutoLoginHandler({ onAutoLogin }: AutoLoginHandlerProps) {
  useEffect(() => {
    const handleMagicLink = async () => {
      // Verificar se há hash na URL (#access_token=... ou #token=...)
      // O magic link do Supabase adiciona o token no hash
      const hash = window.location.hash;
      if (!hash || (!hash.includes('access_token') && !hash.includes('token'))) {
        return; // Não é um magic link, não fazer nada
      }

      console.log('🔐 [Proton] Detectado magic link na URL, processando...');

      try {
        // O Supabase processa automaticamente o hash quando você chama getSession()
        // Aguardar um pouco para garantir que o Supabase processou
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verificar se a sessão foi criada após processar o hash
        const { data: { session }, error } = await supabase.auth.getSession();

        if (session && !error) {
          console.log('✅ [Proton] Login automático via magic link bem-sucedido');

          // Obter dados do usuário usando a mesma função que o App usa
          const user = await apiAuth.getCurrentUser();
          if (user) {
            onAutoLogin(user);
            // Limpar hash da URL para não expor o token
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        } else {
          console.warn('⚠️ [Proton] Não foi possível processar magic link:', error);
        }
      } catch (error: any) {
        console.error('❌ [Proton] Erro ao processar magic link:', error);
      }
    };

    handleMagicLink();

    // Listener para mudanças de autenticação do Supabase
    // Isso captura mudanças mesmo se o hash não for processado no primeiro momento
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          console.log('✅ [Proton] Usuário autenticado via magic link (onAuthStateChange)');
          const user = await apiAuth.getCurrentUser();
          if (user) {
            onAutoLogin(user);
            // Limpar hash da URL para não expor o token
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [onAutoLogin]);

  return null; // Componente invisível
}
