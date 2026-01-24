
import { supabase } from '../lib/supabase';
import { Appointment, DoctorProfile, Patient, User } from '../types';
import { MOCK_APPOINTMENTS, MOCK_PATIENTS } from '../constants';

// --- Auth Helpers ---

export const apiAuth = {
  async signIn(email: string, password: string) {
    return await supabase.auth.signInWithPassword({ email, password });
  },

  async signUp(email: string, password: string, name: string, clinicName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, clinic_name: clinicName } // Metadados iniciais
      }
    });

    if (error) return { data, error };

    // Como configuramos um Trigger no banco de dados, o perfil já deve ter sido criado.
    // Usamos 'upsert' aqui apenas para garantir que o nome e clinica estejam atualizados
    // caso o trigger tenha falhado ou para reforçar os dados, sem causar erro de duplicidade.
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ 
          id: data.user.id, 
          name, 
          clinic_name: clinicName,
          email 
        }, { onConflict: 'id' });
      
      if (profileError) {
          console.error('Warning syncing profile:', profileError);
      }
    }

    return { data, error };
  },

  async signOut() {
    return await supabase.auth.signOut();
  },

  async getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    // Buscar dados extras do perfil
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    return {
      id: session.user.id,
      email: session.user.email!,
      name: profile?.name || session.user.user_metadata?.name || 'Usuário',
      clinicName: profile?.clinic_name || session.user.user_metadata?.clinic_name || 'Minha Clínica'
    } as User;
  },

  async updateProfile(userId: string, name: string, clinicName: string) {
    // Atualizar perfil na tabela profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ 
        id: userId, 
        name, 
        clinic_name: clinicName
      }, { onConflict: 'id' });

    if (profileError) {
      console.error('Error updating profile:', profileError);
      return { error: profileError };
    }

    // Atualizar metadata do usuário no auth (opcional, para sincronização)
    const { error: authError } = await supabase.auth.updateUser({
      data: { name, clinic_name: clinicName }
    });

    if (authError) {
      console.error('Warning updating auth metadata:', authError);
      // Não retornar erro aqui, pois o perfil já foi atualizado
    }

    return { error: null };
  }
};

// --- Data Service (CRUD) ---

