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

// Configuração do Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxxasmvsfxbbauepeiyn.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4eGFzbXZzZnhiYmF1ZXBlaXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NjUxMDEsImV4cCI6MjA4MTQ0MTEwMX0.0kf2DF0qpC74J4vonTywDwHoPhdegzqjkMU1P_MvefY';

// Token de autenticação para a API (segurança)
const API_SECRET_TOKEN = process.env.API_SECRET_TOKEN || 'proton-sdr-integration-secret-2026';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Configuração de horário de funcionamento
const WORKING_HOURS = {
    start: 8,  // 8:00
    end: 18,   // 18:00
    lunchStart: 12, // 12:00
    lunchEnd: 13,   // 13:00
    slotDuration: 30 // minutos
};

async function checkAvailabilityHandler(req, res) {
    // Verificar método
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método não permitido. Use GET.' });
    }

    // Verificar autenticação
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
    }

    const token = authHeader.split(' ')[1];
    if (token !== API_SECRET_TOKEN) {
        return res.status(403).json({ error: 'Token de autenticação inválido.' });
    }

    try {
        const { date, protonUserId, doctorId, duration = 30 } = req.query;

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

        // Verificar se é dia útil (não domingo)
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
        const allSlots = generateDaySlots(targetDate, parseInt(duration));

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

        if (error) {
            console.error('Erro ao buscar agendamentos:', error);
            return res.status(500).json({ error: 'Erro ao verificar disponibilidade' });
        }

        // Filtrar slots ocupados
        const availableSlots = allSlots.filter(slot => {
            const slotStart = new Date(slot.dateTime);
            const slotEnd = new Date(slotStart.getTime() + parseInt(duration) * 60000);

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
    const { start, end, lunchStart, lunchEnd, slotDuration } = WORKING_HOURS;

    for (let hour = start; hour < end; hour++) {
        // Pular horário de almoço
        if (hour >= lunchStart && hour < lunchEnd) continue;

        for (let minute = 0; minute < 60; minute += slotDuration) {
            const slotDate = new Date(date);
            slotDate.setHours(hour, minute, 0, 0);

            // Não incluir slots no passado
            if (slotDate < new Date()) continue;

            // Verificar se o slot completo cabe antes do fim do expediente ou almoço
            const slotEnd = new Date(slotDate.getTime() + duration * 60000);
            if (slotEnd.getHours() > end || (slotEnd.getHours() >= lunchStart && hour < lunchStart)) continue;

            slots.push({
                time: slotDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
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
