/**
 * API de Confirmação de Agendamento
 * 
 * Endpoints:
 * - GET /api/confirm-appointment?token=xxx - Buscar dados do agendamento
 * - POST /api/confirm-appointment - Confirmar ou cancelar agendamento
 * 
 * Segurança:
 * - Valida token único antes de processar
 * - Verifica se agendamento ainda é válido
 * - Atualiza status no banco de dados
 */

const { createClient } = require('@supabase/supabase-js');

// Configuração Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ [confirm-appointment] SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar configurados.');
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false }
    })
    : null;

/**
 * Valida token e retorna dados do agendamento
 */
async function getAppointmentByToken(token) {
    if (!supabase) {
        throw new Error('Database não configurado');
    }

    // Buscar agendamento com join para pegar nome do médico
    const { data: appointment, error } = await supabase
        .from('appointments')
        .select(`
            *,
            doctors (
                name
            )
        `)
        .eq('confirmation_token', token)
        .single();

    if (error || !appointment) {
        return { success: false, error: 'Token inválido ou agendamento não encontrado' };
    }

    // Verificar se agendamento ainda é válido
    const now = new Date();
    const startTime = new Date(appointment.start_time);
    const isPast = startTime < now;
    const isCancelled = appointment.status === 'cancelled';

    if (isPast) {
        return { success: false, error: 'Agendamento já passou' };
    }

    if (isCancelled) {
        return { success: false, error: 'Agendamento foi cancelado' };
    }

    // Formatar dados para resposta
    // doctors pode ser um objeto ou array dependendo do join
    let doctorName = 'A definir';
    if (appointment.doctors) {
        if (Array.isArray(appointment.doctors) && appointment.doctors.length > 0) {
            doctorName = appointment.doctors[0].name || 'A definir';
        } else if (appointment.doctors.name) {
            doctorName = appointment.doctors.name;
        }
    }

    const formatted = {
        id: appointment.id,
        patient_name: appointment.patient_name,
        start_time: appointment.start_time,
        end_time: appointment.end_time,
        doctor_name: doctorName,
        title: appointment.title,
        status: appointment.status
    };

    return { success: true, appointment: formatted };
}

/**
 * Atualiza status do agendamento
 */
async function updateAppointmentStatus(token, action) {
    if (!supabase) {
        throw new Error('Database não configurado');
    }

    // Validar token primeiro
    const validation = await getAppointmentByToken(token);
    if (!validation.success) {
        return validation;
    }

    const appointment = validation.appointment;

    // Determinar novo status
    let newStatus;
    let confirmedAt = null;

    if (action === 'confirm') {
        newStatus = 'confirmed';
        confirmedAt = new Date().toISOString();
    } else if (action === 'cancel') {
        newStatus = 'cancelled';
    } else {
        return { success: false, error: 'Ação inválida. Use "confirm" ou "cancel"' };
    }

    // Atualizar no banco
    const updateData = {
        status: newStatus
    };

    if (confirmedAt) {
        updateData.confirmed_at = confirmedAt;
    }

    const { error: updateError } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('confirmation_token', token);

    if (updateError) {
        console.error('❌ [confirm-appointment] Erro ao atualizar agendamento:', updateError);
        return { success: false, error: 'Erro ao atualizar agendamento' };
    }

    console.log(`✅ [confirm-appointment] Agendamento ${action === 'confirm' ? 'confirmado' : 'cancelado'} com sucesso`);

    return {
        success: true,
        message: action === 'confirm' ? 'Agendamento confirmado com sucesso' : 'Agendamento cancelado',
        appointment: {
            ...appointment,
            status: newStatus
        }
    };
}

/**
 * Handler para GET (buscar dados do agendamento)
 */
async function handleGet(req, res) {
    try {
        const token = req.query.token;

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token é obrigatório'
            });
        }

        const result = await getAppointmentByToken(token);

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('❌ [confirm-appointment] Erro no GET:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Erro interno do servidor'
        });
    }
}

/**
 * Handler para POST (confirmar ou cancelar)
 */
async function handlePost(req, res) {
    try {
        const { token, action } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token é obrigatório'
            });
        }

        if (!action || !['confirm', 'cancel'].includes(action)) {
            return res.status(400).json({
                success: false,
                error: 'Ação inválida. Use "confirm" ou "cancel"'
            });
        }

        const result = await updateAppointmentStatus(token, action);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('❌ [confirm-appointment] Erro no POST:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Erro interno do servidor'
        });
    }
}

/**
 * Handler principal
 */
module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        return handleGet(req, res);
    }

    if (req.method === 'POST') {
        return handlePost(req, res);
    }

    return res.status(405).json({
        success: false,
        error: `Method ${req.method} Not Allowed`
    });
};
