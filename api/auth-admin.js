/**
 * Endpoint de autenticação Admin Master para Proton
 * Similar ao SDR, mas focado em gerenciar usuários e agendamentos do Proton
 */

const bcrypt = require('bcrypt');
const { supabaseAdmin } = require('../lib/supabase-admin');

// Lista de emails de Admin Master (mesmos do SDR)
const ADMIN_MASTER_EMAILS = [
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
            return res.status(403).json({ error: 'Acesso negado. Apenas admin master pode acessar.' });
        }

        // Verificar senha usando bcrypt (mesmo hash do SDR)
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
        const adminPasswordPlain = process.env.ADMIN_PASSWORD; // Fallback

        let isPasswordValid = false;

        // Prioridade 1: Se ADMIN_PASSWORD_HASH estiver configurado, usar bcrypt
        if (adminPasswordHash && adminPasswordHash.trim() !== '') {
            try {
                isPasswordValid = await bcrypt.compare(password, adminPasswordHash);
                if (!isPasswordValid) {
                    console.warn('⚠️ [Proton Auth Admin] Tentativa de login com senha inválida (hash)');
                }
            } catch (err) {
                console.error('❌ [Proton Auth Admin] Erro ao comparar hash de senha:', err.message);
                isPasswordValid = false;
            }
        }
        // Prioridade 2: Fallback para texto plano (compatibilidade durante migração)
        else if (adminPasswordPlain && adminPasswordPlain.trim() !== '') {
            console.warn('⚠️ [Proton Auth Admin] ADMIN_PASSWORD_HASH não configurado, usando texto plano (INSECURO - migrar para hash)');
            isPasswordValid = password === adminPasswordPlain;
        }
        // Prioridade 3: Se nenhum estiver configurado, negar acesso
        else {
            console.error('❌ [Proton Auth Admin] ADMIN_PASSWORD_HASH e ADMIN_PASSWORD não configurados');
            isPasswordValid = false;
        }

        if (!isPasswordValid) {
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

        // Retornar dados do admin master
        return res.status(200).json({
            success: true,
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
        console.error('❌ [Proton Auth Admin] Erro:', error);
        return res.status(500).json({ 
            error: error.message || 'Erro interno do servidor'
        });
    }
}

module.exports = authAdminHandler;
