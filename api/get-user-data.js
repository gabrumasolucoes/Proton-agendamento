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

    // Verificar se Supabase está configurado
    if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Database não configurado. Verifique as variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.' });
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

        // Buscar perfil do usuário (completo para configurações no modo espelho)
        const { data: profileData } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        // Buscar agenda_blocks e business_hours para configurações no modo espelho
        const { data: agendaBlocksData } = await supabaseAdmin
            .from('agenda_blocks')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        const { data: businessHoursData } = await supabaseAdmin
            .from('business_hours')
            .select('*')
            .eq('user_id', userId)
            .order('day_of_week', { ascending: true });

        const userForFront = profileData ? {
            id: profileData.id,
            email: profileData.email,
            name: profileData.name,
            clinicName: profileData.clinic_name,
            createdAt: profileData.created_at,
            reminderEnabled: profileData.reminder_enabled ?? true,
            reminderDaysBefore: profileData.reminder_days_before ?? 1,
            reminderSendTime: profileData.reminder_send_time ?? '08:00',
            reminderTimezone: profileData.reminder_timezone ?? 'America/Sao_Paulo',
            maxRemindersPerDay: profileData.max_reminders_per_day ?? 50,
            noShowToleranceMinutes: profileData.no_show_tolerance_minutes ?? 30,
            reminderMessageTemplate: profileData.reminder_message_template ?? null,
            reminderAddress: profileData.reminder_address ?? null
        } : null;

        return res.status(200).json({
            success: true,
            user: userForFront,
            appointments: appointmentsData || [],
            patients: patientsData || [],
            doctors: doctorsData || [],
            agenda_blocks: agendaBlocksData || [],
            business_hours: businessHoursData || [],
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
