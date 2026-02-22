/**
 * Endpoint de autenticação Admin Master para Proton
 * Similar ao SDR, mas focado em gerenciar usuários e agendamentos do Proton
 * 
 * Melhorias de segurança (S6 + S7):
 * - Gera token de sessão admin após login (válido por 1h)
 * - Nega uso de ADMIN_PASSWORD (texto plano) em produção
 * - Suporta ADMIN_MASTER_EMAILS por env
 */

const bcrypt = require('bcrypt');
const { supabaseAdmin } = require('../lib/supabase-admin');
const { generateAdminToken } = require('../middleware/admin-auth');
const { logSecurityEvent, SecurityEventType } = require('../lib/security-audit');

// Lista de emails de Admin Master
// Recomendado: definir no env (ADMIN_MASTER_EMAILS="email1@example.com,email2@example.com")
const ADMIN_MASTER_EMAILS = process.env.ADMIN_MASTER_EMAILS
    ? process.env.ADMIN_MASTER_EMAILS.split(',').map(e => e.trim())
    : [
        // Fallback hardcoded (dev only)
        'mauro.zanelato@gmail.com',
        'gabrumasolucoes@gmail.com'
    ];

/**
 * Handler de autenticação Admin Master
 */
async function authAdminHandler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    // Verificar se Supabase está configurado
    if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Database não configurado. Verifique as variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.' });
    }

    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        const inputEmail = email.toString().trim().toLowerCase();

        // Verificar se é admin master
        const isAdminMaster = ADMIN_MASTER_EMAILS.some(adminEmail => 
            inputEmail === adminEmail.toLowerCase()
        );

        if (!isAdminMaster) {
            // S9: Logar tentativa de login com email não autorizado
            logSecurityEvent(
                SecurityEventType.LOGIN_FAILED,
                req,
                'high',
                { reason: 'Email não é admin master', email: inputEmail }
            );
            
            return res.status(403).json({ error: 'Acesso negado. Apenas admin master pode acessar.' });
        }

        // Verificar senha usando bcrypt (mesmo hash do SDR)
        // Trim para evitar 500 quando o hash foi colado com espaço/newline no Railway
        const adminPasswordHash = (process.env.ADMIN_PASSWORD_HASH || '').trim();
        const adminPasswordPlain = (process.env.ADMIN_PASSWORD || '').trim();
        const isProduction = process.env.NODE_ENV === 'production';

        let isPasswordValid = false;

        // Prioridade 1: Se ADMIN_PASSWORD_HASH estiver configurado, usar bcrypt
        if (adminPasswordHash !== '') {
            try {
                isPasswordValid = await bcrypt.compare(password, adminPasswordHash);
                if (!isPasswordValid) {
                    console.warn('⚠️  [Proton Auth Admin] Tentativa de login com senha inválida (hash)');
                }
            } catch (err) {
                console.error('❌ [Proton Auth Admin] Erro ao comparar hash de senha:', err.message);
                isPasswordValid = false;
            }
        }
        // Prioridade 2: Fallback para texto plano (apenas em desenvolvimento)
        else if (adminPasswordPlain !== '') {
            // S7: Em produção, NEGAR uso de texto plano
            if (isProduction) {
                console.error('❌ [Proton Auth Admin] ADMIN_PASSWORD em texto plano não é permitido em produção.');
                console.error('   → Configure ADMIN_PASSWORD_HASH com hash bcrypt');
                console.error('   → Gerar: node -e "const bcrypt = require(\'bcrypt\'); bcrypt.hash(\'suaSenha\', 10).then(console.log);"');
                return res.status(401).json({ 
                    error: 'Configuração de segurança inválida', 
                    message: 'Entre em contato com o administrador do sistema.' 
                });
            }
            
            // Dev only: permitir texto plano
            console.warn('⚠️  [Proton Auth Admin] Usando ADMIN_PASSWORD em texto plano (INSEGURO - apenas dev)');
            console.warn('   → Em produção, defina ADMIN_PASSWORD_HASH');
            isPasswordValid = password === adminPasswordPlain;
        }
        // Prioridade 3: Se nenhum estiver configurado, negar acesso
        else {
            console.error('❌ [Proton Auth Admin] ADMIN_PASSWORD_HASH e ADMIN_PASSWORD não configurados');
            isPasswordValid = false;
        }

        if (!isPasswordValid) {
            // S9: Logar tentativa de login com senha inválida
            logSecurityEvent(
                SecurityEventType.LOGIN_FAILED,
                req,
                'high',
                { reason: 'Senha inválida', email: inputEmail }
            );
            
            return res.status(401).json({ error: 'Email ou senha incorretos' });
        }

        // Buscar todos os usuários do Proton para o admin ver
        let allUsers = [];
        try {
            const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
            
            if (usersError) {
                console.error('❌ [Proton Auth Admin] Erro ao buscar usuários:', usersError);
            } else if (usersData?.users) {
                // Buscar perfis de cada usuário
                const userIds = usersData.users.map(u => u.id);
                
                if (userIds.length > 0) {
                    const { data: profilesData } = await supabaseAdmin
                        .from('profiles')
                        .select('*')
                        .in('id', userIds);

                    // Combinar dados de auth.users com profiles
                    allUsers = usersData.users.map(user => {
                        const profile = profilesData?.find(p => p.id === user.id);
                        return {
                            id: user.id,
                            email: user.email,
                            name: profile?.name || user.user_metadata?.name || 'Sem nome',
                            clinicName: profile?.clinic_name || user.user_metadata?.clinic_name || 'Sem clínica',
                            createdAt: user.created_at,
                            lastSignIn: user.last_sign_in_at
                        };
                    });
                }
            }
        } catch (err) {
            console.error('❌ [Proton Auth Admin] Erro ao buscar usuários:', err.message);
        }

        console.log(`✅ [Proton Auth Admin] Login admin master bem-sucedido: ${inputEmail}`);

        // S9: Logar login bem-sucedido
        logSecurityEvent(
            SecurityEventType.LOGIN_SUCCESS,
            req,
            'low',
            { email: inputEmail, action: 'Admin master login' }
        );

        // S6: Gerar token de sessão admin (válido por 1 hora)
        const adminToken = generateAdminToken(inputEmail, 60 * 60 * 1000);

        // Retornar dados do admin master + token
        return res.status(200).json({
            success: true,
            token: adminToken, // Token para autenticar próximas requisições
            expiresIn: 3600, // Segundos (1 hora)
            user: {
                id: 'proton_admin_master',
                email: inputEmail,
                name: 'Admin Master Proton',
                role: 'admin',
                isAdmin: true
            },
            allUsers: allUsers
        });

    } catch (error) {
        console.error('❌ [Proton Auth Admin] Erro:', error?.message || error);
        if (error?.stack) console.error(error.stack);
        return res.status(500).json({ 
            error: 'Erro ao processar login. Verifique os logs do servidor (Railway) ou a configuração de ADMIN_PASSWORD_HASH.'
        });
    }
}

module.exports = authAdminHandler;
