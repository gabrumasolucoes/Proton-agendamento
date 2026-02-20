
import React, { useState, useEffect } from 'react';
import { X, UserPlus, Trash2, User as UserIcon, Building2, Save, Calendar, CalendarOff, Bell, BellOff, Clock } from 'lucide-react';
import { DoctorProfile, User, BusinessHoursRow } from '../types';
import { apiAuth, apiAgendaBlocks, AgendaBlock, apiReminderSettings, apiBusinessHours } from '../services/api';

interface SettingsModalProps {
  onClose: () => void;
  doctors: DoctorProfile[];
  onAddDoctor: (doctor: Omit<DoctorProfile, 'id' | 'active'>) => void;
  onRemoveDoctor: (id: string) => void;
  onUpdateDoctor: (doctor: DoctorProfile) => void;
  onToggleDoctor: (id: string) => void;
  currentUser: User | null;
  onUserUpdate?: (user: User) => void;
}

const PRESET_COLORS = [
  { label: 'Azul', value: '#3b82f6' },
  { label: 'Verde', value: '#10b981' },
  { label: 'Roxo', value: '#8b5cf6' },
  { label: 'Rosa', value: '#ec4899' },
  { label: 'Laranja', value: '#f97316' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  onClose, 
  doctors, 
  onAddDoctor, 
  onRemoveDoctor,
  onUpdateDoctor,
  onToggleDoctor,
  currentUser,
  onUserUpdate
}) => {
  const [activeTab, setActiveTab] = useState<'doctors' | 'account' | 'agenda' | 'horarios' | 'reminders'>('doctors');
  const [newDocName, setNewDocName] = useState('');
  const [newDocRole, setNewDocRole] = useState('');
  const [newDocColor, setNewDocColor] = useState(PRESET_COLORS[0].value);
  
  // Estado para edição de profissionais
  const [editingDoctorId, setEditingDoctorId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSpecialty, setEditSpecialty] = useState('');

  // Account settings state
  const [userName, setUserName] = useState(currentUser?.name || '');
  const [userClinic, setUserClinic] = useState(currentUser?.clinicName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Agenda blocks state
  const [blocks, setBlocks] = useState<AgendaBlock[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState<string | 'all'>('all'); // 'all' = clínica inteira
  const [specificDate, setSpecificDate] = useState('');
  const [specificLabel, setSpecificLabel] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeLabel, setRangeLabel] = useState('');
  const [weekdayNum, setWeekdayNum] = useState<number>(6);
  const [weekdayLabel, setWeekdayLabel] = useState('');

  // Reminder settings state (F3 - Fase 3)
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderDaysBefore, setReminderDaysBefore] = useState(1);
  const [reminderSendTime, setReminderSendTime] = useState('08:00');
  const [reminderTimezone, setReminderTimezone] = useState('America/Sao_Paulo');
  const [maxRemindersPerDay, setMaxRemindersPerDay] = useState(50);
  const [noShowToleranceMinutes, setNoShowToleranceMinutes] = useState(30);
  const [reminderMessageTemplate, setReminderMessageTemplate] = useState('');
  const [reminderAddress, setReminderAddress] = useState('');
  const [isSavingReminders, setIsSavingReminders] = useState(false);
  const [reminderSaveMessage, setReminderSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Business hours (horário de atendimento por dia)
  const [businessHoursRows, setBusinessHoursRows] = useState<BusinessHoursRow[]>([]);
  const [businessHoursLoading, setBusinessHoursLoading] = useState(false);
  const [businessHoursSaving, setBusinessHoursSaving] = useState(false);
  const [businessHoursMessage, setBusinessHoursMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (currentUser) {
      setUserName(currentUser.name || '');
      setUserClinic(currentUser.clinicName || '');
      // Sincronizar reminder settings (F3)
      setReminderEnabled(currentUser.reminderEnabled ?? true);
      setReminderDaysBefore(currentUser.reminderDaysBefore ?? 1);
      setReminderSendTime(currentUser.reminderSendTime ?? '08:00');
      setReminderTimezone(currentUser.reminderTimezone ?? 'America/Sao_Paulo');
      setMaxRemindersPerDay(currentUser.maxRemindersPerDay ?? 50);
      setNoShowToleranceMinutes(currentUser.noShowToleranceMinutes ?? 30);
      setReminderMessageTemplate(currentUser.reminderMessageTemplate ?? '');
      setReminderAddress(currentUser.reminderAddress ?? '');
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === 'agenda' && currentUser?.id) {
      setBlocksLoading(true);
      apiAgendaBlocks.getBlocks(currentUser.id).then((b) => { setBlocks(b); setBlocksLoading(false); });
    }
  }, [activeTab, currentUser?.id]);

  useEffect(() => {
    if (activeTab === 'horarios' && currentUser?.id) {
      setBusinessHoursLoading(true);
      apiBusinessHours.getBusinessHours(currentUser.id).then((rows) => {
        const byDay: Record<number, BusinessHoursRow> = {};
        rows.forEach((r) => { byDay[r.day_of_week] = r; });
        const merged: BusinessHoursRow[] = [];
        for (let d = 0; d <= 6; d++) {
          merged.push(byDay[d] ?? {
            day_of_week: d,
            start_time: '08:00',
            end_time: '18:00',
            lunch_start: d >= 1 && d <= 5 ? '12:00' : null,
            lunch_end: d >= 1 && d <= 5 ? '13:00' : null,
            active: d >= 1 && d <= 5
          });
        }
        setBusinessHoursRows(merged);
        setBusinessHoursLoading(false);
      });
    }
  }, [activeTab, currentUser?.id]);

  const describeBlock = (b: AgendaBlock): string => {
    let desc = '';
    if (b.block_type === 'weekdays' && Array.isArray(b.weekdays) && b.weekdays.length > 0) {
      const names: Record<number, string> = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };
      const s = b.weekdays.map((w) => names[w] || '').filter(Boolean).join(', ');
      desc = s || 'Dias da semana';
    } else if (b.block_type === 'specific_date' && b.specific_date) {
      desc = b.specific_date;
    } else if (b.block_type === 'date_range' && b.start_date && b.end_date) {
      desc = `${b.start_date} a ${b.end_date}`;
    } else {
      desc = b.block_type;
    }
    
    // Adicionar indicação do profissional
    if (b.doctor_id) {
      const doctor = doctors.find(d => d.id === b.doctor_id);
      if (doctor) {
        desc += ` • 👤 ${doctor.name}`;
      }
    } else {
      desc += ` • 🏢 Empresa`;
    }
    
    return desc;
  };

  const hasWeekendBlock = (): boolean => blocks.some((b) => b.block_type === 'weekdays' && Array.isArray(b.weekdays) && b.weekdays.includes(0) && b.weekdays.includes(6));

  const handleBlockWeekend = async () => {
    if (!currentUser?.id || hasWeekendBlock()) return;
    const doctorId = selectedDoctorFilter === 'all' ? null : selectedDoctorFilter;
    const created = await apiAgendaBlocks.insert(currentUser.id, { 
      block_type: 'weekdays', 
      weekdays: [0, 6], 
      label: 'Fim de semana',
      doctor_id: doctorId
    });
    if (created) setBlocks((prev) => [created, ...prev]);
  };

  const handleAddSpecific = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id || !specificDate) return;
    const doctorId = selectedDoctorFilter === 'all' ? null : selectedDoctorFilter;
    const created = await apiAgendaBlocks.insert(currentUser.id, { 
      block_type: 'specific_date', 
      specific_date: specificDate, 
      label: specificLabel.trim() || null,
      doctor_id: doctorId
    });
    if (created) { setBlocks((prev) => [created, ...prev]); setSpecificDate(''); setSpecificLabel(''); }
  };

  const handleAddRange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id || !rangeStart || !rangeEnd) return;
    const doctorId = selectedDoctorFilter === 'all' ? null : selectedDoctorFilter;
    const created = await apiAgendaBlocks.insert(currentUser.id, { 
      block_type: 'date_range', 
      start_date: rangeStart, 
      end_date: rangeEnd, 
      label: rangeLabel.trim() || null,
      doctor_id: doctorId
    });
    if (created) { setBlocks((prev) => [created, ...prev]); setRangeStart(''); setRangeEnd(''); setRangeLabel(''); }
  };

  const handleAddWeekday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    const doctorId = selectedDoctorFilter === 'all' ? null : selectedDoctorFilter;
    const created = await apiAgendaBlocks.insert(currentUser.id, { 
      block_type: 'weekdays', 
      weekdays: [weekdayNum], 
      label: weekdayLabel.trim() || null,
      doctor_id: doctorId
    });
    if (created) { setBlocks((prev) => [created, ...prev]); setWeekdayLabel(''); }
  };

  const handleToggleBlock = async (id: string, active: boolean) => {
    if (!currentUser?.id) return;
    const ok = await apiAgendaBlocks.update(id, { active }, currentUser.id);
    if (ok) {
      setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, active } : b)));
      // Cache já é invalidado automaticamente em apiAgendaBlocks.update
    }
  };

  const handleDeleteBlock = async (id: string) => {
    if (!window.confirm('Remover este bloqueio?')) return;
    if (!currentUser?.id) return;
    const ok = await apiAgendaBlocks.delete(id, currentUser.id);
    if (ok) {
      setBlocks((prev) => prev.filter((b) => b.id !== id));
      // Cache já é invalidado automaticamente em apiAgendaBlocks.delete
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newDocName && newDocRole) {
      onAddDoctor({
        name: newDocName,
        specialty: newDocRole,
        color: newDocColor
      });
      setNewDocName('');
      setNewDocRole('');
      setNewDocColor(PRESET_COLORS[0].value);
    }
  };

  const handleStartEdit = (doctor: DoctorProfile) => {
    setEditingDoctorId(doctor.id);
    setEditName(doctor.name);
    setEditSpecialty(doctor.specialty);
  };

  const handleSaveEdit = () => {
    if (!editingDoctorId || !editName || !editSpecialty) return;
    
    const doctor = doctors.find(d => d.id === editingDoctorId);
    if (doctor) {
      onUpdateDoctor({
        ...doctor,
        name: editName,
        specialty: editSpecialty
      });
    }
    
    setEditingDoctorId(null);
    setEditName('');
    setEditSpecialty('');
  };

  const handleCancelEdit = () => {
    setEditingDoctorId(null);
    setEditName('');
    setEditSpecialty('');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const { error } = await apiAuth.updateProfile(
        currentUser.id,
        userName.trim(),
        userClinic.trim()
      );

      if (error) {
        setSaveMessage({ type: 'error', text: 'Erro ao atualizar perfil. Tente novamente.' });
      } else {
        setSaveMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
        
        // Atualizar usuário no contexto se callback estiver disponível
        if (onUserUpdate) {
          onUserUpdate({
            ...currentUser,
            name: userName.trim(),
            clinicName: userClinic.trim()
          });
        }

        // Limpar mensagem após 3 segundos
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      setSaveMessage({ type: 'error', text: 'Erro ao atualizar perfil. Tente novamente.' });
    } finally {
      setIsSaving(false);
    }
  };

  // F3 - Handler para salvar configurações de lembretes
  const handleSaveReminderSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setIsSavingReminders(true);
    setReminderSaveMessage(null);

    try {
      const { success, error } = await apiReminderSettings.updateReminderSettings(
        currentUser.id,
        {
          enabled: reminderEnabled,
          daysBefore: reminderDaysBefore,
          sendTime: reminderSendTime,
          timezone: reminderTimezone,
          maxPerDay: maxRemindersPerDay,
          noShowToleranceMinutes: noShowToleranceMinutes,
          reminderMessageTemplate: reminderMessageTemplate.trim() || null,
          reminderAddress: reminderAddress.trim() || null
        }
      );

      if (!success) {
        setReminderSaveMessage({ type: 'error', text: error || 'Erro ao salvar configurações.' });
      } else {
        setReminderSaveMessage({ type: 'success', text: 'Configurações de lembretes salvas com sucesso!' });
        
        // Atualizar usuário no contexto
        if (onUserUpdate) {
          onUserUpdate({
            ...currentUser,
            reminderEnabled,
            reminderDaysBefore,
            reminderSendTime,
            reminderTimezone,
            maxRemindersPerDay,
            noShowToleranceMinutes,
            reminderMessageTemplate: reminderMessageTemplate.trim() || undefined,
            reminderAddress: reminderAddress.trim() || undefined
          });
        }
        
        // Limpar mensagem após 3 segundos
        setTimeout(() => setReminderSaveMessage(null), 3000);
      }
    } catch (error) {
      console.error('Error saving reminder settings:', error);
      setReminderSaveMessage({ type: 'error', text: 'Erro ao salvar configurações.' });
    } finally {
      setIsSavingReminders(false);
    }
  };

  const handleSaveBusinessHours = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    setBusinessHoursMessage(null);
    setBusinessHoursSaving(true);
    try {
      const { success, error } = await apiBusinessHours.saveBusinessHours(currentUser.id, businessHoursRows);
      if (success) {
        setBusinessHoursMessage({ type: 'success', text: 'Horários de atendimento salvos com sucesso!' });
      } else {
        setBusinessHoursMessage({ type: 'error', text: error || 'Erro ao salvar.' });
      }
    } catch (err: any) {
      setBusinessHoursMessage({ type: 'error', text: err.message || 'Erro ao salvar horários.' });
    } finally {
      setBusinessHoursSaving(false);
    }
  };

  const updateBusinessHoursRow = (dayOfWeek: number, patch: Partial<BusinessHoursRow>) => {
    setBusinessHoursRows((prev) =>
      prev.map((r) => (r.day_of_week === dayOfWeek ? { ...r, ...patch } : r))
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-b border-slate-200">
           <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
             Configurações da Empresa
           </h2>
           <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 transition-colors">
             <X className="w-5 h-5 text-slate-500" />
           </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
            {/* Sidebar Tabs - rolável para garantir que "Horário de atendimento" apareça */}
            <div className="w-48 border-r border-slate-200 bg-slate-50 p-4 space-y-2 overflow-y-auto flex-shrink-0">
                <button 
                    onClick={() => setActiveTab('doctors')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'doctors' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                    Profissionais
                </button>
                 <button 
                    onClick={() => setActiveTab('account')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'account' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                    Conta
                </button>
                <button 
                    onClick={() => setActiveTab('agenda')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'agenda' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                    Agenda
                </button>
                <button 
                    onClick={() => setActiveTab('horarios')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'horarios' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                    data-settings-tab="horarios"
                >
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    Horário de atendimento
                </button>
                <button 
                    onClick={() => setActiveTab('reminders')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'reminders' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                    Lembretes
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'doctors' && (
                    <div className="space-y-8">
                        <div>
                            <h3 className="text-base font-bold text-slate-800 mb-1">Gerenciar Filtros de Visualização</h3>
                            <p className="text-sm text-slate-500 mb-4">Adicione profissionais para filtrar a agenda.</p>
                            
                            {/* List Existing */}
                            <div className="space-y-3 mb-6">
                                {doctors.map(doc => (
                                    <div key={doc.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                                        {editingDoctorId === doc.id ? (
                                            // Modo de edição
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <input
                                                        type="text"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                        placeholder="Nome"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={editSpecialty}
                                                        onChange={(e) => setEditSpecialty(e.target.value)}
                                                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                        placeholder="Especialidade"
                                                    />
                                                </div>
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        onClick={handleCancelEdit}
                                                        className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                    >
                                                        Cancelar
                                                    </button>
                                                    <button
                                                        onClick={handleSaveEdit}
                                                        className="px-3 py-1.5 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-1"
                                                    >
                                                        <Save className="w-3.5 h-3.5" />
                                                        Salvar
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            // Modo de visualização
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3 flex-1">
                                                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: doc.color }}>
                                                        {doc.name.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold text-slate-800">{doc.name}</p>
                                                        <p className="text-xs text-slate-500">{doc.specialty}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {/* Toggle para abrir/fechar agenda */}
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={doc.active}
                                                            onChange={() => onToggleDoctor(doc.id)}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                                        <span className="ml-2 text-xs font-medium text-slate-600">
                                                            {doc.active ? 'Aberta' : 'Fechada'}
                                                        </span>
                                                    </label>
                                                    <button
                                                        onClick={() => handleStartEdit(doc)}
                                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                        title="Editar profissional"
                                                    >
                                                        <UserIcon className="w-4 h-4" />
                                                    </button>
                                                    {doctors.length > 1 && (
                                                        <button 
                                                            onClick={() => onRemoveDoctor(doc.id)}
                                                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                            title="Remover profissional"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="border-t border-slate-100 pt-6">
                            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <UserPlus className="w-4 h-4 text-indigo-500" />
                                Adicionar Novo Profissional
                            </h3>
                            <form onSubmit={handleAdd} className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Nome Completo</label>
                                        <input 
                                            type="text" 
                                            value={newDocName}
                                            onChange={(e) => setNewDocName(e.target.value)}
                                            placeholder="Ex: Dr. João Silva"
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Especialidade</label>
                                        <input 
                                            type="text" 
                                            value={newDocRole}
                                            onChange={(e) => setNewDocRole(e.target.value)}
                                            placeholder="Ex: Dermatologista"
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-2">Cor de Identificação</label>
                                    <div className="flex gap-3">
                                        {PRESET_COLORS.map(color => (
                                            <button
                                                key={color.value}
                                                type="button"
                                                onClick={() => setNewDocColor(color.value)}
                                                className={`w-6 h-6 rounded-full border-2 transition-all ${newDocColor === color.value ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                                                style={{ backgroundColor: color.value }}
                                                title={color.label}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <button 
                                        type="submit"
                                        disabled={!newDocName || !newDocRole}
                                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm"
                                    >
                                        Adicionar Filtro
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                
                {activeTab === 'account' && (
                    <div className="space-y-6 max-w-md">
                        <div>
                            <h3 className="text-base font-bold text-slate-800 mb-1">Informações da Conta</h3>
                            <p className="text-sm text-slate-500 mb-6">Atualize suas informações pessoais e da empresa.</p>
                            
                            <form onSubmit={handleSaveProfile} className="space-y-6">
                                {/* Email (read-only) */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-2">
                                        <UserIcon className="w-4 h-4 inline mr-1" />
                                        Email
                                    </label>
                                    <input 
                                        type="email" 
                                        value={currentUser?.email || ''}
                                        disabled
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">O email não pode ser alterado.</p>
                                </div>

                                {/* Nome */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-2">
                                        Nome Completo
                                    </label>
                                    <input 
                                        type="text" 
                                        value={userName}
                                        onChange={(e) => setUserName(e.target.value)}
                                        placeholder="Seu nome completo"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                    />
                                </div>

                                {/* Empresa */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-2">
                                        <Building2 className="w-4 h-4 inline mr-1" />
                                        Nome da Empresa
                                    </label>
                                    <input 
                                        type="text" 
                                        value={userClinic}
                                        onChange={(e) => setUserClinic(e.target.value)}
                                        placeholder="Nome da sua empresa"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                    />
                                </div>

                                {/* Mensagem de feedback */}
                                {saveMessage && (
                                    <div className={`p-3 rounded-lg text-sm ${
                                        saveMessage.type === 'success' 
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}>
                                        {saveMessage.text}
                                    </div>
                                )}

                                {/* Botão Salvar */}
                                <div className="flex justify-end pt-2 border-t border-slate-100">
                                    <button 
                                        type="submit"
                                        disabled={isSaving || !userName.trim() || !userClinic.trim()}
                                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2"
                                    >
                                        <Save className="w-4 h-4" />
                                        {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {activeTab === 'agenda' && (
                    <div className="space-y-6 max-w-md">
                        <div>
                            <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                                <CalendarOff className="w-4 h-4 text-amber-500" />
                                Bloquear dias para agendamentos
                            </h3>
                            <p className="text-sm text-slate-500 mb-4">A IA do Vigil e as APIs de agendamento não oferecerão horários nestes dias. O agendamento manual no Proton não é alterado.</p>
                            
                            {/* Seletor de Profissional */}
                            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4">
                                <label className="block text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-2">
                                    Bloquear para:
                                </label>
                                <select
                                    value={selectedDoctorFilter}
                                    onChange={(e) => setSelectedDoctorFilter(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="all">🏢 Empresa (todos os profissionais)</option>
                                    {doctors.filter(d => d.active).map(doc => (
                                        <option key={doc.id} value={doc.id}>
                                            👤 {doc.name} ({doc.specialty})
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-indigo-600 mt-2">
                                    {selectedDoctorFilter === 'all' 
                                        ? '📌 Os bloqueios afetarão todos os profissionais'
                                        : `📌 Os bloqueios afetarão apenas ${doctors.find(d => d.id === selectedDoctorFilter)?.name}`
                                    }
                                </p>
                            </div>
                        </div>

                        {blocksLoading ? (
                            <p className="text-sm text-slate-500">Carregando...</p>
                        ) : (
                            <>
                                <div className="space-y-2 mb-6">
                                    {blocks.map((b) => (
                                        <div key={b.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 truncate">{describeBlock(b)}</p>
                                                {b.label && <p className="text-xs text-slate-500 truncate">{b.label}</p>}
                                            </div>
                                            <div className="flex items-center gap-2 ml-2">
                                                <button
                                                    onClick={() => handleToggleBlock(b.id, !b.active)}
                                                    className={`px-2 py-1 rounded text-xs font-medium ${b.active ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'}`}
                                                    title={b.active ? 'Desativar' : 'Ativar'}
                                                >
                                                    {b.active ? 'Ativo' : 'Inativo'}
                                                </button>
                                                <button onClick={() => handleDeleteBlock(b.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    ))}
                                    {blocks.length === 0 && <p className="text-sm text-slate-500">Nenhum bloqueio. Use as opções abaixo.</p>}
                                </div>

                                <div className="border-t border-slate-200 pt-4 space-y-4">
                                    {!hasWeekendBlock() && (
                                        <button type="button" onClick={handleBlockWeekend} className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium flex items-center gap-2">
                                            <Calendar className="w-4 h-4" /> Bloquear fins de semana
                                        </button>
                                    )}

                                    <form onSubmit={handleAddSpecific} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                                        <p className="text-xs font-semibold text-slate-600">Feriado ou folga (data única)</p>
                                        <div className="flex gap-2 flex-wrap">
                                            <input type="date" value={specificDate} onChange={(e) => setSpecificDate(e.target.value)} className="flex-1 min-w-[140px] px-3 py-2 rounded-lg border border-slate-200 text-sm" required />
                                            <input type="text" value={specificLabel} onChange={(e) => setSpecificLabel(e.target.value)} placeholder="Ex: Natal" className="flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                                            <button type="submit" disabled={!specificDate} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">Adicionar</button>
                                        </div>
                                    </form>

                                    <form onSubmit={handleAddRange} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                                        <p className="text-xs font-semibold text-slate-600">Período (ex.: férias)</p>
                                        <div className="flex flex-col gap-2">
                                            <div className="flex gap-2 flex-wrap">
                                                <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="flex-1 min-w-[130px] px-3 py-2 rounded-lg border border-slate-200 text-sm" required />
                                                <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="flex-1 min-w-[130px] px-3 py-2 rounded-lg border border-slate-200 text-sm" required />
                                            </div>
                                            <div className="flex gap-2">
                                                <input type="text" value={rangeLabel} onChange={(e) => setRangeLabel(e.target.value)} placeholder="Ex: Férias" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                                                <button type="submit" disabled={!rangeStart || !rangeEnd} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">Adicionar</button>
                                            </div>
                                        </div>
                                    </form>

                                    <form onSubmit={handleAddWeekday} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                                        <p className="text-xs font-semibold text-slate-600">Bloquear um dia da semana (ex.: quartas)</p>
                                        <div className="flex gap-2 flex-wrap">
                                            <select value={weekdayNum} onChange={(e) => setWeekdayNum(Number(e.target.value))} className="px-3 py-2 rounded-lg border border-slate-200 text-sm">
                                                <option value={0}>Domingo</option><option value={1}>Segunda</option><option value={2}>Terça</option><option value={3}>Quarta</option><option value={4}>Quinta</option><option value={5}>Sexta</option><option value={6}>Sábado</option>
                                            </select>
                                            <input type="text" value={weekdayLabel} onChange={(e) => setWeekdayLabel(e.target.value)} placeholder="Ex: Compromissos" className="flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                                            <button type="submit" className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Adicionar</button>
                                        </div>
                                    </form>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Aba Horário de atendimento */}
                {activeTab === 'horarios' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-indigo-600" />
                                Horário de atendimento
                            </h3>
                            <p className="text-sm text-slate-500 mb-4">
                                Defina início e fim do expediente por dia da semana. Dias inativos não oferecem horários para agendamento (API/chatbot). Agendamentos manuais no painel podem ser feitos em qualquer horário.
                            </p>

                            {businessHoursLoading ? (
                                <p className="text-sm text-slate-500">Carregando...</p>
                            ) : (
                                <form onSubmit={handleSaveBusinessHours} className="space-y-4">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="text-left px-3 py-2 font-medium text-slate-700">Dia</th>
                                                    <th className="text-left px-3 py-2 font-medium text-slate-700">Ativo</th>
                                                    <th className="text-left px-3 py-2 font-medium text-slate-700">Início</th>
                                                    <th className="text-left px-3 py-2 font-medium text-slate-700">Fim</th>
                                                    <th className="text-left px-3 py-2 font-medium text-slate-700">Almoço início</th>
                                                    <th className="text-left px-3 py-2 font-medium text-slate-700">Almoço fim</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {businessHoursRows.map((row) => (
                                                    <tr key={row.day_of_week} className="border-t border-slate-200 hover:bg-slate-50/50">
                                                        <td className="px-3 py-2 font-medium text-slate-800">{apiBusinessHours.DAY_NAMES[row.day_of_week]}</td>
                                                        <td className="px-3 py-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={row.active}
                                                                onChange={(e) => updateBusinessHoursRow(row.day_of_week, { active: e.target.checked })}
                                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <input
                                                                type="time"
                                                                value={row.start_time}
                                                                onChange={(e) => updateBusinessHoursRow(row.day_of_week, { start_time: e.target.value })}
                                                                className="w-28 px-2 py-1 border border-slate-300 rounded text-slate-800"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <input
                                                                type="time"
                                                                value={row.end_time}
                                                                onChange={(e) => updateBusinessHoursRow(row.day_of_week, { end_time: e.target.value })}
                                                                className="w-28 px-2 py-1 border border-slate-300 rounded text-slate-800"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <input
                                                                type="time"
                                                                value={row.lunch_start ?? ''}
                                                                onChange={(e) => updateBusinessHoursRow(row.day_of_week, { lunch_start: e.target.value || null })}
                                                                className="w-28 px-2 py-1 border border-slate-300 rounded text-slate-800"
                                                                placeholder="—"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <input
                                                                type="time"
                                                                value={row.lunch_end ?? ''}
                                                                onChange={(e) => updateBusinessHoursRow(row.day_of_week, { lunch_end: e.target.value || null })}
                                                                className="w-28 px-2 py-1 border border-slate-300 rounded text-slate-800"
                                                                placeholder="—"
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        Padrão: Segunda a Sexta 08:00–18:00 com almoço 12:00–13:00. Sábado e Domingo fechados. Deixe almoço em branco para não ter intervalo.
                                    </p>
                                    <div className="pt-2 flex items-center gap-3">
                                        <button
                                            type="submit"
                                            disabled={businessHoursSaving}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            <Save className="w-4 h-4" />
                                            {businessHoursSaving ? 'Salvando...' : 'Salvar horários'}
                                        </button>
                                        {businessHoursMessage && (
                                            <span className={`text-sm ${businessHoursMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                                {businessHoursMessage.text}
                                            </span>
                                        )}
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                )}

                {/* F3 - Aba Lembretes */}
                {activeTab === 'reminders' && (
                    <div className="space-y-6 max-w-md">
                        <div>
                            <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                                <Bell className="w-5 h-5 text-indigo-600" />
                                Configurações de Lembretes
                            </h3>
                            <p className="text-sm text-slate-500 mb-6">
                                Configure o envio automático de lembretes de confirmação via WhatsApp.
                            </p>

                            <form onSubmit={handleSaveReminderSettings} className="space-y-6">
                                {/* Toggle principal */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <label className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                                {reminderEnabled ? (
                                                    <Bell className="w-4 h-4 text-green-600" />
                                                ) : (
                                                    <BellOff className="w-4 h-4 text-slate-400" />
                                                )}
                                                Enviar lembretes de confirmação
                                            </label>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {reminderEnabled 
                                                    ? 'Lembretes estão ativos. Pacientes receberão mensagens via WhatsApp.'
                                                    : 'Lembretes desativados. Nenhuma mensagem será enviada.'}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setReminderEnabled(!reminderEnabled)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                                                reminderEnabled ? 'bg-green-600' : 'bg-slate-300'
                                            }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                    reminderEnabled ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                            />
                                        </button>
                                    </div>
                                </div>

                                {/* Configurações (disabled se toggle off) */}
                                <div className={`space-y-4 ${!reminderEnabled ? 'opacity-50' : ''}`}>
                                    {/* Dias de antecedência */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Dias de antecedência
                                        </label>
                                        <select
                                            value={reminderDaysBefore}
                                            onChange={(e) => setReminderDaysBefore(Number(e.target.value))}
                                            disabled={!reminderEnabled}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                        >
                                            <option value={1}>1 dia antes</option>
                                            <option value={2}>2 dias antes</option>
                                            <option value={3}>3 dias antes</option>
                                            <option value={4}>4 dias antes</option>
                                            <option value={5}>5 dias antes</option>
                                            <option value={6}>6 dias antes</option>
                                            <option value={7}>7 dias antes</option>
                                        </select>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Quantos dias antes do agendamento o lembrete será enviado
                                        </p>
                                    </div>

                                    {/* Horário do envio */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Horário do envio
                                        </label>
                                        <input
                                            type="time"
                                            value={reminderSendTime}
                                            onChange={(e) => setReminderSendTime(e.target.value)}
                                            disabled={!reminderEnabled}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">
                                            Horário em que os lembretes serão enviados ({reminderTimezone})
                                        </p>
                                    </div>

                                    {/* Timezone */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Fuso horário
                                        </label>
                                        <select
                                            value={reminderTimezone}
                                            onChange={(e) => setReminderTimezone(e.target.value)}
                                            disabled={!reminderEnabled}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                        >
                                            <option value="America/Sao_Paulo">Brasília (UTC-3)</option>
                                            <option value="America/Manaus">Manaus (UTC-4)</option>
                                            <option value="America/Rio_Branco">Rio Branco (UTC-5)</option>
                                            <option value="America/Fortaleza">Fortaleza (UTC-3)</option>
                                            <option value="America/Recife">Recife (UTC-3)</option>
                                            <option value="America/Bahia">Salvador (UTC-3)</option>
                                        </select>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Selecione o fuso horário da sua empresa
                                        </p>
                                    </div>

                                    {/* Configurações avançadas */}
                                    <details className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                        <summary className="text-sm font-medium text-slate-700 cursor-pointer">
                                            Configurações avançadas
                                        </summary>
                                        <div className="mt-4 space-y-4">
                                            {/* Limite por dia */}
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                                    Máximo de lembretes por dia
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="500"
                                                    value={maxRemindersPerDay}
                                                    onChange={(e) => setMaxRemindersPerDay(Number(e.target.value))}
                                                    disabled={!reminderEnabled}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                                />
                                                <p className="text-xs text-slate-500 mt-1">
                                                    Limite de segurança (padrão: 50)
                                                </p>
                                            </div>

                                            {/* Tolerância no-show */}
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                                    Tolerância para falta (minutos)
                                                </label>
                                                <select
                                                    value={noShowToleranceMinutes}
                                                    onChange={(e) => setNoShowToleranceMinutes(Number(e.target.value))}
                                                    disabled={!reminderEnabled}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                                >
                                                    <option value={15}>15 minutos</option>
                                                    <option value={20}>20 minutos</option>
                                                    <option value={30}>30 minutos</option>
                                                    <option value={45}>45 minutos</option>
                                                    <option value={60}>1 hora</option>
                                                </select>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    Tempo após o horário do agendamento para marcar como falta
                                                </p>
                                            </div>

                                            {/* Mensagem personalizada (opcional) */}
                                            <div className="pt-4 border-t border-slate-200">
                                                <h4 className="text-sm font-semibold text-slate-800 mb-2">Mensagem personalizada (opcional)</h4>
                                                <p className="text-xs text-slate-500 mb-2">
                                                    Se vazio, é usada a mensagem padrão do sistema. Use os placeholders: [data], [horário], [profissional], [link], [endereço]. Recomendamos manter [link] e [data].
                                                </p>
                                                <textarea
                                                    value={reminderMessageTemplate}
                                                    onChange={(e) => setReminderMessageTemplate(e.target.value)}
                                                    disabled={!reminderEnabled}
                                                    rows={5}
                                                    maxLength={2000}
                                                    placeholder="Ex.: Olá! Sua consulta está agendada para [data] às [horário]. Confirme por aqui: [link]"
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:cursor-not-allowed resize-y"
                                                />
                                                <p className="text-xs text-slate-500 mt-1">
                                                    Máximo 2000 caracteres
                                                </p>
                                                <div className="mt-3">
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Endereço no lembrete</label>
                                                    <input
                                                        type="text"
                                                        value={reminderAddress}
                                                        onChange={(e) => setReminderAddress(e.target.value)}
                                                        disabled={!reminderEnabled}
                                                        placeholder="Ex.: Rua Exemplo, 123"
                                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                                    />
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        Substitui [endereço] na mensagem. Vazio = &quot;Endereço a confirmar&quot;
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </details>
                                </div>

                                {/* Botão Salvar */}
                                <div className="pt-4 border-t border-slate-200">
                                    <button
                                        type="submit"
                                        disabled={isSavingReminders}
                                        className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        <Save className="w-4 h-4" />
                                        {isSavingReminders ? 'Salvando...' : 'Salvar Configurações'}
                                    </button>
                                    
                                    {/* Mensagem de sucesso/erro */}
                                    {reminderSaveMessage && (
                                        <div className={`mt-3 p-3 rounded-lg text-sm ${
                                            reminderSaveMessage.type === 'success' 
                                                ? 'bg-green-50 text-green-800 border border-green-200' 
                                                : 'bg-red-50 text-red-800 border border-red-200'
                                        }`}>
                                            {reminderSaveMessage.text}
                                        </div>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
