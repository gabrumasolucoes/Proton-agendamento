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
    let handledAutoLogin = false; // Flag para evitar login duplicado

    // Listener para mudanças de autenticação do Supabase
    // Esta é a forma mais confiável - o Supabase dispara SIGNED_IN quando processa o hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 [Proton] onAuthStateChange:', event, session ? 'session exists' : 'no session');
        
        if (event === 'SIGNED_IN' && session && !handledAutoLogin) {
          console.log('✅ [Proton] Usuário autenticado via magic link (onAuthStateChange)');
          handledAutoLogin = true;
          
          try {
            const user = await apiAuth.getCurrentUser();
            if (user) {
              onAutoLogin(user);
              // Limpar hash da URL para não expor o token
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
            } else {
              console.warn('⚠️ [Proton] Sessão existe mas getCurrentUser retornou null');
            }
          } catch (error: any) {
            console.error('❌ [Proton] Erro ao obter usuário após SIGNED_IN:', error);
          }
        }
      }
    );

    const handleMagicLink = async () => {
      // Verificar se há hash na URL (#access_token=... ou #token=...)
      const hash = window.location.hash;
      if (!hash || (!hash.includes('access_token') && !hash.includes('token'))) {
        return; // Não é um magic link
      }

      console.log('🔐 [Proton] Detectado magic link na URL');
      
      // Aguardar mais tempo para o Supabase processar e disparar onAuthStateChange
      // O Supabase processa automaticamente via _getSessionFromURL e dispara SIGNED_IN
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verificar se já foi processado pelo onAuthStateChange
      if (handledAutoLogin) {
        return;
      }

      // Fallback: verificar sessão diretamente
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (session && !sessionError && !handledAutoLogin) {
          console.log('✅ [Proton] Sessão encontrada após aguardar, fazendo login...');
          handledAutoLogin = true;
          
          const user = await apiAuth.getCurrentUser();
          if (user) {
            onAutoLogin(user);
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        } else if (!session) {
          console.warn('⚠️ [Proton] Sessão ainda não foi criada após aguardar. Aguardando onAuthStateChange...');
        }
      } catch (error: any) {
        console.error('❌ [Proton] Erro ao verificar sessão:', error);
      }
    };

    handleMagicLink();

    return () => {
      subscription.unsubscribe();
    };
  }, [onAutoLogin]);

  return null; // Componente invisível
}
