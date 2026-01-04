
import React, { useState } from 'react';
import { X, UserPlus, Check, Trash2, Shield } from 'lucide-react';
import { DoctorProfile } from '../types';

interface SettingsModalProps {
  onClose: () => void;
  doctors: DoctorProfile[];
  onAddDoctor: (doctor: Omit<DoctorProfile, 'id' | 'active'>) => void;
  onRemoveDoctor: (id: string) => void;
}

const PRESET_COLORS = [
  { label: 'Azul', value: '#3b82f6' },
  { label: 'Verde', value: '#10b981' },
  { label: 'Roxo', value: '#8b5cf6' },
  { label: 'Rosa', value: '#ec4899' },
  { label: 'Laranja', value: '#f97316' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, doctors, onAddDoctor, onRemoveDoctor }) => {
  const [activeTab, setActiveTab] = useState<'doctors' | 'account'>('doctors');
  const [newDocName, setNewDocName] = useState('');
  const [newDocRole, setNewDocRole] = useState('');
  const [newDocColor, setNewDocColor] = useState(PRESET_COLORS[0].value);

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
                    <div className="text-center py-10 text-slate-400">
                        <Shield className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p>Configurações de conta não disponíveis nesta demo.</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
