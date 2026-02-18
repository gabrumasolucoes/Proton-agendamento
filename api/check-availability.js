/**
 * API Endpoint: GET /api/check-availability
 * 
 * Verifica horários disponíveis para agendamento.
 * Este endpoint é chamado pelo SDR para oferecer opções de horário ao cliente.
 * 
 * Query params:
 * - date: Data no formato YYYY-MM-DD (obrigatório)
 * - protonUserId: ID do usuário no Proton (OBRIGATÓRIO)
 * - doctorId: ID do médico (opcional)
 * - duration: Duração em minutos (padrão: 30)
 * 
 * Retorna lista de horários disponíveis no dia especificado.
 */

const { createClient } = require('@supabase/supabase-js');
const { getBlocksForUser, isDateBlocked } = require('../lib/agenda-blocks');

// Configuração do Supabase - Usar service_role para bypass de RLS
// ⚠️ CRÍTICO: NUNCA hardcode chaves de segurança. Use apenas variáveis de ambiente.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ [check-availability] SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_ANON_KEY) devem estar configurados.');
}

// Token de autenticação para a API (segurança) - usar PROTON_API_TOKEN (mesmo nome do SDR)
const API_SECRET_TOKEN = (process.env.PROTON_API_TOKEN || process.env.API_SECRET_TOKEN || 'proton-sdr-integration-secret-2026').trim();

// Criar cliente Supabase apenas se as variáveis estiverem configuradas
const supabase = SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false }
    })
    : null;

// Configuração de horário de funcionamento
const WORKING_HOURS = {
    start: 8,  // 8:00
    end: 18,   // 18:00
    lunchStart: 12, // 12:00
    lunchEnd: 13,   // 13:00
    slotDuration: 30 // minutos
};

