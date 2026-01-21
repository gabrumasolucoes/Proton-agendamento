/**
 * GET /api/closed-dates?protonUserId=xxx&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Auth: Bearer API_SECRET_TOKEN (mesmo do check-availability)
 * Resposta: { closedDates: string[], humanSummary: string }
 * Uso: SDR (getClosedDates) para ferramentas futuras ou admin.
 */

const { createClient } = require('@supabase/supabase-js');
const { getClosedDatesInRange } = require('../lib/agenda-blocks');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const API_SECRET_TOKEN = process.env.API_SECRET_TOKEN || 'proton-sdr-integration-secret-2026';

const supabase = SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
    : null;

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' });

    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ') || auth.split(' ')[1] !== API_SECRET_TOKEN) {
        return res.status(401).json({ error: 'Token inválido' });
    }

    if (!supabase) return res.status(500).json({ error: 'Banco não configurado' });

    const { protonUserId, from, to } = req.query;
    if (!protonUserId) return res.status(400).json({ error: 'protonUserId é obrigatório' });

    let fromStr = from;
    let toStr = to;
    if (!fromStr || !toStr) {
        const t = new Date();
        const next = new Date(t);
        next.setMonth(next.getMonth() + 1);
        fromStr = fromStr || t.toISOString().slice(0, 10);
        toStr = toStr || next.toISOString().slice(0, 10);
    }

    try {
        const { closedDates, humanSummary } = await getClosedDatesInRange(supabase, protonUserId, fromStr, toStr);
        return res.status(200).json({ closedDates, humanSummary });
    } catch (e) {
        console.error('❌ [closed-dates]', e);
        return res.status(500).json({ error: (e && e.message) || 'Erro ao obter dias fechados' });
    }
};
