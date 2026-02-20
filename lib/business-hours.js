/**
 * Helper: horários de atendimento por dia da semana (business_hours).
 * Usado por check-availability e create-appointment.
 * Default quando não há config: seg–sex 8–18, almoço 12–13; sáb e dom fechados.
 * Timezone: America/Sao_Paulo (Brasília) para interpretar HH:MM.
 */

const DEFAULT_TZ = 'America/Sao_Paulo';

/** Default para dias úteis (1=seg a 5=sex): 8h–18h, almoço 12–13 */
const DEFAULT_WEEKDAY = {
    start: 8,
    end: 18,
    lunchStart: 12,
    lunchEnd: 13
};

/** Domingo (0) e sábado (6) fechados por default */
const DEFAULT_CLOSED_DAYS = [0, 6];

/**
 * Converte "08:00" / "18:00" em número de hora (0-23).
 * @param {string} timeStr - "HH:MM" ou "HH:mm"
 * @returns {number} hora (0-23) ou 0 se inválido
 */
function parseTimeToHour(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const parts = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!parts) return 0;
    const h = parseInt(parts[1], 10);
    const m = parseInt(parts[2], 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) return 0;
    return h + m / 60;
}

/**
 * Busca horário de atendimento para um dia da semana.
 * @param {object} supabase - cliente Supabase
 * @param {string} userId - user_id do Proton
 * @param {number} dayOfWeek - 0=domingo .. 6=sábado
 * @returns {Promise<{ start: number, end: number, lunchStart: number|null, lunchEnd: number|null }|null>}
 *   Objeto com horas em número (0-24) ou null se o dia estiver fechado.
 */
async function getBusinessHoursForDay(supabase, userId, dayOfWeek) {
    if (!supabase || !userId) return getDefaultForDay(dayOfWeek);

    try {
        const { data, error } = await supabase
            .from('business_hours')
            .select('start_time, end_time, lunch_start, lunch_end, active')
            .eq('user_id', userId)
            .eq('day_of_week', dayOfWeek)
            .maybeSingle();

        if (error) {
            console.error('❌ [business-hours] Erro ao buscar:', error);
            return getDefaultForDay(dayOfWeek);
        }

        if (!data) {
            return getDefaultForDay(dayOfWeek);
        }
        if (data.active === false) {
            return null; // dia explicitamente fechado
        }

        const start = parseTimeToHour(data.start_time) || DEFAULT_WEEKDAY.start;
        const end = parseTimeToHour(data.end_time) || DEFAULT_WEEKDAY.end;
        const lunchStart = data.lunch_start != null ? parseTimeToHour(data.lunch_start) : null;
        const lunchEnd = data.lunch_end != null ? parseTimeToHour(data.lunch_end) : null;

        return { start, end, lunchStart, lunchEnd };
    } catch (e) {
        console.error('❌ [business-hours] Exceção:', e);
        return getDefaultForDay(dayOfWeek);
    }
}

/**
 * Retorna o default para o dia: null se fechado (sáb/dom), objeto com horários se dia útil.
 */
function getDefaultForDay(dayOfWeek) {
    if (DEFAULT_CLOSED_DAYS.includes(dayOfWeek)) {
        return null;
    }
    return {
        start: DEFAULT_WEEKDAY.start,
        end: DEFAULT_WEEKDAY.end,
        lunchStart: DEFAULT_WEEKDAY.lunchStart,
        lunchEnd: DEFAULT_WEEKDAY.lunchEnd
    };
}

/**
 * Verifica se um horário (Date ou hora em número) está dentro do expediente do dia.
 * @param {object} hours - { start, end, lunchStart, lunchEnd } de getBusinessHoursForDay
 * @param {number} hourDecimal - hora do dia em decimal (ex.: 14.5 = 14:30)
 * @param {number} durationMinutes - duração do agendamento em minutos
 */
function isWithinBusinessHours(hours, hourDecimal, durationMinutes = 30) {
    if (!hours) return false;
    const endHour = hourDecimal + durationMinutes / 60;
    if (hourDecimal < hours.start || endHour > hours.end) return false;
    if (hours.lunchStart != null && hours.lunchEnd != null) {
        if (hourDecimal < hours.lunchEnd && endHour > hours.lunchStart) return false;
    }
    return true;
}

module.exports = {
    getBusinessHoursForDay,
    isWithinBusinessHours,
    parseTimeToHour,
    DEFAULT_WEEKDAY,
    DEFAULT_CLOSED_DAYS,
    DEFAULT_TZ
};
