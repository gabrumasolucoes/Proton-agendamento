/**
 * Endpoint para resetar senha de usuário do Proton (apenas admin master)
 */

const { supabaseAdmin } = require('../lib/supabase-admin');

async function resetUserPasswordHandler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const { userId, newPassword } = req.body || {};

        if (!userId || !newPassword) {
            return res.status(400).json({ error: 'userId e newPassword são obrigatórios' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
        }

        // TODO: Adicionar verificação de sessão admin master

        // Buscar usuário no Auth
        const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);

        if (getUserError || !userData.user) {
            console.error('❌ [Reset Password] Erro ao buscar usuário:', getUserError);
            return res.status(404).json({ 
                error: 'Usuário não encontrado',
                details: 'O usuário não existe no sistema de autenticação'
            });
        }

        // Atualizar senha do usuário
        const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: newPassword
        });

        if (updateError || !updateData.user) {
            console.error('❌ [Reset Password] Erro ao atualizar senha:', updateError);
            return res.status(500).json({ 
                error: 'Erro ao resetar senha',
                details: updateError?.message || 'Erro desconhecido ao atualizar senha'
            });
        }

        console.log(`✅ [Reset Password] Senha resetada com sucesso para usuário: ${userData.user.email}`);

        return res.status(200).json({
            success: true,
            message: `Senha resetada com sucesso para ${userData.user.email}`
        });

    } catch (error) {
        console.error('❌ [Reset Password] Erro:', error);
        return res.status(500).json({ 
            error: error.message || 'Erro interno do servidor'
        });
    }
}

module.exports = resetUserPasswordHandler;
