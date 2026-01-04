
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
    }));
  },

  async saveAppointment(apt: any, userId: string, isDemo: boolean): Promise<Appointment | null> {
    // Check if ID is a valid UUID (length 36) to decide Insert vs Update
    const isNew = !apt.id || String(apt.id).length < 30; 

    if (isDemo) {
      return { ...apt, id: isNew ? Math.random().toString(36).substr(2, 9) : apt.id } as Appointment;
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
    } catch (e) {
        console.error("Erro ao salvar agendamento:", e);
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

      const { data, error } = await supabase.from('doctors').insert([payload]).select().single();
      if(error) throw error;
      return data;
  },
  
  async deleteDoctor(id: string, isDemo: boolean) {
      if(isDemo) return;
      await supabase.from('doctors').delete().eq('id', id);
  }
};
