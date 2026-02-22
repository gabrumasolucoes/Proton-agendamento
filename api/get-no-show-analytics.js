/**
 * Analytics de no-show e cancelamentos para um usuário (Admin Master / modo espelho).
 * Usa supabaseAdmin para bypass RLS.
 */

const { supabaseAdmin } = require('../lib/supabase-admin');

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

async function getNoShowAnalyticsHandler(req, res) {
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

    let toleranceMinutes = 30;
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('no_show_tolerance_minutes')
      .eq('id', userId)
      .maybeSingle();
    if (profile?.no_show_tolerance_minutes != null) {
      toleranceMinutes = Math.max(0, profile.no_show_tolerance_minutes);
    }

    const { data: eligibleAppointments, error: eligibleError } = await supabaseAdmin
      .from('appointments')
      .select('id, start_time')
      .eq('user_id', userId)
      .in('status', ['confirmed', 'pending'])
      .is('no_show_at', null)
      .gte('start_time', from)
      .lte('start_time', to);

    let noShowsDetectedNotMarked = 0;
    if (!eligibleError && eligibleAppointments?.length) {
      const now = Date.now();
      const toleranceMs = toleranceMinutes * 60 * 1000;
      noShowsDetectedNotMarked = eligibleAppointments.filter(
        apt => new Date(apt.start_time).getTime() + toleranceMs < now
      ).length;
    }

    const { data: appointments, error } = await supabaseAdmin
      .from('appointments')
      .select('id, patient_id, patient_name, start_time, cancelled_at, cancelled_by, cancelled_via_reminder, no_show_at, cancellation_reason')
      .eq('user_id', userId)
      .eq('status', 'cancelled')
      .gte('start_time', from)
      .lte('start_time', to);

    if (error) {
      console.error('❌ [get-no-show-analytics] Erro:', error);
      return res.status(500).json({ error: error.message });
    }

    const cancelled = appointments || [];
    const noShows = cancelled.filter(a => a.no_show_at);
    const otherCancellations = cancelled.filter(a => !a.no_show_at);

    const cancelledByPatient = otherCancellations.filter(a => a.cancelled_by === 'patient').length;
    const cancelledByOperator = otherCancellations.filter(a => a.cancelled_by === 'operator').length;
    const cancelledBySystem = otherCancellations.filter(a => a.cancelled_by === 'system' && !a.no_show_at).length;
    const cancelledViaReminder = otherCancellations.filter(a => a.cancelled_via_reminder).length;

    const byDayOfWeek = {};
    cancelled.forEach(apt => {
      const day = new Date(apt.start_time).getDay();
      const dayName = DAY_NAMES[day];
      if (!byDayOfWeek[dayName]) byDayOfWeek[dayName] = { noShows: 0, cancellations: 0 };
      if (apt.no_show_at) byDayOfWeek[dayName].noShows++;
      else byDayOfWeek[dayName].cancellations++;
    });

    const byTimeSlot = {};
    ['06-08h', '08-10h', '10-12h', '12-14h', '14-16h', '16-18h', '18-20h', '20-22h'].forEach(slot => {
      byTimeSlot[slot] = { noShows: 0, cancellations: 0 };
    });
    cancelled.forEach(apt => {
      const hour = new Date(apt.start_time).getHours();
      let slot = '20-22h';
      if (hour >= 6 && hour < 8) slot = '06-08h';
      else if (hour >= 8 && hour < 10) slot = '08-10h';
      else if (hour >= 10 && hour < 12) slot = '10-12h';
      else if (hour >= 12 && hour < 14) slot = '12-14h';
      else if (hour >= 14 && hour < 16) slot = '14-16h';
      else if (hour >= 16 && hour < 18) slot = '16-18h';
      else if (hour >= 18 && hour < 20) slot = '18-20h';
      if (apt.no_show_at) byTimeSlot[slot].noShows++;
      else byTimeSlot[slot].cancellations++;
    });

    const patientCounts = {};
    cancelled.forEach(apt => {
      if (!apt.patient_id) return;
      if (!patientCounts[apt.patient_id]) {
        patientCounts[apt.patient_id] = { name: apt.patient_name || 'Sem nome', count: 0 };
      }
      patientCounts[apt.patient_id].count++;
    });

    const frequentOffenders = Object.entries(patientCounts)
      .filter(([, data]) => data.count >= 2)
      .map(([patientId, data]) => ({
        patientId,
        patientName: data.name,
        occurrences: data.count
      }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 10);

    return res.status(200).json({
      totalNoShows: noShows.length,
      noShowsDetectedNotMarked,
      totalCancellations: otherCancellations.length,
      totalCancelled: cancelled.length,
      cancelledByPatient,
      cancelledByOperator,
      cancelledBySystem,
      cancelledViaReminder,
      byDayOfWeek,
      byTimeSlot,
      frequentOffenders
    });
  } catch (err) {
    console.error('❌ [get-no-show-analytics]', err);
    return res.status(500).json({ error: err.message || 'Erro interno.' });
  }
}

module.exports = getNoShowAnalyticsHandler;
