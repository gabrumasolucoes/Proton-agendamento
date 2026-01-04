
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, User, Phone, Mail, Calendar, Clock, ChevronRight, History, MoreHorizontal, Sparkles, AlertCircle, UserPlus, X, Save, Edit3, Trash2 } from 'lucide-react';
import { Appointment, Patient } from '../types';
import { format, isFuture, isPast, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PatientsViewProps {
  patients: Patient[];
  appointments: Appointment[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onAddPatient: (patient: Patient) => void;
  onUpdatePatient: (patient: Patient) => void;
  onDeletePatient: (id: string) => void;
  onCreateAppointment: (patient: Patient) => void;
}

interface PatientSummary extends Omit<Patient, 'history'> {
  totalAppointments: number;
  lastAppointment?: Date;
  nextAppointment?: Date;
  history: Appointment[];
}

export const PatientsView: React.FC<PatientsViewProps> = ({ 
    patients, 
    appointments, 
    searchTerm, 
    onSearchChange, 
    onAddPatient,
    onUpdatePatient,
    onDeletePatient,
    onCreateAppointment
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Merge the master patient list with their appointment history
  const patientsWithData: PatientSummary[] = useMemo(() => {
    return patients.map(p => {
        const patientAppointments = appointments.filter(a => a.patientId === p.id);
        patientAppointments.sort((a, b) => b.start.getTime() - a.start.getTime());
        const futureApts = patientAppointments.filter(a => isFuture(a.start)).sort((a, b) => a.start.getTime() - b.start.getTime());
        const pastApts = patientAppointments.filter(a => isPast(a.start));

        return {
            ...p,
            totalAppointments: patientAppointments.length,
            history: patientAppointments,
            nextAppointment: futureApts.length > 0 ? futureApts[0].start : undefined,
            lastAppointment: pastApts.length > 0 ? pastApts[0].start : undefined
        };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [patients, appointments]);

  const filteredPatients = patientsWithData.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return p.name.toLowerCase().includes(term) || 
           (p.phone && p.phone.includes(term)) || 
           (p.email && p.email.toLowerCase().includes(term));
  });

  const selectedPatient = selectedPatientId ? patientsWithData.find(p => p.id === selectedPatientId) : null;

  // Cleanup selection if patient was deleted
  useEffect(() => {
      if (selectedPatientId && !patients.find(p => p.id === selectedPatientId)) {
          setSelectedPatientId(null);
      }
  }, [patients, selectedPatientId]);

  const getAvatarColor = (name: string) => {
    const colors = ['bg-blue-100 text-blue-600', 'bg-emerald-100 text-emerald-600', 'bg-violet-100 text-violet-600', 'bg-amber-100 text-amber-600', 'bg-rose-100 text-rose-600'];
    const index = name.length % colors.length;
    return colors[index];
  };

  const handleOpenAddModal = () => {
      setEditingPatient(null);
      setFormName('');
      setFormPhone('');
      setFormEmail('');
      setIsPatientModalOpen(true);
  };

  const handleOpenEditModal = () => {
      if (selectedPatient) {
          const originalPatient = patients.find(p => p.id === selectedPatient.id);
          if (originalPatient) {
              setEditingPatient(originalPatient);
              setFormName(originalPatient.name);
              setFormPhone(originalPatient.phone || '');
              setFormEmail(originalPatient.email || '');
              setIsPatientModalOpen(true);
              setIsMenuOpen(false);
          }
      }
  };

  const handleDeleteCurrent = () => {
      if (selectedPatientId) {
          onDeletePatient(selectedPatientId);
          setIsMenuOpen(false);
      }
  };

  const handleSavePatient = (e: React.FormEvent) => {
      e.preventDefault();
      if (formName) {
          if (editingPatient) {
              // Update existing
              onUpdatePatient({
                  ...editingPatient,
                  name: formName,
                  phone: formPhone,
                  email: formEmail
              });
          } else {
              // Create new
              const newPatient: Patient = {
                  id: `p-${Date.now()}`,
                  name: formName,
                  phone: formPhone,
                  email: formEmail,
                  history: ''
              };
              onAddPatient(newPatient);
              setSelectedPatientId(newPatient.id);
          }
          setIsPatientModalOpen(false);
      }
  };

  return (
    <div className="flex h-full bg-slate-50 relative">
      {/* Left Column: Patient List */}
      <div className={`w-full md:w-[380px] bg-white border-r border-slate-200 flex flex-col z-10 transition-all ${selectedPatientId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-5 border-b border-slate-100">
          <div className="flex justify-between items-center mb-3">
             <h2 className="text-lg font-bold text-slate-800">Pacientes</h2>
             <button 
                onClick={handleOpenAddModal}
                className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-2 text-xs font-bold"
             >
                <UserPlus className="w-4 h-4" />
                Adicionar
             </button>
          </div>
          
          <div className="relative">
             <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
             <input 
                type="text" 
                placeholder="Buscar por nome, email ou telefone..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
             />
          </div>
          
          <div className="flex items-center justify-between mt-3 px-1">
             <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Lista de Pacientes</span>
             <span className="text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{filteredPatients.length}</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredPatients.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <User className="w-10 h-10 mx-auto text-slate-200 mb-3" />
              <p className="text-sm">Nenhum paciente encontrado.</p>
              <button onClick={handleOpenAddModal} className="mt-4 text-indigo-600 text-sm font-medium hover:underline">
                  Cadastrar novo paciente
              </button>
            </div>
          ) : (
            filteredPatients.map(patient => (
              <div 
                key={patient.id}
                onClick={() => setSelectedPatientId(patient.id)}
                className={`p-4 border-b border-slate-50 cursor-pointer transition-all hover:bg-slate-50 group relative ${selectedPatientId === patient.id ? 'bg-indigo-50/60' : ''}`}
              >
                {selectedPatientId === patient.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 rounded-r-full"></div>
                )}
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${getAvatarColor(patient.name)}`}>
                    {patient.name.substring(0, 2).toUpperCase()}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <h3 className={`font-semibold truncate text-sm ${selectedPatientId === patient.id ? 'text-indigo-900' : 'text-slate-700 group-hover:text-slate-900'}`}>
                        {patient.name}
                        </h3>
                        {patient.nextAppointment && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-white"></span>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-slate-500 truncate flex items-center">
                            {patient.lastAppointment 
                                ? `Última: ${format(patient.lastAppointment, "d MMM", { locale: ptBR })}`
                                : <span className="text-slate-400 italic">Sem consultas</span>
                            }
                        </p>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-300 group-hover:text-slate-400 ${selectedPatientId === patient.id ? 'text-indigo-400' : ''}`} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Column: Patient Details */}
      <div className={`flex-1 bg-slate-50/50 flex flex-col min-w-0 ${!selectedPatientId ? 'hidden md:flex' : 'flex'}`}>
        {!selectedPatient ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100">
               <User className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-medium text-slate-600">Nenhum Paciente Selecionado</h3>
            <p className="text-sm max-w-xs text-center mt-2 text-slate-400">Selecione um paciente na lista ao lado para visualizar o prontuário completo, histórico e agendamentos.</p>
          </div>
        ) : (
          <>
            {/* Header Profile */}
            <div className="bg-white border-b border-slate-200 p-6 md:p-8 flex flex-col md:flex-row md:items-start justify-between gap-6 shadow-sm z-10">
               <div className="flex items-center gap-5">
                    <div className="hidden md:flex w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 items-center justify-center text-2xl font-bold text-slate-500 shadow-inner">
                        {selectedPatient.name.substring(0, 2).toUpperCase()}
                    </div>
                    
                    <div className="md:hidden mb-2">
                        <button onClick={() => setSelectedPatientId(null)} className="flex items-center text-sm text-slate-500 font-medium hover:text-indigo-600">
                            <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> Voltar
                        </button>
                    </div>
                    
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{selectedPatient.name}</h2>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2 text-sm text-slate-500">
                            {selectedPatient.phone && (
                                <span className="flex items-center hover:text-indigo-600 cursor-pointer transition-colors"><Phone className="w-4 h-4 mr-1.5" /> {selectedPatient.phone}</span>
                            )}
                            {selectedPatient.email && (
                                <span className="flex items-center hover:text-indigo-600 cursor-pointer transition-colors"><Mail className="w-4 h-4 mr-1.5" /> {selectedPatient.email}</span>
                            )}
                            {!selectedPatient.phone && !selectedPatient.email && (
                                <span className="text-slate-400 italic">Contato não informado</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                             <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded text-xs font-medium border border-slate-200">Particular</span>
                             <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded text-xs font-medium border border-emerald-100 flex items-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></div> Ativo
                             </span>
                        </div>
                    </div>
               </div>
               
               <div className="flex gap-3 relative">
                   {/* Dropdown Menu for "..." */}
                   <div className="relative" ref={menuRef}>
                       <button 
                           onClick={() => setIsMenuOpen(!isMenuOpen)}
                           className={`p-2.5 rounded-lg border text-slate-500 transition-colors bg-white ${isMenuOpen ? 'border-indigo-200 bg-indigo-50 text-indigo-600' : 'border-slate-200 hover:bg-slate-50 hover:text-slate-800'}`}
                       >
                            <MoreHorizontal className="w-5 h-5" />
                       </button>
                       {isMenuOpen && (
                           <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden z-20 animate-in fade-in slide-in-from-top-2 duration-200">
                               <button 
                                   onClick={handleOpenEditModal}
                                   className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                               >
                                   <Edit3 className="w-4 h-4 text-slate-400" />
                                   Editar Cadastro
                               </button>
                               <button 
                                   onClick={handleDeleteCurrent}
                                   className="w-full text-left px-4 py-3 text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors border-t border-slate-50"
                               >
                                   <Trash2 className="w-4 h-4" />
                                   Excluir Paciente
                               </button>
                           </div>
                       )}
                   </div>

                   <button 
                        onClick={() => {
                            const original = patients.find(p => p.id === selectedPatient.id);
                            if (original) onCreateAppointment(original);
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm shadow-indigo-200 transition-all active:scale-95"
                   >
                        Novo Agendamento
                   </button>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="max-w-4xl mx-auto space-y-8">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Consultas</p>
                            <p className="text-2xl font-bold text-slate-800 mt-1">{selectedPatient.totalAppointments}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Última Visita</p>
                            <p className="text-lg font-bold text-slate-800 mt-1">
                                {selectedPatient.lastAppointment ? format(selectedPatient.lastAppointment, "d MMM yyyy", { locale: ptBR }) : '-'}
                            </p>
                            {selectedPatient.lastAppointment && (
                                <p className="text-xs text-slate-500 mt-1">
                                    Há {differenceInDays(new Date(), selectedPatient.lastAppointment)} dias
                                </p>
                            )}
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                             {selectedPatient.nextAppointment && (
                                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-emerald-100 to-transparent opacity-50 rounded-bl-full"></div>
                             )}
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Próximo Retorno</p>
                            <p className={`text-lg font-bold mt-1 ${selectedPatient.nextAppointment ? 'text-emerald-700' : 'text-slate-400'}`}>
                                {selectedPatient.nextAppointment ? format(selectedPatient.nextAppointment, "d MMM, HH:mm", { locale: ptBR }) : 'Não agendado'}
                            </p>
                            {selectedPatient.nextAppointment && (
                                <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center">
                                    <Clock className="w-3 h-3 mr-1" /> Confirmado
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Timeline */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 flex items-center mb-6">
                            <History className="w-4 h-4 mr-2 text-indigo-500" />
                            Histórico Clínico
                        </h3>

                        {selectedPatient.history.length === 0 ? (
                            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                                <p className="text-slate-500 text-sm">Este paciente ainda não possui histórico de consultas.</p>
                            </div>
                        ) : (
                            <div className="relative pl-4 space-y-8 before:absolute before:left-[19px] before:top-2 before:bottom-4 before:w-0.5 before:bg-slate-200">
                                {selectedPatient.history.map((apt) => {
                                    const isFutureApt = isFuture(apt.start);
                                    const isMatch = searchTerm && (
                                        apt.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                        (apt.notes && apt.notes.toLowerCase().includes(searchTerm.toLowerCase()))
                                    );

                                    return (
                                        <div key={apt.id} className={`relative pl-8 ${isMatch ? 'opacity-100' : searchTerm ? 'opacity-40' : 'opacity-100'}`}>
                                            <div className={`absolute left-0 top-1.5 w-10 h-10 rounded-full border-4 border-slate-50 flex items-center justify-center z-10 ${
                                                isFutureApt 
                                                ? 'bg-emerald-500 text-white shadow-emerald-200 shadow-md' 
                                                : apt.status === 'cancelled' 
                                                    ? 'bg-rose-400 text-white'
                                                    : 'bg-white text-slate-400 border-slate-200'
                                            }`}>
                                                {apt.source === 'chatbot' ? <Sparkles className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                                            </div>

                                            <div className={`bg-white rounded-xl border p-5 transition-shadow hover:shadow-md ${isFutureApt ? 'border-emerald-200 ring-1 ring-emerald-50' : 'border-slate-200'} ${isMatch ? 'ring-2 ring-indigo-300' : ''}`}>
                                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className={`font-bold text-base ${isFutureApt ? 'text-emerald-900' : 'text-slate-800'}`}>
                                                                {apt.title}
                                                            </h4>
                                                            {apt.source === 'chatbot' && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                                    <Sparkles className="w-3 h-3 mr-1" /> IA
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-slate-500 font-medium mt-0.5 capitalize">
                                                            {format(apt.start, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 self-start">
                                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                        <span className="text-xs font-semibold text-slate-600">
                                                            {format(apt.start, 'HH:mm')} - {format(apt.end, 'HH:mm')}
                                                        </span>
                                                    </div>
                                                </div>

                                                {apt.notes && (
                                                    <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 leading-relaxed border-l-2 border-slate-300">
                                                        {apt.notes}
                                                    </div>
                                                )}

                                                {apt.tags && apt.tags.length > 0 && (
                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                        {apt.tags.map(tag => (
                                                            <span key={tag} className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-medium text-slate-500">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                
                                                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                                                    <span className={`text-[11px] font-bold uppercase tracking-wider flex items-center ${
                                                        apt.status === 'confirmed' ? 'text-emerald-600' :
                                                        apt.status === 'pending' ? 'text-amber-600' :
                                                        apt.status === 'cancelled' ? 'text-rose-600' : 'text-slate-500'
                                                    }`}>
                                                        {apt.status === 'cancelled' ? <AlertCircle className="w-3 h-3 mr-1" /> : <div className="w-1.5 h-1.5 rounded-full bg-current mr-1.5"></div>}
                                                        {apt.status}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Patient Modal */}
      {isPatientModalOpen && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                          <UserPlus className="w-5 h-5 text-indigo-600" />
                          {editingPatient ? 'Editar Paciente' : 'Novo Paciente'}
                      </h3>
                      <button onClick={() => setIsPatientModalOpen(false)} className="p-1 rounded-full hover:bg-slate-200 transition-colors">
                          <X className="w-5 h-5 text-slate-400" />
                      </button>
                  </div>
                  
                  <form onSubmit={handleSavePatient} className="p-6 space-y-4">
                      <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-1">Nome Completo</label>
                          <input 
                              type="text" 
                              required
                              placeholder="Ex: Maria Silva"
                              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                              value={formName}
                              onChange={(e) => setFormName(e.target.value)}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-1">Telefone (Opcional)</label>
                          <input 
                              type="tel" 
                              placeholder="Ex: (11) 99999-9999"
                              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                              value={formPhone}
                              onChange={(e) => setFormPhone(e.target.value)}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-1">E-mail <span className="text-slate-400 font-normal">(Opcional)</span></label>
                          <input 
                              type="email" 
                              placeholder="Ex: maria@email.com"
                              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                              value={formEmail}
                              onChange={(e) => setFormEmail(e.target.value)}
                          />
                      </div>
                      
                      <div className="pt-4 flex items-center justify-end gap-3">
                          <button 
                              type="button"
                              onClick={() => setIsPatientModalOpen(false)}
                              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                          >
                              Cancelar
                          </button>
                          <button 
                              type="submit"
                              className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all flex items-center gap-2"
                          >
                              <Save className="w-4 h-4" />
                              {editingPatient ? 'Salvar Alterações' : 'Criar Paciente'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