export const apiData = {
  
  // -- Appointments --
  async getAppointments(userId: string, isDemo: boolean): Promise<Appointment[]> {
    if (isDemo) return MOCK_APPOINTMENTS;

    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching appointments:', error);
      return [];
    }

    if (!data) return [];

    // Converter snake_case do DB para camelCase do TS e Dates
    return data.map((apt: any) => ({
      ...apt,
      patientId: apt.patient_id,
      patientName: apt.patient_name,
      doctorId: apt.doctor_id,
      start: new Date(apt.start_time),
      end: new Date(apt.end_time),
      confirmedAt: apt.confirmed_at || null,
      cancelledAt: apt.cancelled_at || null,
    }));
  },

  async saveAppointment(apt: any, userId: string, isDemo: boolean): Promise<Appointment | null> {
    // Check if ID is a valid UUID (length 36) to decide Insert vs Update
    const isNew = !apt.id || String(apt.id).length < 30; 

    if (isDemo) {
      return { ...apt, id: isNew ? Math.random().toString(36).substr(2, 9) : apt.id } as Appointment;
    }

    // VALIDAÇÃO 1: Verificar bloqueios de agenda (para novo E edição)
    const blocks = await apiAgendaBlocks.getBlocks(userId);
    const isBlocked = checkIfDateIsBlocked(blocks, apt.start, apt.doctorId);
    if (isBlocked.blocked) {
      console.error('❌ Tentativa de agendar em dia bloqueado:', isBlocked.message);
      console.error('❌ LANÇANDO ERRO DE BLOQUEIO PARA APP.TSX');
      const error = new Error(isBlocked.message || 'Esta data não está disponível para agendamento.');
      console.error('❌ Erro criado:', error.message);
      throw error;
    }

    // VALIDAÇÃO 2: Verificar conflito de horário (para novo E edição)
    // Ao editar, excluir o próprio appointment da verificação
    const appointmentIdToExclude = isNew ? null : apt.id;
    const hasConflict = await checkTimeConflict(apt.start, apt.end, apt.doctorId, userId, appointmentIdToExclude);
    if (hasConflict) {
      console.error('❌ Conflito de horário detectado');
      console.error('❌ LANÇANDO ERRO DE CONFLITO PARA APP.TSX');
      const error = new Error('Já existe um agendamento neste horário para este profissional.');
      console.error('❌ Erro criado:', error.message);
      throw error;
    }

    const payload = {
      user_id: userId,
      patient_id: apt.patientId,
      patient_name: apt.patientName,
      doctor_id: apt.doctorId,
      title: apt.title,
      start_time: apt.start.toISOString(),
      end_time: apt.end.toISOString(),
      status: apt.status,
      notes: apt.notes,
      source: apt.source,
      tags: apt.tags
    };

    let result;
    try {
        if (isNew) {
          // Remove ID from payload on insert to let DB generate UUID
          const { data, error } = await supabase.from('appointments').insert([payload]).select().single();
          if (error) throw error;
          result = data;
        } else {
          const { data, error } = await supabase.from('appointments').update(payload).eq('id', apt.id).select().single();
          if (error) throw error;
          result = data;
        }
    } catch (e: any) {
        console.error("Erro ao salvar agendamento:", e);
        // Se for um erro de validação (bloqueio/conflito), re-lançar para o App.tsx capturar
        if (e.message && (e.message.includes('bloqueado') || e.message.includes('conflito') || e.message.includes('horário') || e.message.includes('disponível'))) {
          throw e;
        }
        // Outros erros do banco (Supabase), retornar null
        return null;
    }

    return {
      ...result,
      patientId: result.patient_id,
      patientName: result.patient_name,
      doctorId: result.doctor_id,
      start: new Date(result.start_time),
      end: new Date(result.end_time),
    };
  },

  async updateAppointmentStatus(id: string, status: string, isDemo: boolean) {
    if (isDemo) return;
    await supabase.from('appointments').update({ status }).eq('id', id);
  },

  // -- Patients --
  async getPatients(userId: string, isDemo: boolean): Promise<Patient[]> {
    if (isDemo) return MOCK_PATIENTS;

    const { data, error } = await supabase.from('patients').select('*').eq('user_id', userId);
    if (error) {
        console.error("Error fetching patients", error);
        return [];
    }
    return (data || []) as Patient[];
  },

  async savePatient(patient: Patient, userId: string, isDemo: boolean): Promise<Patient> {
    if (isDemo) return { ...patient, id: patient.id || `p-${Date.now()}` };

    const payload = {
      user_id: userId,
      name: patient.name,
      phone: patient.phone,
      email: patient.email,
      history: patient.history
    };

    // Check valid UUID length for update vs insert
    const isNew = !patient.id || String(patient.id).length < 30;

    if (!isNew) {
       // Update
       const { data, error } = await supabase.from('patients').update(payload).eq('id', patient.id).select().single();
       if (error) throw error;
       return data;
    } else {
       // Insert
       const { data, error } = await supabase.from('patients').insert([payload]).select().single();
       if (error) throw error;
       return data;
    }
  },

  async deletePatient(id: string, isDemo: boolean) {
    if (isDemo) return;
    await supabase.from('patients').delete().eq('id', id);
  },

  // -- Doctors --
  async getDoctors(userId: string, isDemo: boolean): Promise<DoctorProfile[]> {
    if (isDemo) {
        return [{ id: 'doc-1', name: 'Dr. Usuário Demo', specialty: 'Especialista', color: '#ec4899', active: true }];
    }

    const { data, error } = await supabase.from('doctors').select('*').eq('user_id', userId);
    if (error || !data || data.length === 0) {
        return [];
    }
    return data as DoctorProfile[];
  },

  async saveDoctor(doctor: any, userId: string, isDemo: boolean): Promise<DoctorProfile> {
      if (isDemo) return { ...doctor, id: `doc-${Date.now()}` };
      
      const payload = {
          user_id: userId,
          name: doctor.name,
          specialty: doctor.specialty,
          color: doctor.color,
          active: doctor.active
      };

      // Se tem ID, fazer UPDATE; senão fazer INSERT
      if (doctor.id) {
          const { data, error } = await supabase
              .from('doctors')
              .update(payload)
              .eq('id', doctor.id)
              .eq('user_id', userId) // Segurança: só atualiza se for do usuário
              .select()
              .single();
          if(error) throw error;
          return data;
      } else {
          const { data, error } = await supabase
              .from('doctors')
              .insert([payload])
              .select()
              .single();
          if(error) throw error;
          return data;
      }
  },
  
  async deleteDoctor(id: string, isDemo: boolean) {
      if(isDemo) return;
      await supabase.from('doctors').delete().eq('id', id);
  }
};

// --- Agenda Blocks (bloqueio de dias: fins de semana, feriados, períodos) ---

export type AgendaBlockType = 'weekdays' | 'specific_date' | 'date_range';

export interface AgendaBlock {
  id: string;
  user_id: string;
  doctor_id: string | null; // NULL = clínica inteira, NOT NULL = profissional específico
  block_type: AgendaBlockType;
  weekdays: number[] | null;
  specific_date: string | null;
  start_date: string | null;
  end_date: string | null;
  label: string | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export const apiAgendaBlocks = {
  async getBlocks(userId: string): Promise<AgendaBlock[]> {
    const { data, error } = await supabase
      .from('agenda_blocks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching agenda_blocks:', error);
      return [];
    }
    return (data || []) as AgendaBlock[];
  },

