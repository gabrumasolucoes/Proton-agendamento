
import { Appointment, ProcedureTag, Patient, AppNotification } from './types';
import { addDays, setHours, setMinutes, startOfWeek, subMinutes, subHours } from 'date-fns';

// Helper to create dates relative to "today" to ensure the demo always has data
const getRelativeDate = (dayOffset: number, hour: number, minute: number): Date => {
  const today = new Date();
  const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 0 }); // Sunday
  const targetDay = addDays(startOfCurrentWeek, dayOffset);
  return setMinutes(setHours(targetDay, hour), minute);
};

const DEFAULT_DOCTOR_ID = 'doc-1';

export const MOCK_NOTIFICATIONS: AppNotification[] = [
    { id: '1', title: 'Agendamento Confirmado', message: 'Ana Silva confirmou para Seg, 09:00.', time: 'Há 5 min', read: false, type: 'success' },
    { id: '2', title: 'Novo Lead via WhatsApp', message: 'Mariana Oliveira solicitou contato.', time: 'Há 30 min', read: false, type: 'info' },
    { id: '3', title: 'Atenção Necessária', message: 'Ricardo Santos relatou problema pós-op.', time: 'Há 1 hora', read: false, type: 'alert' },
    { id: '4', title: 'Lembrete de Sistema', message: 'Backup realizado com sucesso.', time: 'Há 2 horas', read: true, type: 'info' }
];

export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: '1',
    patientId: 'p1',
    patientName: 'Ana Silva',
    doctorId: DEFAULT_DOCTOR_ID,
    title: 'Avaliação Capilar',
    start: getRelativeDate(1, 9, 0), // Monday 9:00
    end: getRelativeDate(1, 10, 0),
    status: 'confirmed',
    source: 'chatbot',
    notes: 'Cliente interessada em tratamento para queda. Perguntou sobre mesoterapia.',
    tags: ['Avaliação', 'Queda']
  },
  {
    id: '2',
    patientId: 'p2',
    patientName: 'Carlos Souza',
    doctorId: DEFAULT_DOCTOR_ID,
    title: 'Sessão Laser',
    start: getRelativeDate(1, 14, 0), // Monday 14:00
    end: getRelativeDate(1, 15, 0),
    status: 'pending',
    source: 'chatbot',
    notes: 'Reclamou de descamação no couro cabeludo. Chatbot sugeriu agendamento de análise.',
    tags: ['Laser']
  },
  {
    id: '3',
    patientId: 'p3',
    patientName: 'Fernanda Lima',
    doctorId: DEFAULT_DOCTOR_ID,
    title: 'Retorno MMP',
    start: getRelativeDate(2, 10, 30), // Tuesday 10:30
    end: getRelativeDate(2, 11, 30),
    status: 'confirmed',
    source: 'manual',
    notes: 'Retorno de 30 dias para avaliação do procedimento de microinfusão.',
    tags: ['Retorno', 'MMP']
  },
  {
    id: '4',
    patientId: 'p4',
    patientName: 'João Mendes',
    doctorId: DEFAULT_DOCTOR_ID,
    title: 'Consulta Tricologia',
    start: getRelativeDate(3, 16, 0), // Wednesday 16:00
    end: getRelativeDate(3, 17, 0),
    status: 'confirmed',
    source: 'chatbot',
    notes: 'Novo paciente vindo do Instagram. Quer fazer um checkup capilar completo.',
    tags: ['Avaliação']
  },
  {
    id: '5',
    patientId: 'p5',
    patientName: 'Marina Costa',
    doctorId: DEFAULT_DOCTOR_ID,
    title: 'Ledterapia',
    start: getRelativeDate(4, 11, 0), // Thursday 11:00
    end: getRelativeDate(4, 12, 30),
    status: 'pending',
    source: 'chatbot',
    notes: 'Dúvidas sobre quantidade de sessões necessárias.',
    tags: ['Ledterapia']
  },
  {
    id: '6',
    patientId: 'p6',
    patientName: 'Roberto Dias',
    doctorId: DEFAULT_DOCTOR_ID,
    title: 'Implante (Cirurgia)',
    start: getRelativeDate(5, 8, 0), // Friday 08:00
    end: getRelativeDate(5, 10, 0),
    status: 'confirmed',
    source: 'manual',
    notes: 'Cirurgia agendada. Exames de sangue OK.',
    tags: ['Cirurgia']
  }
];

export const MOCK_PATIENTS: Patient[] = [
  { id: 'p1', name: 'Ana Silva' },
  { id: 'p2', name: 'Carlos Souza' },
  { id: 'p3', name: 'Fernanda Lima' },
  { id: 'p4', name: 'João Mendes' },
  { id: 'p5', name: 'Marina Costa' },
  { id: 'p6', name: 'Roberto Dias' },
  { id: 'p7', name: 'Mariana Oliveira' },
  { id: 'p8', name: 'Ricardo Santos' },
  { id: 'p9', name: 'Patrícia Pereira' },
  { id: 'p10', name: 'Lucas Martins' },
];

export const HOURS_OF_OPERATION = {
  start: 7, // 7 AM
  end: 19,  // 7 PM
};

export const DEFAULT_TAGS: ProcedureTag[] = [
  { id: '1', label: "Avaliação", colorClass: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: '2', label: "MMP", colorClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { id: '3', label: "Laser", colorClass: "bg-purple-50 text-purple-700 border-purple-200" },
  { id: '4', label: "Intradermo", colorClass: "bg-pink-50 text-pink-700 border-pink-200" },
  { id: '5', label: "Cirurgia", colorClass: "bg-red-50 text-red-700 border-red-200" },
  { id: '6', label: "Retorno", colorClass: "bg-gray-50 text-gray-700 border-gray-200" },
];

export const TAG_COLORS = [
  { name: "Azul", class: "bg-blue-50 text-blue-700 border-blue-200" },
  { name: "Verde", class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { name: "Roxo", class: "bg-purple-50 text-purple-700 border-purple-200" },
  { name: "Rosa", class: "bg-pink-50 text-pink-700 border-pink-200" },
  { name: "Vermelho", class: "bg-red-50 text-red-700 border-red-200" },
  { name: "Laranja", class: "bg-orange-50 text-orange-700 border-orange-200" },
  { name: "Cinza", class: "bg-gray-50 text-gray-700 border-gray-200" },
  { name: "Ciano", class: "bg-cyan-50 text-cyan-700 border-cyan-200" },
];
