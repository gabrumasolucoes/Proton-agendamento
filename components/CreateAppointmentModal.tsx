
import React, { useState, useRef, useEffect } from 'react';
import { X, Clock, AlignLeft, User, Calendar as CalendarIcon, Tag, Sparkles, Plus, Check, Briefcase } from 'lucide-react';
import { Appointment, ProcedureTag, Patient, DoctorProfile } from '../types';
import { addHours, format, startOfHour, addDays } from 'date-fns';
import { TAG_COLORS } from '../constants';

interface CreateAppointmentModalProps {
  onClose: () => void;
  onSave: (appointment: Appointment | Omit<Appointment, 'id' | 'status'>) => void;
  initialData?: Appointment | null;
  tags: ProcedureTag[];
  patients: Patient[];
  doctors: DoctorProfile[];
  onAddTag: (tag: ProcedureTag) => void;
  onRemoveTag: (tagId: string) => void;
}

export const CreateAppointmentModal: React.FC<CreateAppointmentModalProps> = ({ onClose, onSave, initialData, tags, patients, doctors, onAddTag, onRemoveTag }) => {
  const [title, setTitle] = useState(initialData?.title || '');
  
  // Patient Selection State
  const [patientName, setPatientName] = useState(initialData?.patientName || '');
  const [patientId, setPatientId] = useState(initialData?.patientId || '');
  const [showPatientSuggestions, setShowPatientSuggestions] = useState(false);
  const patientInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  // Doctor Selection State
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(
    initialData?.doctorId || doctors.find(d => d.active)?.id || ''
  );
  
  const initialDate = initialData ? initialData.start : new Date();
  const initialStartTime = initialData ? initialData.start : startOfHour(addHours(new Date(), 1));
  const initialEndTime = initialData ? initialData.end : addHours(initialStartTime, 1);

  const [date, setDate] = useState(format(initialDate, 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState(format(initialStartTime, 'HH:mm'));
  const [endTime, setEndTime] = useState(format(initialEndTime, 'HH:mm'));
  const [notes, setNotes] = useState(initialData?.notes || '');
  
  const [selectedTags, setSelectedTags] = useState<string[]>(initialData?.tags || []);

  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagLabel, setNewTagLabel] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (
            suggestionsRef.current && 
            !suggestionsRef.current.contains(event.target as Node) &&
            patientInputRef.current &&
            !patientInputRef.current.contains(event.target as Node)
        ) {
            setShowPatientSuggestions(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const startDateTime = new Date(`${date}T${startTime}`);
    let endDateTime = new Date(`${date}T${endTime}`);

    if (endDateTime <= startDateTime) {
        endDateTime = addDays(endDateTime, 1);
    }

    const baseData = {
      patientId: patientId || 'new-patient',
      patientName: patientName || 'Cliente Sem Nome',
      title: title || 'Atendimento',
      start: startDateTime,
      end: endDateTime,
      notes: notes,
      source: initialData?.source || 'manual',
      tags: selectedTags,
      doctorId: selectedDoctorId
    };

    if (initialData) {
        onSave({ ...initialData, ...baseData, status: initialData.status } as Appointment);
    } else {
        onSave(baseData as Omit<Appointment, 'id' | 'status'>);
    }
  };

  const handleTagClick = (tagLabel: string) => {
      setTitle(tagLabel);
      setSelectedTags([tagLabel]);
  };

  const handleCreateTag = () => {
      if (newTagLabel.trim()) {
          const newTag: ProcedureTag = {
              id: Math.random().toString(36).substr(2, 9),
              label: newTagLabel,
              colorClass: newTagColor.class
          };
          onAddTag(newTag);
          setIsCreatingTag(false);
          setNewTagLabel('');
          setNewTagColor(TAG_COLORS[0]);
          handleTagClick(newTag.label);
      }
  };

  const filteredPatients = patients.filter(p => 
      p.name.toLowerCase().includes(patientName.toLowerCase())
  );

  const handleSelectPatient = (patient: Patient) => {
      setPatientName(patient.name);
      setPatientId(patient.id);
      setShowPatientSuggestions(false);
  };

  const handlePatientNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setPatientName(e.target.value);
      setPatientId('');
      setShowPatientSuggestions(true);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        
        <div className="bg-gray-100 px-4 py-3 flex justify-between items-center border-b border-gray-200">
           <span className="text-gray-500 text-sm font-medium">
             {initialData ? 'Editar Agendamento' : 'Novo Agendamento'}
           </span>
           <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 transition-colors">
             <X className="w-5 h-5 text-gray-500" />
           </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            
            <div>
              <div className="relative group">
                  <input
                    type="text"
                    placeholder="Adicionar título"
                    className="w-full text-2xl border-b-2 border-gray-200 focus:border-blue-600 focus:outline-none pb-2 placeholder-gray-400 text-gray-800 transition-colors pl-0 bg-transparent"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    autoFocus
                  />
                  {title && (
                    <button 
                        type="button" 
                        onClick={() => setTitle('')}
                        className="absolute right-0 top-1 text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                  )}
              </div>
              
              <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                     <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Serviços Rápidos
                     </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => {
                        const isSelected = selectedTags.includes(tag.label);
                        const isActive = isSelected || title === tag.label;

                        return (
                            <div
                                key={tag.id}
                                onClick={() => handleTagClick(tag.label)}
                                className={`group pl-3 pr-1 py-1.5 rounded-md text-xs font-semibold border transition-all duration-200 cursor-pointer select-none flex items-center gap-1.5 ${
                                    isActive
                                    ? 'ring-2 ring-offset-1 ring-blue-500 ' + tag.colorClass
                                    : tag.colorClass
                                }`}
                            >
                                <Tag className="w-3 h-3 opacity-50" />
                                <span>{tag.label}</span>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveTag(tag.id);
                                    }}
                                    className="p-0.5 rounded-full hover:bg-black/10 text-current opacity-60 hover:opacity-100 transition-all ml-1"
                                    title="Remover tarjeta"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        );
                    })}
                    
                    {!isCreatingTag ? (
                        <button
                            type="button"
                            onClick={() => setIsCreatingTag(true)}
                            className="px-3 py-1.5 rounded-md text-xs font-semibold border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-blue-600 hover:border-blue-300 transition-all flex items-center gap-1"
                        >
                            <Plus className="w-3 h-3" />
                            Nova Tarjeta
                        </button>
                    ) : (
                        <div className="w-full mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 animate-in fade-in slide-in-from-top-2">
                             <div className="flex gap-2 mb-3">
                                <input 
                                    type="text" 
                                    value={newTagLabel}
                                    onChange={(e) => setNewTagLabel(e.target.value)}
                                    placeholder="Nome do serviço"
                                    className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={handleCreateTag}
                                    className="bg-blue-600 text-white p-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
                                    disabled={!newTagLabel.trim()}
                                >
                                    <Check className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsCreatingTag(false)}
                                    className="bg-gray-200 text-gray-600 p-1.5 rounded hover:bg-gray-300"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                             </div>
                             
                             <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                {TAG_COLORS.map((color) => (
                                    <button
                                        key={color.name}
                                        type="button"
                                        onClick={() => setNewTagColor(color)}
                                        className={`w-6 h-6 rounded-full border flex-shrink-0 flex items-center justify-center transition-all ${color.class} ${newTagColor.name === color.name ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''}`}
                                        title={color.name}
                                    >
                                        {newTagColor.name === color.name && <Check className="w-3 h-3" />}
                                    </button>
                                ))}
                             </div>
                        </div>
                    )}
                  </div>
              </div>
            </div>

            <div className="flex items-start space-x-4">
               <Clock className="w-5 h-5 text-gray-400 mt-2" />
               <div className="flex-1 space-y-3">
                  <div className="flex items-center space-x-2">
                     <div className="relative flex-1">
                        <input 
                           type="date" 
                           value={date}
                           onChange={(e) => setDate(e.target.value)}
                           className="w-full bg-gray-50 hover:bg-gray-100 border-none rounded px-3 py-2 text-sm text-gray-700 font-medium focus:ring-0 cursor-pointer transition-colors"
                        />
                     </div>
                     <div className="relative w-28">
                         <input 
                           type="time" 
                           value={startTime}
                           onChange={(e) => setStartTime(e.target.value)}
                           className="w-full bg-gray-50 hover:bg-gray-100 border-none rounded px-3 py-2 text-sm text-gray-700 font-medium focus:ring-0 cursor-pointer transition-colors"
                        />
                     </div>
                     <span className="text-gray-400 text-sm">-</span>
                     <div className="relative w-28">
                         <input 
                           type="time" 
                           value={endTime}
                           onChange={(e) => setEndTime(e.target.value)}
                           className="w-full bg-gray-50 hover:bg-gray-100 border-none rounded px-3 py-2 text-sm text-gray-700 font-medium focus:ring-0 cursor-pointer transition-colors"
                        />
                     </div>
                  </div>
               </div>
            </div>

            <div className="flex items-start space-x-4 relative">
                <User className="w-5 h-5 text-gray-400 mt-2" />
                <div className="flex-1 relative">
                    <input 
                        ref={patientInputRef}
                        type="text" 
                        placeholder="Nome do Cliente" 
                        value={patientName}
                        onChange={handlePatientNameChange}
                        onFocus={() => setShowPatientSuggestions(true)}
                        className={`w-full bg-gray-50 hover:bg-gray-100 border-none rounded px-3 py-2 text-sm text-gray-700 placeholder-gray-500 focus:ring-2 focus:ring-blue-100 transition-all ${patientId ? 'pl-8' : ''}`}
                    />
                    
                    {patientId && (
                        <div className="absolute left-2.5 top-2.5 text-blue-500">
                             <Check className="w-4 h-4" />
                        </div>
                    )}

                    {showPatientSuggestions && (patientName.length > 0 || filteredPatients.length > 0) && (
                        <div 
                            ref={suggestionsRef}
                            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto"
                        >
                            {filteredPatients.length > 0 ? (
                                filteredPatients.map(patient => (
                                    <button
                                        key={patient.id}
                                        type="button"
                                        onClick={() => handleSelectPatient(patient)}
                                        className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors flex items-center justify-between group"
                                    >
                                        <div>
                                            <p className="text-sm font-medium text-gray-800 group-hover:text-blue-700">{patient.name}</p>
                                            <p className="text-xs text-gray-400">{patient.phone || 'Sem telefone'}</p>
                                        </div>
                                        {patientId === patient.id && <Check className="w-4 h-4 text-blue-500" />}
                                    </button>
                                ))
                            ) : (
                                <div className="px-4 py-3 text-center text-sm text-gray-400">
                                    <p>Nenhum cliente encontrado.</p>
                                    <p className="text-xs mt-1">Um novo cliente será criado.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-start space-x-4">
                <Briefcase className="w-5 h-5 text-gray-400 mt-2" />
                <div className="flex-1">
                    <select
                        value={selectedDoctorId}
                        onChange={(e) => setSelectedDoctorId(e.target.value)}
                        className="w-full bg-gray-50 hover:bg-gray-100 border-none rounded px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                    >
                        {doctors.filter(d => d.active).length === 0 ? (
                            <option value="">Nenhum profissional disponível</option>
                        ) : (
                            doctors.filter(d => d.active).map(doctor => (
                                <option key={doctor.id} value={doctor.id}>
                                    {doctor.name} - {doctor.specialty}
                                </option>
                            ))
                        )}
                    </select>
                </div>
            </div>

            <div className="flex items-start space-x-4">
                <AlignLeft className="w-5 h-5 text-gray-400 mt-2" />
                <div className="flex-1">
                    <textarea 
                        rows={3}
                        placeholder="Adicionar descrição ou observações"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full bg-gray-50 hover:bg-gray-100 border-none rounded px-3 py-2 text-sm text-gray-700 placeholder-gray-500 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
                    />
                </div>
            </div>

            <div className="flex items-center space-x-4 pt-2">
                <CalendarIcon className="w-5 h-5 text-gray-400" />
                <div className="flex items-center space-x-2 text-sm text-gray-600 bg-orange-50 px-3 py-1.5 rounded-md border border-orange-100 w-full">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    <span>Sincronização com Google Calendar (Em breve)</span>
                </div>
            </div>

          </div>
          
          <div className="p-4 border-t border-gray-100 flex justify-end space-x-3 bg-gray-50">
             <button 
                type="button" 
                className="px-5 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                onClick={onClose}
             >
                Cancelar
             </button>
             <button 
                type="submit" 
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all transform active:scale-95"
             >
                {initialData ? 'Atualizar' : 'Salvar'}
             </button>
          </div>
        </form>

      </div>
    </div>
  );
};
