
import React, { useState, useEffect } from 'react';
import { X, UserPlus, Trash2, User as UserIcon, Building2, Save, Calendar, CalendarOff } from 'lucide-react';
import { DoctorProfile, User } from '../types';
import { apiAuth, apiAgendaBlocks, AgendaBlock } from '../services/api';

interface SettingsModalProps {
  onClose: () => void;
  doctors: DoctorProfile[];
  onAddDoctor: (doctor: Omit<DoctorProfile, 'id' | 'active'>) => void;
  onRemoveDoctor: (id: string) => void;
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
  currentUser,
  onUserUpdate
}) => {
  const [activeTab, setActiveTab] = useState<'doctors' | 'account' | 'agenda'>('doctors');
  const [newDocName, setNewDocName] = useState('');
  const [newDocRole, setNewDocRole] = useState('');
  const [newDocColor, setNewDocColor] = useState(PRESET_COLORS[0].value);

  // Account settings state
  const [userName, setUserName] = useState(currentUser?.name || '');
  const [userClinic, setUserClinic] = useState(currentUser?.clinicName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Agenda blocks state
  const [blocks, setBlocks] = useState<AgendaBlock[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [specificDate, setSpecificDate] = useState('');
  const [specificLabel, setSpecificLabel] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeLabel, setRangeLabel] = useState('');
  const [weekdayNum, setWeekdayNum] = useState<number>(6);
  const [weekdayLabel, setWeekdayLabel] = useState('');

  useEffect(() => {
    if (currentUser) {
      setUserName(currentUser.name || '');
      setUserClinic(currentUser.clinicName || '');
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === 'agenda' && currentUser?.id) {
      setBlocksLoading(true);
      apiAgendaBlocks.getBlocks(currentUser.id).then((b) => { setBlocks(b); setBlocksLoading(false); });
    }
  }, [activeTab, currentUser?.id]);

  const describeBlock = (b: AgendaBlock): string => {
    if (b.block_type === 'weekdays' && Array.isArray(b.weekdays) && b.weekdays.length > 0) {
      const names: Record<number, string> = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };
      const s = b.weekdays.map((w) => names[w] || '').filter(Boolean).join(', ');
      return s || 'Dias da semana';
    }
    if (b.block_type === 'specific_date' && b.specific_date) return b.specific_date;
    if (b.block_type === 'date_range' && b.start_date && b.end_date) return `${b.start_date} a ${b.end_date}`;
    return b.block_type;
  };

  const hasWeekendBlock = (): boolean => blocks.some((b) => b.block_type === 'weekdays' && Array.isArray(b.weekdays) && b.weekdays.includes(0) && b.weekdays.includes(6));

  const handleBlockWeekend = async () => {
    if (!currentUser?.id || hasWeekendBlock()) return;
    const created = await apiAgendaBlocks.insert(currentUser.id, { block_type: 'weekdays', weekdays: [0, 6], label: 'Fim de semana' });
    if (created) setBlocks((prev) => [created, ...prev]);
  };

  const handleAddSpecific = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id || !specificDate) return;
    const created = await apiAgendaBlocks.insert(currentUser.id, { block_type: 'specific_date', specific_date: specificDate, label: specificLabel.trim() || null });
    if (created) { setBlocks((prev) => [created, ...prev]); setSpecificDate(''); setSpecificLabel(''); }
  };

  const handleAddRange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id || !rangeStart || !rangeEnd) return;
    const created = await apiAgendaBlocks.insert(currentUser.id, { block_type: 'date_range', start_date: rangeStart, end_date: rangeEnd, label: rangeLabel.trim() || null });
    if (created) { setBlocks((prev) => [created, ...prev]); setRangeStart(''); setRangeEnd(''); setRangeLabel(''); }
  };

  const handleAddWeekday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    const created = await apiAgendaBlocks.insert(currentUser.id, { block_type: 'weekdays', weekdays: [weekdayNum], label: weekdayLabel.trim() || null });
    if (created) { setBlocks((prev) => [created, ...prev]); setWeekdayLabel(''); }
  };

  const handleToggleBlock = async (id: string, active: boolean) => {
    const ok = await apiAgendaBlocks.update(id, { active });
    if (ok) setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, active } : b)));
  };

  const handleDeleteBlock = async (id: string) => {
    if (!window.confirm('Remover este bloqueio?')) return;
    const ok = await apiAgendaBlocks.delete(id);
    if (ok) setBlocks((prev) => prev.filter((b) => b.id !== id));
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-b border-slate-200">
           <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
             Configurações da Clínica
           </h2>
           <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 transition-colors">
             <X className="w-5 h-5 text-slate-500" />
           </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            {/* Sidebar Tabs */}
            <div className="w-48 border-r border-slate-200 bg-slate-50 p-4 space-y-2">
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
                                    <div key={doc.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: doc.color }}>
                                                {doc.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">{doc.name}</p>
                                                <p className="text-xs text-slate-500">{doc.specialty}</p>
                                            </div>
                                        </div>
                                        {doctors.length > 1 && (
                                            <button 
                                                onClick={() => onRemoveDoctor(doc.id)}
                                                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                title="Remover filtro"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
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
                            <p className="text-sm text-slate-500 mb-6">Atualize suas informações pessoais e da clínica.</p>
                            
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

                                {/* Clínica */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-2">
                                        <Building2 className="w-4 h-4 inline mr-1" />
                                        Nome da Clínica
                                    </label>
                                    <input 
                                        type="text" 
                                        value={userClinic}
                                        onChange={(e) => setUserClinic(e.target.value)}
                                        placeholder="Nome da sua clínica"
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
            </div>
        </div>
      </div>
    </div>
  );
};
