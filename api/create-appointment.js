/**
 * API Endpoint: POST /api/create-appointment
 * 
 * Cria um novo agendamento no sistema Proton.
 * Este endpoint é chamado pelo SDR quando a IA agenda uma consulta via WhatsApp.
 * 
 * Body esperado:
 * {
 *   "patientName": "João Silva",
 *   "patientPhone": "5511999999999",
 *   "dateTime": "2026-01-10T14:00:00",
 *   "duration": 30,
 *   "procedureType": "Consulta - Avaliação",
 *   "doctorName": "Dr. João" (opcional),
 *   "notes": "Agendado via WhatsApp" (opcional),
 *   "protonUserId": "uuid-do-usuario-proton" (OBRIGATÓRIO - vincula ao login do Proton),
 *   "protonDoctorId": "uuid-do-medico" (opcional - médico específico)
 * }
 */

const { createClient } = require('@supabase/supabase-js');
const { getBlocksForUser, isDateBlocked } = require('../lib/agenda-blocks');

// Configuração do Supabase - usar service_role key para bypass de RLS
// ⚠️ CRÍTICO: NUNCA hardcode chaves de segurança. Use apenas variáveis de ambiente.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ [create-appointment] SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_ANON_KEY) devem estar configurados.');
}

// Token de autenticação para a API (segurança) - usar PROTON_API_TOKEN (mesmo nome do SDR)
const API_SECRET_TOKEN = (process.env.PROTON_API_TOKEN || process.env.API_SECRET_TOKEN || 'proton-sdr-integration-secret-2026').trim();

// Criar cliente Supabase apenas se as variáveis estiverem configuradas
const supabase = SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false }
    })
    : null;

async function createAppointmentHandler(req, res) {
    // Verificar se Supabase está configurado
    if (!supabase) {
        return res.status(500).json({ error: 'Database não configurado. Verifique as variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.' });
    }

    // Verificar método
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Use POST.' });
    }

    // Verificar autenticação
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
    }

    const token = (authHeader.split(' ')[1] || '').trim();
    if (!token || token !== API_SECRET_TOKEN) {
        return res.status(403).json({ error: 'Token de autenticação inválido.' });
    }

    try {
        const {
            patientName,
            patientPhone,
            dateTime,
            duration = 30,
            procedureType,
            doctorName,
            notes = 'Agendado via WhatsApp',
            protonUserId,      // ID do usuário/login no Proton (obrigatório)
            protonDoctorId     // ID do médico específico (opcional)
        } = req.body;

        // Validações
        if (!patientName || !patientPhone || !dateTime || !procedureType) {
            return res.status(400).json({
                error: 'Campos obrigatórios: patientName, patientPhone, dateTime, procedureType'
            });
        }

        // Validar protonUserId (obrigatório para vincular ao usuário correto)
        if (!protonUserId) {
            return res.status(400).json({
                error: 'Campo obrigatório: protonUserId (ID do usuário no Proton)'
            });
        }

        const normalizedPhone = normalizePhoneToE164(patientPhone);
        if (!normalizedPhone) {
            return res.status(400).json({
                error: 'Telefone inválido. Use DDD + número (ex: 11999999999 ou 5511999999999).'
            });
        }

        // Converter data: se dateTime não tiver timezone (Z ou ±HH:MM), tratar como BRT para evitar
        // horário errado quando o servidor roda em UTC (ex.: 14:00 virar 11:00 na mensagem).
        const dtStr = String(dateTime).trim();
        const hasOffset = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(dtStr);
        const normalizedDateTime = hasOffset ? dtStr : dtStr.replace(/\.\d{3}$/, '') + '-03:00';
        const startDate = new Date(normalizedDateTime);
        if (isNaN(startDate.getTime())) {
            return res.status(400).json({ error: 'Data inválida. Use formato ISO: 2026-01-10T14:00:00' });
        }

        const endDate = new Date(startDate.getTime() + duration * 60000);

        // Bloqueios de agenda (fail-open: se falhar, blocks=[] e segue)
        // IMPORTANTE: Passar protonDoctorId para verificar bloqueios do profissional específico
        const blocks = await getBlocksForUser(supabase, protonUserId, protonDoctorId);
        const { blocked, message: blockMessage } = isDateBlocked(blocks, startDate);
        if (blocked) {
            return res.status(409).json({
                error: 'Dia bloqueado para agendamentos',
                message: blockMessage || 'Esta data não está disponível para agendamento.'
            });
        }

        // 1. Buscar ou criar paciente (vinculado ao usuário do Proton) — telefone sempre normalizado E.164
        let patient = await findOrCreatePatient(patientName, normalizedPhone, protonUserId);

        // 2. Buscar médico (usar protonDoctorId se fornecido, senão buscar por nome ou primeiro disponível)
        let doctor = await findDoctor(doctorName, protonUserId, protonDoctorId);

        // 3. Verificar disponibilidade
        const isAvailable = await checkAvailability(startDate, endDate, doctor?.id, protonUserId);
        if (!isAvailable) {
            return res.status(409).json({
                error: 'Horário não disponível',
                message: 'Já existe um agendamento neste horário. Tente outro horário.',
                suggestion: await getNextAvailableSlot(startDate, doctor?.id)
            });
        }

        // 4. Criar agendamento (vinculado ao user_id do Proton)
        // patient_phone na linha do agendamento é usado pelo job de lembretes (SDR); sem ele o lembrete não é enviado
        const appointmentData = {
            user_id: protonUserId,       // IMPORTANTE: Vincula ao usuário correto do Proton
            patient_id: patient.id,
            patient_name: patientName,
            patient_phone: normalizedPhone || patient?.phone || null, // E.164 — obrigatório para envio de lembrete via WhatsApp
            doctor_id: doctor?.id || null,
            title: procedureType,
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            status: 'pending',
            notes: notes,
            source: 'chatbot',
            tags: ['whatsapp', 'sdr']
        };

        const { data: appointment, error } = await supabase
            .from('appointments')
            .insert([appointmentData])
            .select()
            .single();

        if (error) {
            console.error('Erro ao criar agendamento:', error);
            return res.status(500).json({ error: 'Erro ao criar agendamento', details: error.message });
        }

        // 5. Retornar sucesso com detalhes
        // Exibir data e hora sempre em BRT (America/Sao_Paulo), independente do TZ do servidor.
        // SDR envia dateTime em ISO com -03:00 (ver HORARIO_TIMEZONE_SDR_PROTON.md).
        const BRT = 'America/Sao_Paulo';
        const dateStr = startDate.toLocaleDateString('pt-BR', { timeZone: BRT });
        const timeStr = startDate.toLocaleTimeString('pt-BR', { timeZone: BRT, hour: '2-digit', minute: '2-digit' });

        return res.status(201).json({
            success: true,
            message: 'Agendamento criado com sucesso!',
            appointment: {
                id: appointment.id,
                patientName: patientName,
                doctorName: doctor?.name || 'A definir',
                date: dateStr,
                time: timeStr,
                procedure: procedureType,
                status: 'pending'
            },
            confirmationMessage: `Pronto! Seu agendamento está confirmado.\n\n📅 ${dateStr} às ${timeStr}\n👤 ${doctor?.name || 'Atendente Principal'}\n📋 ${procedureType}\n\nTe aguardamos lá!`
        });

    } catch (error) {
        console.error('Erro na API create-appointment:', error);
        return res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
}

