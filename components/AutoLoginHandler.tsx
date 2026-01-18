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
        console.log('🔐 [Proton] onAuthStateChange:', event, session ? `session exists (user: ${session.user?.id || 'no user id'})` : 'no session');
        
        // Tentar processar para qualquer evento que tenha sessão, não apenas SIGNED_IN
        if (session && !handledAutoLogin && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
          console.log('✅ [Proton] Sessão detectada via onAuthStateChange, evento:', event);
          console.log('✅ [Proton] Dados da sessão:', { userId: session.user?.id, email: session.user?.email });
          
          try {
            // Aguardar um pouco para garantir que a sessão está totalmente estabelecida
            console.log('⏳ [Proton] Aguardando 500ms antes de obter usuário...');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            console.log('🔍 [Proton] Chamando apiAuth.getCurrentUser()...');
            
            // Timeout para evitar travamento se getCurrentUser demorar muito
            const userPromise = apiAuth.getCurrentUser();
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout ao obter usuário')), 10000)
            );
            
            const user = await Promise.race([userPromise, timeoutPromise]) as User | null;
            
            if (user) {
              console.log('✅ [Proton] Usuário obtido com sucesso:', { id: user.id, email: user.email, name: user.name });
              console.log('🔄 [Proton] Chamando onAutoLogin...');
              handledAutoLogin = true;
              onAutoLogin(user);
              // Limpar hash da URL para não expor o token
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
              console.log('✅ [Proton] Login automático concluído!');
            } else {
              console.warn('⚠️ [Proton] getCurrentUser retornou null ou undefined');
              // Tentar criar usuário básico a partir da sessão
              if (session?.user) {
                console.log('🔄 [Proton] Tentando criar usuário básico a partir da sessão...');
                const fallbackUser: User = {
                  id: session.user.id,
                  email: session.user.email || '',
                  name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário',
                  clinicName: session.user.user_metadata?.clinic_name || 'Minha Clínica'
                };
                console.log('✅ [Proton] Usuário fallback criado:', fallbackUser);
                handledAutoLogin = true;
                onAutoLogin(fallbackUser);
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
                console.log('✅ [Proton] Login automático concluído com usuário fallback!');
              } else {
                handledAutoLogin = false; // Permitir tentar novamente
              }
            }
          } catch (error: any) {
            console.error('❌ [Proton] Erro ao obter usuário após onAuthStateChange:', error);
            console.error('❌ [Proton] Stack trace:', error.stack);
            handledAutoLogin = false; // Permitir tentar novamente
          }
        }
      }
    );

    const handleMagicLink = async () => {
      // Verificar se há hash na URL (#access_token=... ou #token=...)
      let hash = window.location.hash;
      
      // CORREÇÃO: Remover duplicação de #access_token=#access_token=...
      // O Supabase pode gerar URL com hash duplicado em alguns casos
      if (hash && hash.startsWith('#access_token=#access_token=')) {
        console.warn('⚠️ [Proton] Hash duplicado detectado, corrigindo...');
        hash = hash.replace('#access_token=#access_token=', '#access_token=');
        // Atualizar URL sem duplicação
        window.history.replaceState(null, '', window.location.pathname + window.location.search + hash);
      }
      
      if (!hash || (!hash.includes('access_token') && !hash.includes('token'))) {
        return; // Não é um magic link
      }

      console.log('🔐 [Proton] Detectado magic link na URL');
      console.log('🔐 [Proton] Hash completo (primeiros 200 chars):', hash.substring(0, 200));
      
      // Extrair tokens diretamente do hash e tentar setSession manualmente
      // Isso evita depender do processamento automático do Supabase que está dando 403
      try {
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const expiresIn = hashParams.get('expires_in');
        const tokenType = hashParams.get('token_type');
        
        if (accessToken && refreshToken) {
          console.log('🔐 [Proton] Extraindo tokens do hash para processamento manual...');
          
          // Tentar usar setSession diretamente com os tokens extraídos
          // Isso pode funcionar mesmo se o processamento automático falhar
          const { data: session, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (session && !sessionError) {
            console.log('✅ [Proton] Sessão criada via setSession manual!');
            const user = await apiAuth.getCurrentUser();
            if (user) {
              console.log('✅ [Proton] Login automático bem-sucedido via setSession!');
              onAutoLogin(user);
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
              return;
            }
          } else {
            console.warn('⚠️ [Proton] setSession manual falhou:', sessionError);
          }
        }
      } catch (error: any) {
        console.warn('⚠️ [Proton] Erro ao processar hash manualmente:', error.message);
      }
      
      // Verificar também query params (pode vir ?token=... em vez de #access_token=...)
      const urlParams = new URLSearchParams(window.location.search);
      const tokenInQuery = urlParams.get('token');
      const typeInQuery = urlParams.get('type');
      
      if (tokenInQuery && typeInQuery === 'magiclink') {
        console.log('🔐 [Proton] Token encontrado em query params, tentando verificar...');
        try {
          // Tentar verificar o token manualmente
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenInQuery,
            type: 'magiclink'
          });
          
          if (data.session && !error) {
            console.log('✅ [Proton] Token verificado via verifyOtp!');
            const user = await apiAuth.getCurrentUser();
            if (user) {
              onAutoLogin(user);
              window.history.replaceState(null, '', window.location.pathname);
              return;
            }
          } else {
            console.warn('⚠️ [Proton] verifyOtp falhou:', error);
          }
        } catch (error: any) {
          console.warn('⚠️ [Proton] Erro ao verificar token:', error);
        }
      }
      
      // Tentar múltiplas vezes - o Supabase pode processar mesmo com erro 403
      // O erro 403 pode ser temporário ou não impedir a criação da sessão
      for (let attempt = 1; attempt <= 5; attempt++) {
        await new Promise(resolve => setTimeout(resolve, attempt * 1000)); // Delays progressivos: 1s, 2s, 3s, 4s, 5s

        if (handledAutoLogin) {
          return; // Já processado pelo onAuthStateChange
        }

        try {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (session) {
            // Mesmo que sessionError exista, se temos sessão, tentar usar
            console.log(`✅ [Proton] Sessão encontrada na tentativa ${attempt}, tentando fazer login...`);
            
            const user = await apiAuth.getCurrentUser();
            if (user) {
              console.log('✅ [Proton] Login automático bem-sucedido!');
              handledAutoLogin = true;
              onAutoLogin(user);
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
              return;
            } else {
              console.warn(`⚠️ [Proton] Tentativa ${attempt}: Sessão existe mas getCurrentUser retornou null`);
            }
          } else {
            console.log(`⏳ [Proton] Tentativa ${attempt}: Sessão ainda não disponível`);
          }
        } catch (error: any) {
          console.warn(`⚠️ [Proton] Tentativa ${attempt} falhou:`, error.message);
        }
      }

      console.warn('⚠️ [Proton] Não foi possível obter sessão após 5 tentativas. Aguardando onAuthStateChange...');
    };

    handleMagicLink();

    return () => {
      subscription.unsubscribe();
    };
  }, [onAutoLogin]);

  return null; // Componente invisível
}
