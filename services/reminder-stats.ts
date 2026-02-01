/**
 * F7 - Reminder Statistics Service
 * Calcula estatísticas detalhadas sobre lembretes enviados
 */

import { supabase } from '../lib/supabase';
import { ReminderStats } from '../types';

/**
 * Busca estatísticas de lembretes para um período
 */
export async function getReminderStats(
  userId: string,
  fromDate: Date,
  toDate: Date
): Promise<ReminderStats> {
  try {
    // Buscar todos os agendamentos do período com reminder_sent_at preenchido
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('id, reminder_sent_at, confirmed_at, cancelled_at, cancelled_via_reminder, status, start_time')
      .eq('user_id', userId)
      .not('reminder_sent_at', 'is', null)
      .gte('start_time', fromDate.toISOString())
      .lte('start_time', toDate.toISOString());

    if (error) {
      console.error('❌ [ReminderStats] Erro ao buscar appointments:', error);
      throw error;
    }

    const reminders = appointments || [];
    const totalSent = reminders.length;

    if (totalSent === 0) {
      return {
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
      };
    }

    // Calcular métricas
    const responded = reminders.filter(r => r.confirmed_at || r.cancelled_at);
    const confirmed = reminders.filter(r => r.confirmed_at);
    const cancelled = reminders.filter(r => r.cancelled_at);
    const cancelledViaReminder = reminders.filter(r => r.cancelled_via_reminder);
    const noResponse = reminders.filter(r => !r.confirmed_at && !r.cancelled_at);

    // Taxa de resposta e confirmação
    const responseRate = (responded.length / totalSent) * 100;
    const confirmationRate = (confirmed.length / totalSent) * 100;
    const cancellationRate = (cancelled.length / totalSent) * 100;

    // Tempo médio de resposta (em minutos)
    const responseTimes = responded
      .filter(r => r.reminder_sent_at && (r.confirmed_at || r.cancelled_at))
      .map(r => {
        const sent = new Date(r.reminder_sent_at!);
        const responded = new Date(r.confirmed_at || r.cancelled_at!);
        return (responded.getTime() - sent.getTime()) / (1000 * 60); // minutos
      });

    const averageResponseTimeMinutes = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    // Por dia da semana (0 = domingo, 6 = sábado)
    const byDayOfWeek: { [key: string]: { sent: number; confirmed: number; cancelled: number } } = {};
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    
    reminders.forEach(r => {
      const day = new Date(r.start_time).getDay();
      const dayName = dayNames[day];
      
      if (!byDayOfWeek[dayName]) {
        byDayOfWeek[dayName] = { sent: 0, confirmed: 0, cancelled: 0 };
      }
      
      byDayOfWeek[dayName].sent++;
      if (r.confirmed_at) byDayOfWeek[dayName].confirmed++;
      if (r.cancelled_at) byDayOfWeek[dayName].cancelled++;
    });

    // Por horário (agrupado em faixas)
    const byHour: { [key: string]: { sent: number; confirmed: number; cancelled: number } } = {};
    
    reminders.forEach(r => {
      const hour = new Date(r.start_time).getHours();
      const hourRange = `${hour.toString().padStart(2, '0')}:00`;
      
      if (!byHour[hourRange]) {
        byHour[hourRange] = { sent: 0, confirmed: 0, cancelled: 0 };
      }
      
      byHour[hourRange].sent++;
      if (r.confirmed_at) byHour[hourRange].confirmed++;
      if (r.cancelled_at) byHour[hourRange].cancelled++;
    });

    return {
      totalSent,
      totalResponded: responded.length,
      totalConfirmed: confirmed.length,
      totalCancelled: cancelled.length,
      totalCancelledViaReminder: cancelledViaReminder.length,
      totalNoResponse: noResponse.length,
      responseRate: Math.round(responseRate * 10) / 10,
      confirmationRate: Math.round(confirmationRate * 10) / 10,
      cancellationRate: Math.round(cancellationRate * 10) / 10,
      averageResponseTimeMinutes: Math.round(averageResponseTimeMinutes),
      byDayOfWeek,
      byHour
    };
  } catch (error: any) {
    console.error('❌ [ReminderStats] Erro:', error);
    throw error;
  }
}
