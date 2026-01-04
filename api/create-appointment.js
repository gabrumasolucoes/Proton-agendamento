/**
 * API Endpoint: POST /api/create-appointment
 * 
 * Cria um novo agendamento no sistema Proton.
 * Este endpoint é chamado pelo SDR quando a IA agenda uma consulta via WhatsApp.
 * 
 * Body esperado:
 * {
 *   "patientName": "João Silva",
 *   "patientPhone": "5511999999999",
 *   "dateTime": "2026-01-10T14:00:00",
 *   "duration": 30,
 *   "procedureType": "Consulta - Avaliação",
 *   "doctorName": "Dr. João" (opcional),
 *   "notes": "Agendado via WhatsApp" (opcional)
 * }
 */

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxxasmvsfxbbauepeiyn.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4eGFzbXZzZnhiYmF1ZXBlaXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NjUxMDEsImV4cCI6MjA4MTQ0MTEwMX0.0kf2DF0qpC74J4vonTywDwHoPhdegzqjkMU1P_MvefY';

// Token de autenticação para a API (segurança)
const API_SECRET_TOKEN = process.env.API_SECRET_TOKEN || 'proton-sdr-integration-secret-2026';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function createAppointmentHandler(req, res) {
    // Verificar método
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Use POST.' });
    }

    // Verificar autenticação
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
    }

    const token = authHeader.split(' ')[1];
    if (token !== API_SECRET_TOKEN) {
        return res.status(403).json({ error: 'Token de autenticação inválido.' });
    }

    try {
        const {
            patientName,
            patientPhone,
            dateTime,
            duration = 30,
            procedureType,
            doctorName,
            notes = 'Agendado via WhatsApp'
        } = req.body;

        // Validações
        if (!patientName || !patientPhone || !dateTime || !procedureType) {
            return res.status(400).json({
                error: 'Campos obrigatórios: patientName, patientPhone, dateTime, procedureType'
            });
        }

        // Converter data
        const startDate = new Date(dateTime);
        if (isNaN(startDate.getTime())) {
            return res.status(400).json({ error: 'Data inválida. Use formato ISO: 2026-01-10T14:00:00' });
        }

        const endDate = new Date(startDate.getTime() + duration * 60000);

        // 1. Buscar ou criar paciente
        let patient = await findOrCreatePatient(patientName, patientPhone);

        // 2. Buscar médico (usar primeiro disponível se não especificado)
        let doctor = await findDoctor(doctorName);

        // 3. Verificar disponibilidade
        const isAvailable = await checkAvailability(startDate, endDate, doctor?.id);
        if (!isAvailable) {
            return res.status(409).json({
                error: 'Horário não disponível',
                message: 'Já existe um agendamento neste horário. Tente outro horário.',
                suggestion: await getNextAvailableSlot(startDate, doctor?.id)
            });
        }

        // 4. Criar agendamento
        const appointmentData = {
            patient_id: patient.id,
            patient_name: patientName,
            doctor_id: doctor?.id || null,
            title: procedureType,
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            status: 'pending',
            notes: notes,
            source: 'chatbot',
            tags: ['whatsapp', 'sdr']
        };

        const { data: appointment, error } = await supabase
            .from('appointments')
            .insert([appointmentData])
            .select()
            .single();

        if (error) {
            console.error('Erro ao criar agendamento:', error);
            return res.status(500).json({ error: 'Erro ao criar agendamento', details: error.message });
        }

        // 5. Retornar sucesso com detalhes
        return res.status(201).json({
            success: true,
            message: 'Agendamento criado com sucesso!',
            appointment: {
                id: appointment.id,
                patientName: patientName,
                doctorName: doctor?.name || 'A definir',
                date: startDate.toLocaleDateString('pt-BR'),
                time: startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                procedure: procedureType,
                status: 'pending'
            },
            confirmationMessage: `✅ Agendamento confirmado!\n\n📅 Data: ${startDate.toLocaleDateString('pt-BR')}\n⏰ Horário: ${startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n👨‍⚕️ Médico: ${doctor?.name || 'A definir'}\n📋 Procedimento: ${procedureType}\n\nAguardamos você!`
        });

    } catch (error) {
        console.error('Erro na API create-appointment:', error);
        return res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
}

// Funções auxiliares

async function findOrCreatePatient(name, phone) {
    // Buscar paciente existente pelo telefone
    const { data: existing } = await supabase
        .from('patients')
        .select('*')
        .eq('phone', phone)
        .single();

    if (existing) {
        return existing;
    }

    // Criar novo paciente
    const { data: newPatient, error } = await supabase
        .from('patients')
        .insert([{ name, phone }])
        .select()
        .single();

    if (error) {
        console.error('Erro ao criar paciente:', error);
        // Retornar objeto mínimo para não bloquear
        return { id: null, name, phone };
    }

    return newPatient;
}

async function findDoctor(doctorName) {
    if (doctorName) {
        const { data } = await supabase
            .from('doctors')
            .select('*')
            .ilike('name', `%${doctorName}%`)
            .eq('active', true)
            .single();
        
        if (data) return data;
    }

    // Retornar primeiro médico ativo se não especificado
    const { data: doctors } = await supabase
        .from('doctors')
        .select('*')
        .eq('active', true)
        .limit(1);

    return doctors?.[0] || null;
}

async function checkAvailability(startDate, endDate, doctorId) {
    const query = supabase
        .from('appointments')
        .select('id')
        .neq('status', 'cancelled')
        .or(`and(start_time.lte.${endDate.toISOString()},end_time.gte.${startDate.toISOString()})`);

    if (doctorId) {
        query.eq('doctor_id', doctorId);
    }

    const { data } = await query;
    return !data || data.length === 0;
}

async function getNextAvailableSlot(baseDate, doctorId) {
    // Sugerir próximo horário (30 min depois)
    const nextSlot = new Date(baseDate.getTime() + 30 * 60000);
    return {
        date: nextSlot.toLocaleDateString('pt-BR'),
        time: nextSlot.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
}

module.exports = createAppointmentHandler;
