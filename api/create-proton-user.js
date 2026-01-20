/**
 * Endpoint para criar novo usuário no Proton (apenas admin master)
 */

const { supabaseAdmin } = require('../lib/supabase-admin');

async function createProtonUserHandler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    // Verificar se Supabase está configurado
    if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Database não configurado. Verifique as variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.' });
    }

    try {
        const { email, password, name, clinicName } = req.body || {};

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'email, password e name são obrigatórios' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
        }

        // TODO: Adicionar verificação de sessão admin master

        // Verificar se email já existe
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const emailExists = existingUsers?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase());

        if (emailExists) {
            return res.status(400).json({ error: 'Email já cadastrado no sistema' });
        }

        // Criar usuário no Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email.toLowerCase().trim(),
            password: password,
            email_confirm: true, // Confirmar email automaticamente
            user_metadata: {
                name: name,
                clinic_name: clinicName || 'Sem clínica'
            }
        });

        if (authError || !authData.user) {
            console.error('❌ [Create User] Erro ao criar usuário no Auth:', authError);
            return res.status(500).json({ 
                error: 'Erro ao criar usuário no Auth',
                details: authError?.message || 'Erro desconhecido ao criar usuário'
            });
        }

        const newUserId = authData.user.id;

        // Criar perfil (o trigger deve criar automaticamente, mas garantimos aqui)
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: newUserId,
                email: email.toLowerCase().trim(),
                name: name,
                clinic_name: clinicName || 'Sem clínica'
            }, { onConflict: 'id' });

        if (profileError) {
            console.warn('⚠️ [Create User] Erro ao criar perfil (pode ser normal se trigger criar):', profileError);
        }

        // Criar doutor inicial para o usuário
        try {
            await supabaseAdmin
                .from('doctors')
                .insert({
                    user_id: newUserId,
                    name: name,
                    specialty: 'Geral',
                    color: '#3b82f6',
                    active: true
                });
        } catch (doctorError) {
            console.warn('⚠️ [Create User] Erro ao criar doutor inicial (não crítico):', doctorError);
        }

        console.log(`✅ [Create User] Usuário criado com sucesso: ${email} (ID: ${newUserId})`);

        return res.status(201).json({
            success: true,
            message: `Usuário ${email} criado com sucesso`,
            user: {
                id: newUserId,
                email: email.toLowerCase().trim(),
                name: name,
                clinicName: clinicName || 'Sem clínica'
            }
        });

    } catch (error) {
        console.error('❌ [Create User] Erro:', error);
        return res.status(500).json({ 
            error: error.message || 'Erro interno do servidor'
        });
    }
}

module.exports = createProtonUserHandler;