  async insert(userId: string, block: { 
    block_type: AgendaBlockType; 
    doctor_id?: string | null; // Novo: null ou undefined = clínica inteira
    weekdays?: number[]; 
    specific_date?: string; 
    start_date?: string; 
    end_date?: string; 
    label?: string | null 
  }): Promise<AgendaBlock | null> {
    const payload: Record<string, unknown> = {
      user_id: userId,
      block_type: block.block_type,
      doctor_id: block.doctor_id || null, // null = clínica inteira
      label: block.label || null,
      active: true,
    };
    if (block.block_type === 'weekdays' && Array.isArray(block.weekdays)) payload.weekdays = block.weekdays;
    if (block.block_type === 'specific_date' && block.specific_date) payload.specific_date = block.specific_date;
    if (block.block_type === 'date_range' && block.start_date && block.end_date) {
      payload.start_date = block.start_date;
      payload.end_date = block.end_date;
    }
    const { data, error } = await supabase.from('agenda_blocks').insert([payload]).select().single();
    if (error) {
      console.error('Error inserting agenda_block:', error);
      return null;
    }
    return data as AgendaBlock;
  },

  async update(id: string, patch: { active?: boolean; label?: string | null }): Promise<boolean> {
    const { error } = await supabase.from('agenda_blocks').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      console.error('Error updating agenda_block:', error);
      return false;
    }
    return true;
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase.from('agenda_blocks').delete().eq('id', id);
    if (error) {
      console.error('Error deleting agenda_block:', error);
      return false;
    }
    return true;
  },
};

// Função auxiliar para verificar se uma data está bloqueada
// Considera bloqueios de clínica inteira (doctor_id = null) e do profissional específico
function checkIfDateIsBlocked(blocks: AgendaBlock[], date: Date, doctorId: string | null): { blocked: boolean; message?: string } {
  if (!blocks || !Array.isArray(blocks)) return { blocked: false };

  const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;
  const weekday = date.getDay();

  // Filtrar bloqueios relevantes:
  // 1. Clínica inteira (doctor_id = null)
  // 2. Profissional específico (doctor_id = doctorId)
  const relevantBlocks = blocks.filter(b => 
    b.active && (b.doctor_id === null || b.doctor_id === doctorId)
  );

  for (const b of relevantBlocks) {
    if (b.block_type === 'weekdays' && Array.isArray(b.weekdays) && b.weekdays.includes(weekday)) {
      const prefix = b.doctor_id ? 'Este profissional não atende' : 'Não atendemos';
      return { 
        blocked: true, 
        message: (b.label && b.label.trim()) || `${prefix} às ${DAY_NAMES[weekday]}s.` 
      };
    }
    if (b.block_type === 'specific_date' && b.specific_date === dateStr) {
      const prefix = b.doctor_id ? 'Este profissional está indisponível' : 'A clínica está fechada';
      return { 
        blocked: true, 
        message: (b.label && b.label.trim()) || `${prefix} neste dia.` 
      };
    }
    if (b.block_type === 'date_range' && b.start_date && b.end_date && dateStr >= b.start_date && dateStr <= b.end_date) {
      const prefix = b.doctor_id ? 'Este profissional está indisponível' : 'A clínica está fechada';
      return { 
        blocked: true, 
        message: (b.label && b.label.trim()) || `${prefix} neste período.` 
      };
    }
  }

  return { blocked: false };
}

// Função auxiliar para verificar conflito de horário
async function checkTimeConflict(
  startTime: Date, 
  endTime: Date, 
  doctorId: string | null, 
  userId: string,
  excludeAppointmentId?: string | null // NOVO: ID do appointment a excluir da busca (ao editar)
): Promise<boolean> {
  try {
    let query = supabase
      .from('appointments')
      .select('id')
      .eq('user_id', userId)
      .neq('status', 'cancelled');

    // Se tem doctorId, verificar apenas para este profissional
    if (doctorId) {
      query = query.eq('doctor_id', doctorId);
    }

    // NOVO: Ao editar, excluir o próprio appointment da verificação
    if (excludeAppointmentId) {
      query = query.neq('id', excludeAppointmentId);
      console.log(`🔍 [checkTimeConflict] Excluindo appointment ${excludeAppointmentId} da busca (edição)`);
    }

    // Verificar sobreposição de horários
    // Um agendamento conflita se:
    // - Começa antes do fim do novo agendamento E
    // - Termina depois do início do novo agendamento
    const { data, error } = await query
      .or(`and(start_time.lt.${endTime.toISOString()},end_time.gt.${startTime.toISOString()})`);

    if (error) {
      console.error('❌ Erro ao verificar conflito de horário:', error);
      return false; // Fail-open: em caso de erro, permitir agendamento
    }

    const hasConflict = data && data.length > 0;
    if (hasConflict) {
      console.log(`⚠️ [checkTimeConflict] Conflito encontrado: ${data.length} agendamento(s)`);
    }

    return hasConflict; // true = tem conflito
  } catch (e) {
    console.error('❌ Exceção ao verificar conflito:', e);
    return false; // Fail-open
  }
}
