/**
 * Helper: bloqueio de agenda (weekdays, specific_date, date_range)
 * Usado por check-availability, create-appointment e closed-dates.
 *
 * FAIL-OPEN: em erro na query, getBlocksForUser retorna [] (nenhum bloqueio extra).
 * Validações: Array.isArray(weekdays), nulls em specific_date/start_date/end_date.
 */

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/**
 * Busca blocos ativos do usuário.
 * FAIL-OPEN: em erro (tabela inexistente, timeout, etc.) retorna [].
 */
async function getBlocksForUser(supabase, userId) {
    if (!supabase || !userId) return [];
    try {
        const { data, error } = await supabase
            .from('agenda_blocks')
            .select('*')
            .eq('user_id', userId)
            .eq('active', true);
        if (error) {
            console.error('❌ [agenda-blocks] Erro ao buscar blocos:', error);
            return [];
        }
        return data || [];
    } catch (e) {
        console.error('❌ [agenda-blocks] Exceção em getBlocksForUser:', e);
        return [];
    }
}

/**
 * Verifica se uma data (YYYY-MM-DD ou Date) está bloqueada.
 * @returns { blocked: boolean, message?: string }
 */
function isDateBlocked(blocks, date) {
    if (!blocks || !Array.isArray(blocks)) return { blocked: false };

    const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : new Date(date);
    if (isNaN(d.getTime())) return { blocked: false };

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const weekday = d.getDay();

    for (const b of blocks) {
        if (b.block_type === 'weekdays') {
            if (Array.isArray(b.weekdays) && b.weekdays.includes(weekday)) {
                return { blocked: true, message: (b.label && b.label.trim()) || `Não atendemos às ${DAY_NAMES[weekday]}s.` };
            }
        } else if (b.block_type === 'specific_date') {
            if (b.specific_date && b.specific_date === dateStr) {
                return { blocked: true, message: (b.label && b.label.trim()) || 'Este dia está bloqueado para agendamentos.' };
            }
        } else if (b.block_type === 'date_range' && b.start_date && b.end_date) {
            if (dateStr >= b.start_date && dateStr <= b.end_date) {
                return { blocked: true, message: (b.label && b.label.trim()) || 'Período bloqueado (ex.: férias).' };
            }
        }
    }
    return { blocked: false };
}

/**
 * Retorna { closedDates: string[], humanSummary: string } para [fromStr, toStr].
 * closedDates = YYYY-MM-DD bloqueados (weekdays expandidos + specific + range).
 */
async function getClosedDatesInRange(supabase, userId, fromStr, toStr) {
    const blocks = await getBlocksForUser(supabase, userId);
    const closedSet = new Set();
    const parts = [];

    const from = new Date(fromStr + 'T00:00:00');
    const to = new Date(toStr + 'T23:59:59');
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
        return { closedDates: [], humanSummary: 'Período inválido.' };
    }

    for (const b of blocks) {
        if (b.block_type === 'weekdays' && Array.isArray(b.weekdays) && b.weekdays.length > 0) {
            const names = b.weekdays.map(w => DAY_NAMES[w]).filter(Boolean).join(' e ');
            if (names && !parts.some(p => p.includes(names))) parts.push(`Não atendemos às ${names}.`);
            let curr = new Date(from);
            while (curr <= to) {
                if (b.weekdays.includes(curr.getDay())) closedSet.add(curr.toISOString().slice(0, 10));
                curr.setDate(curr.getDate() + 1);
            }
        } else if (b.block_type === 'specific_date' && b.specific_date) {
            if (b.specific_date >= fromStr && b.specific_date <= toStr) {
                closedSet.add(b.specific_date);
                const lbl = (b.label && b.label.trim()) || b.specific_date;
                if (lbl && !parts.includes(lbl)) parts.push(lbl);
            }
        } else if (b.block_type === 'date_range' && b.start_date && b.end_date) {
            const start = new Date(b.start_date);
            const end = new Date(b.end_date);
            if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < from || start > to) continue;
            const r = (b.label && b.label.trim()) || `${b.start_date} a ${b.end_date}`;
            if (r && !parts.some(p => p.includes(b.start_date))) parts.push(r);
            let curr = new Date(Math.max(start.getTime(), from.getTime()));
            const endCapped = new Date(Math.min(end.getTime(), to.getTime()));
            while (curr <= endCapped) {
                closedSet.add(curr.toISOString().slice(0, 10));
                curr.setDate(curr.getDate() + 1);
            }
        }
    }

    const closedDates = Array.from(closedSet).sort();
    const humanSummary = parts.length > 0
        ? `A clínica não agenda nos seguintes dias: ${parts.join(' ')}`
        : 'Não há bloqueios de agenda configurados para este período.';

    return { closedDates, humanSummary };
}

module.exports = { getBlocksForUser, isDateBlocked, getClosedDatesInRange, DAY_NAMES };