async function checkAvailabilityHandler(req, res) {
    // Verificar se Supabase está configurado
    if (!supabase) {
        return res.status(500).json({ error: 'Database não configurado. Verifique as variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.' });
    }

    // Verificar método
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método não permitido. Use GET.' });
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
        const { date, protonUserId, doctorId, duration: rawDuration = 30 } = req.query;
        const duration = parseInt(rawDuration, 10);
        if (duration !== 30 && duration !== 60) {
            return res.status(400).json({ error: 'Parâmetro "duration" deve ser 30 ou 60.' });
        }

        // Validar protonUserId
        if (!protonUserId) {
            return res.status(400).json({ error: 'Parâmetro "protonUserId" é obrigatório' });
        }

        // Validar data
        if (!date) {
            return res.status(400).json({ error: 'Parâmetro "date" é obrigatório (formato: YYYY-MM-DD)' });
        }

        const targetDate = new Date(date + 'T00:00:00');
        if (isNaN(targetDate.getTime())) {
            return res.status(400).json({ error: 'Data inválida. Use formato: YYYY-MM-DD' });
        }

        // Bloqueios de agenda (fail-open: se falhar, blocks=[] e segue)
        // Passar doctorId para verificar bloqueios específicos do profissional
        const blocks = await getBlocksForUser(supabase, protonUserId, doctorId);
        const { blocked, message: blockMessage } = isDateBlocked(blocks, targetDate);
        if (blocked) {
            const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
            return res.status(200).json({
                date: date,
                dayOfWeek: dayNames[targetDate.getDay()],
                available: false,
                message: blockMessage || 'Não atendemos neste dia.',
                availableSlots: [],
                nextAvailableDate: getNextBusinessDay(targetDate)
            });
        }

        // Verificar se é dia útil (não domingo) — mantido para compatibilidade
        if (targetDate.getDay() === 0) {
            return res.status(200).json({
                date: date,
                dayOfWeek: 'Domingo',
                available: false,
                message: 'Não atendemos aos domingos.',
                availableSlots: [],
                nextAvailableDate: getNextBusinessDay(targetDate)
            });
        }

        // Gerar todos os slots do dia
        const allSlots = generateDaySlots(targetDate, duration);

        // Buscar agendamentos existentes no dia
        const dayStart = new Date(targetDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(targetDate);
        dayEnd.setHours(23, 59, 59, 999);

        let query = supabase
            .from('appointments')
            .select('start_time, end_time, doctor_id')
            .eq('user_id', protonUserId)  // Filtrar pelo usuário do Proton
            .neq('status', 'cancelled')
            .gte('start_time', dayStart.toISOString())
            .lte('start_time', dayEnd.toISOString());

        if (doctorId) {
            query = query.eq('doctor_id', doctorId);
        }

        const { data: existingAppointments, error } = await query;

        console.log(`📅 [check-availability] Query: user_id=${protonUserId}, date=${date}`);
        console.log(`📅 [check-availability] dayStart=${dayStart.toISOString()}, dayEnd=${dayEnd.toISOString()}`);
        console.log(`📅 [check-availability] Appointments encontrados: ${existingAppointments?.length || 0}`);
        if (existingAppointments?.length > 0) {
            console.log(`📅 [check-availability] Appointments:`, JSON.stringify(existingAppointments));
        }

        if (error) {
            console.error('Erro ao buscar agendamentos:', error);
            return res.status(500).json({ error: 'Erro ao verificar disponibilidade' });
        }

        // Filtrar slots ocupados
        const availableSlots = allSlots.filter(slot => {
            const slotStart = new Date(slot.dateTime);
            const slotEnd = new Date(slotStart.getTime() + duration * 60000);

            return !existingAppointments?.some(apt => {
                const aptStart = new Date(apt.start_time);
                const aptEnd = new Date(apt.end_time);
                // Verifica se há sobreposição
                return slotStart < aptEnd && slotEnd > aptStart;
            });
        });

        // Formatar resposta
        const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

        return res.status(200).json({
            date: date,
            dayOfWeek: dayNames[targetDate.getDay()],
            available: availableSlots.length > 0,
            totalSlots: allSlots.length,
            availableCount: availableSlots.length,
            availableSlots: availableSlots.map(slot => ({
                time: slot.time,
                dateTime: slot.dateTime,
                period: slot.period
            })),
            message: availableSlots.length > 0 
                ? `Temos ${availableSlots.length} horários disponíveis.`
                : 'Não há horários disponíveis nesta data.',
            suggestedMessage: formatSuggestedMessage(availableSlots, targetDate)
        });

    } catch (error) {
        console.error('Erro na API check-availability:', error);
        return res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
}

// Funções auxiliares

function generateDaySlots(date, duration) {
    const slots = [];
    const { start, end, lunchStart, lunchEnd } = WORKING_HOURS;

    // Offset de Brasília: UTC-3 (adicionar 3 horas para converter horário local para UTC)
    const BRASILIA_OFFSET_HOURS = 3;

    for (let hour = start; hour < end; hour++) {
        // Pular horário de almoço
        if (hour >= lunchStart && hour < lunchEnd) continue;

        for (let minute = 0; minute < 60; minute += duration) {
            const slotDate = new Date(date);
            // Converter horário de Brasília para UTC (adicionar 3 horas)
            slotDate.setUTCHours(hour + BRASILIA_OFFSET_HOURS, minute, 0, 0);

            // Não incluir slots no passado (comparar em UTC)
            if (slotDate < new Date()) continue;

            // Verificar se o slot completo cabe antes do fim do expediente ou almoço
            const slotEnd = new Date(slotDate.getTime() + duration * 60000);
            const slotEndHourBrasilia = slotEnd.getUTCHours() - BRASILIA_OFFSET_HOURS;
            if (slotEndHourBrasilia > end || (slotEndHourBrasilia >= lunchStart && hour < lunchStart)) continue;

            slots.push({
                time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
                dateTime: slotDate.toISOString(),
                period: hour < 12 ? 'manhã' : 'tarde'
            });
        }
    }

    return slots;
}

function getNextBusinessDay(date) {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    
    // Pular domingo
    if (next.getDay() === 0) {
        next.setDate(next.getDate() + 1);
    }
    
    return next.toISOString().split('T')[0];
}

function formatSuggestedMessage(slots, date) {
    if (slots.length === 0) {
        return 'Infelizmente não temos horários disponíveis nesta data. Gostaria de verificar outro dia?';
    }

    const dateStr = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    
    // Pegar até 3 horários para sugerir
    const suggestions = slots.slice(0, 3);
    const timeList = suggestions.map(s => s.time).join(', ');

    if (slots.length <= 3) {
        return `Para ${dateStr}, temos disponível: ${timeList}. Qual horário prefere?`;
    }

    return `Para ${dateStr}, temos ${slots.length} horários. Alguns disponíveis: ${timeList}. Qual horário prefere?`;
}

module.exports = checkAvailabilityHandler;