// Funções auxiliares

/**
 * Normaliza telefone para E.164 (Brasil: 5511999999999).
 * Um único formato evita duplicar paciente quando o SDR envia "554388466446" vs "4388466446".
 */
function normalizePhoneToE164(phone) {
    if (!phone || typeof phone !== 'string') return null;
    let cleaned = String(phone).replace(/\D/g, '');
    if (!cleaned.startsWith('55')) {
        if (cleaned.length === 10 || cleaned.length === 11) cleaned = '55' + cleaned;
        else return null;
    }
    if (cleaned.length < 12 || cleaned.length > 13) return null;
    return cleaned;
}

async function findOrCreatePatient(name, phone, userId) {
    // Buscar paciente existente pelo telefone normalizado e user_id (um telefone = um paciente)
    const { data: existing } = await supabase
        .from('patients')
        .select('*')
        .eq('phone', phone)
        .eq('user_id', userId)
        .single();

    if (existing) {
        // Atualizar nome se o novo for "mais completo" (mais palavras ou mais longo)
        const newWords = (name || '').trim().split(/\s+/).filter(Boolean).length;
        const currentWords = (existing.name || '').trim().split(/\s+/).filter(Boolean).length;
        const nameIsMoreComplete = (newWords > currentWords) || ((name || '').trim().length > (existing.name || '').trim().length && newWords >= 1);
        if (nameIsMoreComplete && (name || '').trim()) {
            const { data: updated } = await supabase
                .from('patients')
                .update({ name: (name || '').trim() })
                .eq('id', existing.id)
                .select()
                .single();
            if (updated) return updated;
        }
        return existing;
    }

    // Criar novo paciente vinculado ao usuário
    const { data: newPatient, error } = await supabase
        .from('patients')
        .insert([{ name: (name || '').trim(), phone, user_id: userId }])
        .select()
        .single();

    if (error) {
        console.error('Erro ao criar paciente:', error);
        return { id: null, name, phone };
    }

    return newPatient;
}

async function findDoctor(doctorName, userId, protonDoctorId) {
    // Se forneceu ID específico do médico, usar esse
    if (protonDoctorId) {
        const { data } = await supabase
            .from('doctors')
            .select('*')
            .eq('id', protonDoctorId)
            .eq('user_id', userId)
            .eq('active', true)
            .single();
        
        if (data) return data;
    }

    // Se forneceu nome, buscar por nome
    if (doctorName) {
        const { data } = await supabase
            .from('doctors')
            .select('*')
            .eq('user_id', userId)
            .ilike('name', `%${doctorName}%`)
            .eq('active', true)
            .single();
        
        if (data) return data;
    }

    // Retornar primeiro médico ativo do usuário se não especificado
    const { data: doctors } = await supabase
        .from('doctors')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .limit(1);

    return doctors?.[0] || null;
}

async function checkAvailability(startDate, endDate, doctorId, userId) {
    let query = supabase
        .from('appointments')
        .select('id')
        .eq('user_id', userId)
        .neq('status', 'cancelled')
        .or(`and(start_time.lte.${endDate.toISOString()},end_time.gte.${startDate.toISOString()})`);

    if (doctorId) {
        query = query.eq('doctor_id', doctorId);
    }

    const { data } = await query;
    return !data || data.length === 0;
}

async function getNextAvailableSlot(baseDate, doctorId) {
    // Sugerir próximo horário (30 min depois)
    const nextSlot = new Date(baseDate.getTime() + 30 * 60000);
    return {
        date: nextSlot.toLocaleDateString('pt-BR'),
        time: nextSlot.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
}

module.exports = createAppointmentHandler;
