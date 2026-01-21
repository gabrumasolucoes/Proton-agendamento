
export interface User {
  id: string;
  name: string;
  email: string;
  clinicName?: string;
  role?: 'admin' | 'user';
  isAdmin?: boolean;
  allUsers?: any[]; // Para admin master
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
  type: 'info' | 'success' | 'warning' | 'alert';
}
