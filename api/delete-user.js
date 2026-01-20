/**
 * Endpoint para deletar usuário do Proton (apenas admin master)
 * Remove usuário do Auth e todos os dados relacionados (appointments, patients, doctors)
 */

const { supabaseAdmin } = require('../lib/supabase-admin');

async function deleteUserHandler(req, res) {
    if (req.method !== 'DELETE' && req.method !== 'POST') {
        res.setHeader('Allow', ['DELETE', 'POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const userId = req.method === 'DELETE' ? req.query.userId : req.body?.userId;

        if (!userId) {
            return res.status(400).json({ error: 'userId é obrigatório' });
        }

        // TODO: Adicionar verificação de sessão admin master

        // Buscar usuário antes de deletar (para log)
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
        const userEmail = userData?.user?.email || userId;

        // Deletar usuário do Auth (isso cascata para profiles devido ao ON DELETE CASCADE)
        // Mas precisamos deletar appointments, patients e doctors manualmente
        try {
            // Deletar agendamentos
            await supabaseAdmin
                .from('appointments')
                .delete()
                .eq('user_id', userId);

            // Deletar pacientes
            await supabaseAdmin
                .from('patients')
                .delete()
                .eq('user_id', userId);

            // Deletar doutores
            await supabaseAdmin
                .from('doctors')
                .delete()
                .eq('user_id', userId);

            // Deletar perfil (será deletado automaticamente pelo CASCADE, mas deletamos explicitamente)
            await supabaseAdmin
                .from('profiles')
                .delete()
                .eq('id', userId);

            // Deletar usuário do Auth (isso deve deletar o profile via trigger)
            const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

            if (deleteError) {
                console.error('❌ [Delete User] Erro ao deletar usuário do Auth:', deleteError);
                return res.status(500).json({ 
                    error: 'Erro ao deletar usuário',
                    details: deleteError.message || 'Erro desconhecido ao deletar usuário do Auth'
                });
            }

            console.log(`✅ [Delete User] Usuário deletado com sucesso: ${userEmail}`);

            return res.status(200).json({
                success: true,
                message: `Usuário ${userEmail} e todos os dados relacionados foram deletados com sucesso`
            });

        } catch (deleteError) {
            console.error('❌ [Delete User] Erro ao deletar dados do usuário:', deleteError);
            return res.status(500).json({ 
                error: 'Erro ao deletar dados do usuário',
                details: deleteError.message || 'Erro desconhecido ao deletar dados'
            });
        }

    } catch (error) {
        console.error('❌ [Delete User] Erro:', error);
        return res.status(500).json({ 
            error: error.message || 'Erro interno do servidor'
        });
    }
}

module.exports = deleteUserHandler;
