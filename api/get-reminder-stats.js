/**
 * Estatísticas de lembretes para um usuário (Admin Master / modo espelho).
 * Usa supabaseAdmin para bypass RLS.
 */

const { supabaseAdmin } = require('../lib/supabase-admin');

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

async function getReminderStatsHandler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Database não configurado.' });
  }

  try {
    const { userId, from, to } = req.query;
    if (!userId || !from || !to) {
      return res.status(400).json({ error: 'userId, from e to são obrigatórios (ISO).' });
    }

    const { data: appointments, error } = await supabaseAdmin
      .from('appointments')
      .select('id, reminder_sent_at, confirmed_at, cancelled_at, cancelled_via_reminder, status, start_time')
      .eq('user_id', userId)
      .not('reminder_sent_at', 'is', null)
      .gte('start_time', from)
      .lte('start_time', to);

    if (error) {
      console.error('❌ [get-reminder-stats] Erro:', error);
      return res.status(500).json({ error: error.message });
    }

    const reminders = appointments || [];
    const totalSent = reminders.length;

    if (totalSent === 0) {
      return res.status(200).json({
        totalSent: 0,
        totalResponded: 0,
        totalConfirmed: 0,
        totalCancelled: 0,
        totalCancelledViaReminder: 0,
        totalNoResponse: 0,
        responseRate: 0,
        confirmationRate: 0,
        cancellationRate: 0,
        averageResponseTimeMinutes: 0,
        byDayOfWeek: {},
        byHour: {}
      });
    }

    const responded = reminders.filter(r => r.confirmed_at || r.cancelled_at);
    const confirmed = reminders.filter(r => r.confirmed_at);
    const cancelled = reminders.filter(r => r.cancelled_at);
    const cancelledViaReminder = reminders.filter(r => r.cancelled_via_reminder);
    const noResponse = reminders.filter(r => !r.confirmed_at && !r.cancelled_at);

    const responseRate = (responded.length / totalSent) * 100;
    const confirmationRate = (confirmed.length / totalSent) * 100;
    const cancellationRate = (cancelled.length / totalSent) * 100;

    const responseTimes = responded
      .filter(r => r.reminder_sent_at && (r.confirmed_at || r.cancelled_at))
      .map(r => {
        const sent = new Date(r.reminder_sent_at);
        const respondedAt = new Date(r.confirmed_at || r.cancelled_at);
        return (respondedAt.getTime() - sent.getTime()) / (1000 * 60);
      });
    const averageResponseTimeMinutes = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;

    const byDayOfWeek = {};
    reminders.forEach(r => {
      const day = new Date(r.start_time).getDay();
      const dayName = DAY_NAMES[day];
      if (!byDayOfWeek[dayName]) byDayOfWeek[dayName] = { sent: 0, confirmed: 0, cancelled: 0 };
      byDayOfWeek[dayName].sent++;
      if (r.confirmed_at) byDayOfWeek[dayName].confirmed++;
      if (r.cancelled_at) byDayOfWeek[dayName].cancelled++;
    });

    const byHour = {};
    reminders.forEach(r => {
      const hour = new Date(r.start_time).getHours();
      const key = `${String(hour).padStart(2, '0')}:00`;
      if (!byHour[key]) byHour[key] = { sent: 0, confirmed: 0, cancelled: 0 };
      byHour[key].sent++;
      if (r.confirmed_at) byHour[key].confirmed++;
      if (r.cancelled_at) byHour[key].cancelled++;
    });

    return res.status(200).json({
      totalSent,
      totalResponded: responded.length,
      totalConfirmed: confirmed.length,
      totalCancelled: cancelled.length,
      totalCancelledViaReminder: cancelledViaReminder.length,
      totalNoResponse: noResponse.length,
      responseRate: Math.round(responseRate * 10) / 10,
      confirmationRate: Math.round(confirmationRate * 10) / 10,
      cancellationRate: Math.round(cancellationRate * 10) / 10,
      averageResponseTimeMinutes,
      byDayOfWeek,
      byHour
    });
  } catch (err) {
    console.error('❌ [get-reminder-stats]', err);
    return res.status(500).json({ error: err.message || 'Erro interno.' });
  }
}

module.exports = getReminderStatsHandler;
