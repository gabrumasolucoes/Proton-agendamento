
export interface User {
  id: string;
  name: string;
  email: string;
  clinicName?: string;
  role?: 'admin' | 'user';
  isAdmin?: boolean;
  allUsers?: any[]; // Para admin master
  /** Token de sessão admin (apenas quando logado como admin master via /api/auth-admin) */
  adminToken?: string;
  
  // Configurações de lembretes (F2 - Fase 2)
  reminderEnabled?: boolean;
  reminderDaysBefore?: number;
  reminderSendTime?: string;
  reminderTimezone?: string;
  maxRemindersPerDay?: number;
  noShowToleranceMinutes?: number;
  /** Template da mensagem de lembrete. Placeholders: [data], [horário], [profissional], [link], [endereço]. Vazio = mensagem padrão. */
  reminderMessageTemplate?: string | null;
  /** Endereço exibido no lembrete (substitui [endereço]). */
  reminderAddress?: string | null;
}

export interface Patient {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  history?: string; // Mock historical data
}

export type AppointmentStatus = 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'in_progress';

export type CalendarViewMode = 'day' | 'week' | 'month';

export interface ProcedureTag {
  id: string;
  label: string;
  colorClass: string; // Tailwind classes string
}

export interface DoctorProfile {
  id: string;
  name: string;
  specialty: string;
  color: string; // Hex or Tailwind color name
  active: boolean;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string; // Denormalized for easier UI
  doctorId: string; // Linked to DoctorProfile
  title: string; // e.g., "Avaliação - Lente de Contato"
  start: Date;
  end: Date;
  status: AppointmentStatus;
  notes: string; // Notes from the Chatbot interaction
  source: 'chatbot' | 'manual';
  tags?: string[]; // Array of associated tags
  /** Data/hora em que o cliente confirmou pelo link de confirmação (ISO) */
  confirmedAt?: string | null;
  /** Data/hora em que o cliente cancelou pelo link (ISO). Null se não cancelado pelo cliente. */
  cancelledAt?: string | null;
  
  // Campos de cancelamento e reagendamento (F5 - Fase 5)
  cancellationReason?: string | null;
  cancelledBy?: 'patient' | 'operator' | 'system' | null;
  cancelledViaReminder?: boolean;
  noShowAt?: string | null;
  rescheduledToAppointmentId?: string | null;
  rescheduledNotes?: string | null;
}

export interface AiAnalysisResult {
  summary: string;
  preparation: string[];
  isMock?: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'alert' | 'error';
}

// Horário de atendimento por dia (business_hours). day_of_week: 0=domingo .. 6=sábado
export interface BusinessHoursRow {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  lunch_start: string | null;
  lunch_end: string | null;
  active: boolean;
}

// Configurações de lembretes (F2)
export interface ReminderSettings {
  enabled: boolean;
  daysBefore: number;
  sendTime: string;
  timezone: string;
  maxPerDay: number;
  noShowToleranceMinutes: number;
  /** Template da mensagem. Placeholders: [data], [horário], [profissional], [link], [endereço]. Vazio = padrão. */
  reminderMessageTemplate?: string | null;
  /** Endereço no lembrete (substitui [endereço]). */
  reminderAddress?: string | null;
}

// Estatísticas de lembretes (F7)
export interface ReminderStats {
  totalSent: number;
  confirmedViaReminder: number;
  cancelledViaReminder: number;
  responseRate: number;
  confirmationRate: number;
  cancellationRate: number;
  noResponseRate: number;
  avgResponseTimeMinutes: number;
  byWeekday?: Record<string, { sent: number; confirmed: number; cancelled: number }>;
  byHour?: Record<string, { sent: number; responseRate: number }>;
}

// Analytics de no-show (F10)
export interface NoShowAnalytics {
  totalNoShows: number;
  /** Faltas detectadas no relatório (confirmed/pending, horário passou + tolerância) ainda não marcadas no banco (Opção A – on-demand) */
  noShowsDetectedNotMarked?: number;
  totalCancellations: number;
  /** Total de cancelados no período (no-shows + outros) */
  totalCancelled: number;
  cancelledByPatient: number;
  cancelledByOperator: number;
  cancelledBySystem?: number;
  cancelledViaReminder: number;
  byDayOfWeek: Record<string, { noShows: number; cancellations: number }>;
  byTimeSlot?: Record<string, { noShows: number; cancellations: number }>;
  frequentOffenders: Array<{ patientId: string; patientName: string; occurrences: number }>;
  noShowRate?: number;
  patterns?: {
    highRiskTimeSlots: Array<{ hour: number; noShowRate: number }>;
    highRiskWeekdays: Array<{ weekday: string; noShowRate: number }>;
    repeatOffenders: Array<{ patientName: string; noShowCount: number; lastNoShow: string }>;
  };
  estimatedLoss?: {
    totalHoursLost: number;
    estimatedRevenueLoss?: number;
  };
}
