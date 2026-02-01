/**
 * F10 - No-Show Analytics Service
 * Análise avançada de faltas e cancelamentos
 */

import { supabase } from '../lib/supabase';
import { NoShowAnalytics } from '../types';

/**
 * Busca analytics de no-shows para um período
 */
export async function getNoShowAnalytics(
  userId: string,
  fromDate: Date,
  toDate: Date
): Promise<NoShowAnalytics> {
  try {
    // Buscar todos os agendamentos cancelados no período
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('id, patient_id, patient_name, start_time, cancelled_at, cancelled_by, cancelled_via_reminder, no_show_at, cancellation_reason')
      .eq('user_id', userId)
      .eq('status', 'cancelled')
      .gte('start_time', fromDate.toISOString())
      .lte('start_time', toDate.toISOString());

    if (error) {
      console.error('❌ [NoShowAnalytics] Erro ao buscar appointments:', error);
      throw error;
    }

    const cancelled = appointments || [];
    
    // Separar no-shows de outros cancelamentos
    const noShows = cancelled.filter(a => a.no_show_at);
    const otherCancellations = cancelled.filter(a => !a.no_show_at);

    // Por origem
    const cancelledByPatient = otherCancellations.filter(a => a.cancelled_by === 'patient').length;
    const cancelledByOperator = otherCancellations.filter(a => a.cancelled_by === 'operator').length;
    const cancelledBySystem = otherCancellations.filter(a => a.cancelled_by === 'system' && !a.no_show_at).length;

    // Por dia da semana
    const byDayOfWeek: { [key: string]: { noShows: number; cancellations: number } } = {};
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    
    cancelled.forEach(apt => {
      const day = new Date(apt.start_time).getDay();
      const dayName = dayNames[day];
      
      if (!byDayOfWeek[dayName]) {
        byDayOfWeek[dayName] = { noShows: 0, cancellations: 0 };
      }
      
      if (apt.no_show_at) {
        byDayOfWeek[dayName].noShows++;
      } else {
        byDayOfWeek[dayName].cancellations++;
      }
    });

    // Por horário (faixas de 2h)
    const byTimeSlot: { [key: string]: { noShows: number; cancellations: number } } = {};
    const timeSlots = [
      '06-08h', '08-10h', '10-12h', '12-14h', 
      '14-16h', '16-18h', '18-20h', '20-22h'
    ];
    
    timeSlots.forEach(slot => {
      byTimeSlot[slot] = { noShows: 0, cancellations: 0 };
    });
    
    cancelled.forEach(apt => {
      const hour = new Date(apt.start_time).getHours();
      let slot = '20-22h'; // default
      
      if (hour >= 6 && hour < 8) slot = '06-08h';
      else if (hour >= 8 && hour < 10) slot = '08-10h';
      else if (hour >= 10 && hour < 12) slot = '10-12h';
      else if (hour >= 12 && hour < 14) slot = '12-14h';
      else if (hour >= 14 && hour < 16) slot = '14-16h';
      else if (hour >= 16 && hour < 18) slot = '16-18h';
      else if (hour >= 18 && hour < 20) slot = '18-20h';
      
      if (apt.no_show_at) {
        byTimeSlot[slot].noShows++;
      } else {
        byTimeSlot[slot].cancellations++;
      }
    });

    // Pacientes reincidentes (2+ faltas ou cancelamentos)
    const patientCounts: { [key: string]: { name: string; count: number } } = {};
    
    cancelled.forEach(apt => {
      if (!apt.patient_id) return;
      
      if (!patientCounts[apt.patient_id]) {
        patientCounts[apt.patient_id] = { name: apt.patient_name || 'Sem nome', count: 0 };
      }
      
      patientCounts[apt.patient_id].count++;
    });

    const frequentOffenders = Object.entries(patientCounts)
      .filter(([_, data]) => data.count >= 2)
      .map(([patientId, data]) => ({
        patientId,
        patientName: data.name,
        occurrences: data.count
      }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 10); // Top 10

    return {
      totalNoShows: noShows.length,
      totalCancellations: otherCancellations.length,
      totalCancelled: cancelled.length,
      cancelledByPatient,
      cancelledByOperator,
      cancelledBySystem,
      cancelledViaReminder: otherCancellations.filter(a => a.cancelled_via_reminder).length,
      byDayOfWeek,
      byTimeSlot,
      frequentOffenders
    };
  } catch (error: any) {
    console.error('❌ [NoShowAnalytics] Erro:', error);
    throw error;
  }
}
