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

      console.log('🔐 [Proton] Detectado magic link na URL, aguardando processamento automático do Supabase...');

      // Aguardar um pouco para o Supabase processar automaticamente o hash
      // O Supabase processa automaticamente via _getSessionFromURL na inicialização
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        // Verificar se o Supabase já processou e criou a sessão
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (session && !sessionError) {
          console.log('✅ [Proton] Sessão criada automaticamente pelo Supabase');
          
          // Obter dados do usuário usando a mesma função que o App usa
          const user = await apiAuth.getCurrentUser();
          if (user) {
            onAutoLogin(user);
            // Limpar hash da URL para não expor o token
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        } else {
          console.warn('⚠️ [Proton] Supabase não processou automaticamente. Tentando processar manualmente...');
          console.warn('⚠️ [Proton] Erro da sessão:', sessionError);
          
          // Fallback: tentar processar manualmente apenas se o automático falhar
          const hashParams = new URLSearchParams(hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            console.log('🔐 [Proton] Tentando configurar sessão manualmente...');
            const { data: manualSession, error: manualError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (manualSession && !manualError) {
              console.log('✅ [Proton] Sessão configurada manualmente com sucesso');
              const user = await apiAuth.getCurrentUser();
              if (user) {
                onAutoLogin(user);
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
              }
            } else {
              console.error('❌ [Proton] Erro ao configurar sessão manualmente:', manualError);
            }
          }
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
