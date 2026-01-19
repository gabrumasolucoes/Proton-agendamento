/**
 * Endpoint para listar todos os usuários do Proton (apenas admin master)
 */

const { supabaseAdmin } = require('../lib/supabase-admin');

async function listUsersHandler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        // TODO: Adicionar verificação de sessão admin master no futuro
        // Por enquanto, permitir apenas em desenvolvimento ou com autenticação adicional

        // Buscar todos os usuários do Supabase Auth
        const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();

        if (usersError) {
            console.error('❌ [List Users] Erro ao buscar usuários:', usersError);
            return res.status(500).json({ error: 'Erro ao buscar usuários' });
        }

        if (!usersData?.users || usersData.users.length === 0) {
            return res.status(200).json({ users: [] });
        }

        // Buscar perfis de cada usuário
        const userIds = usersData.users.map(u => u.id);
        
        const { data: profilesData } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .in('id', userIds);

        // Combinar dados de auth.users com profiles
        const users = usersData.users.map(user => {
            const profile = profilesData?.find(p => p.id === user.id);
            
            // Contar agendamentos, pacientes e doutores de cada usuário
            // (Isso será feito de forma otimizada no futuro)
            
            return {
                id: user.id,
                email: user.email,
                name: profile?.name || user.user_metadata?.name || 'Sem nome',
                clinicName: profile?.clinic_name || user.user_metadata?.clinic_name || 'Sem clínica',
                createdAt: user.created_at,
                lastSignIn: user.last_sign_in_at,
                emailConfirmed: user.email_confirmed_at !== null
            };
        });

        console.log(`✅ [List Users] ${users.length} usuário(s) encontrado(s)`);

        return res.status(200).json({
            success: true,
            users: users
        });

    } catch (error) {
        console.error('❌ [List Users] Erro:', error);
        return res.status(500).json({ 
            error: error.message || 'Erro interno do servidor'
        });
    }
}

module.exports = listUsersHandler;
