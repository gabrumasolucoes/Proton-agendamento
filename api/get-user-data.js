/**
 * Endpoint para obter todos os dados de um usuário específico (agendamentos, pacientes, doutores)
 * Apenas admin master pode usar
 */

const { supabaseAdmin } = require('../lib/supabase-admin');

async function getUserDataHandler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId é obrigatório' });
        }

        // TODO: Adicionar verificação de sessão admin master

        // Buscar agendamentos do usuário
        const { data: appointmentsData, error: appointmentsError } = await supabaseAdmin
            .from('appointments')
            .select('*')
            .eq('user_id', userId)
            .order('start_time', { ascending: false });

        if (appointmentsError) {
            console.error('❌ [Get User Data] Erro ao buscar agendamentos:', appointmentsError);
        }

        // Buscar pacientes do usuário
        const { data: patientsData, error: patientsError } = await supabaseAdmin
            .from('patients')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (patientsError) {
            console.error('❌ [Get User Data] Erro ao buscar pacientes:', patientsError);
        }

        // Buscar doutores do usuário
        const { data: doctorsData, error: doctorsError } = await supabaseAdmin
            .from('doctors')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (doctorsError) {
            console.error('❌ [Get User Data] Erro ao buscar doutores:', doctorsError);
        }

        // Buscar perfil do usuário
        const { data: profileData } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        return res.status(200).json({
            success: true,
            user: profileData ? {
                id: profileData.id,
                email: profileData.email,
                name: profileData.name,
                clinicName: profileData.clinic_name,
                createdAt: profileData.created_at
            } : null,
            appointments: appointmentsData || [],
            patients: patientsData || [],
            doctors: doctorsData || [],
            stats: {
                totalAppointments: appointmentsData?.length || 0,
                totalPatients: patientsData?.length || 0,
                totalDoctors: doctorsData?.length || 0
            }
        });

    } catch (error) {
        console.error('❌ [Get User Data] Erro:', error);
        return res.status(500).json({ 
            error: error.message || 'Erro interno do servidor'
        });
    }
}

module.exports = getUserDataHandler;
