
import React, { useState } from 'react';
import { X, Calendar, Clock, User, FileText, Sparkles, MessageCircle, Bot, WifiOff, Play, Edit3, Trash2, CheckCircle, AlertCircle, BrainCircuit } from 'lucide-react';
import { Appointment, AiAnalysisResult } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { analyzeAppointment } from '../services/geminiService';

interface AppointmentDetailsProps {
  appointment: Appointment | null;
  onClose: () => void;
  onUpdateStatus: (id: string, status: Appointment['status']) => void;
  onEdit: (appointment: Appointment) => void;
}

export const AppointmentDetails: React.FC<AppointmentDetailsProps> = ({ appointment, onClose, onUpdateStatus, onEdit }) => {
  const [analysis, setAnalysis] = useState<AiAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  if (!appointment) return null;

  const handleAiAnalysis = async () => {
    setLoading(true);
    const result = await analyzeAppointment(appointment);
    setAnalysis(result);
    setLoading(false);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
        case 'confirmed': return { label: 'Confirmado', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle };
        case 'pending': return { label: 'Pendente', bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertCircle };
        case 'cancelled': return { label: 'Cancelado', bg: 'bg-rose-100', text: 'text-rose-700', icon: X };
        case 'in_progress': return { label: 'Em Atendimento', bg: 'bg-purple-100', text: 'text-purple-700', icon: Play };
        default: return { label: status, bg: 'bg-slate-100', text: 'text-slate-700', icon: CheckCircle };
    }
  };

  const statusConfig = getStatusConfig(appointment.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-start bg-white sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
                {/* Badge curto (Confirmado, Pendente, etc.): oculto quando (confirmed+confirmedAt) ou quando cancelled (usamos o badge longo "Cancelado pelo cliente" em vez do curto) */}
                {!(appointment.status === 'confirmed' && appointment.confirmedAt) && appointment.status !== 'cancelled' && (
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5 ${statusConfig.bg} ${statusConfig.text}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusConfig.label}
                    </span>
                )}
                {appointment.confirmedAt && appointment.status !== 'cancelled' && (
                    <span className="flex items-center text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Confirmado pelo cliente em {format(new Date(appointment.confirmedAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </span>
                )}
                {appointment.status === 'cancelled' && (
                    <span className="flex items-center text-[11px] font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
                        <X className="w-3.5 h-3.5 mr-1" /> Cancelado pelo cliente{appointment.cancelledAt ? ` em ${format(new Date(appointment.cancelledAt), "dd/MM 'às' HH:mm", { locale: ptBR })}` : ''}
                    </span>
                )}
                {appointment.source === 'chatbot' && (
                    <span className="flex items-center text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                        <MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp
                    </span>
                )}
            </div>
            <h2 className="text-2xl font-bold text-slate-800 leading-tight">{appointment.title}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar">
          
          {/* Key Info Grid */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                        <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Data</p>
                        <p className="text-sm font-medium text-slate-800">
                            {format(appointment.start, "EEEE, d 'de' MMMM", { locale: ptBR })}
                        </p>
                    </div>
                </div>
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                         <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Horário</p>
                        <p className="text-sm font-medium text-slate-800">
                            {format(appointment.start, 'HH:mm')} - {format(appointment.end, 'HH:mm')}
                        </p>
                    </div>
                </div>
            </div>
            <div className="space-y-4">
                 <div className="flex items-start gap-3">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                         <User className="w-5 h-5" />
                    </div>
                    <div>
                         <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Cliente</p>
                        <p className="text-base font-bold text-slate-800">{appointment.patientName}</p>
                        <p className="text-xs text-slate-500 mt-0.5">ID: {appointment.patientId.slice(0, 6)}</p>
                    </div>
                </div>
            </div>
          </div>

          <div className="h-px bg-slate-100 w-full"></div>

          {/* Context & Notes */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-slate-400" />
                Resumo do Atendimento (WhatsApp)
            </h3>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-sm text-slate-600 leading-relaxed">
                "{appointment.notes}"
            </div>
          </div>

          {/* AI Analysis Section */}
          <div className="space-y-3">
             <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-indigo-600" />
                    Inteligência Proton
                </h3>
             </div>

             {!analysis ? (
                 <button 
                    onClick={handleAiAnalysis}
                    disabled={loading}
                    className="w-full group relative overflow-hidden rounded-xl bg-slate-900 p-px text-white shadow-xl shadow-indigo-200 transition-all hover:shadow-2xl hover:shadow-indigo-300 disabled:opacity-70 hover:-translate-y-0.5 active:translate-y-0"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-20 group-hover:opacity-30 transition-opacity animate-gradient" />
                    <div className="relative flex items-center justify-center gap-3 rounded-xl bg-slate-900 py-3.5 px-4 transition-all">
                         {loading ? (
                            <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                                <span className="font-semibold text-sm tracking-wide">Processando dados...</span>
                            </>
                         ) : (
                            <>
                                <Sparkles className="w-4 h-4 text-indigo-400" />
                                <span className="font-bold text-sm tracking-wide">Gerar Análise com Proton AI</span>
                            </>
                         )}
                    </div>
                 </button>
             ) : (
                 <div className={`rounded-xl border p-5 animate-in fade-in slide-in-from-bottom-2 duration-500 ${analysis.isMock ? 'bg-amber-50/50 border-amber-200' : 'bg-indigo-50/50 border-indigo-200'}`}>
                      <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-2">
                             <div className={`p-1.5 rounded-lg ${analysis.isMock ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                <BrainCircuit className="w-4 h-4" />
                             </div>
                             <div>
                                 <h4 className={`text-sm font-bold ${analysis.isMock ? 'text-amber-800' : 'text-indigo-900'}`}>Insights do Proton</h4>
                                 {analysis.isMock && <p className="text-[10px] text-amber-600 font-medium flex items-center"><WifiOff className="w-3 h-3 mr-1"/> Modo Offline</p>}
                             </div>
                          </div>
                          <button onClick={() => setAnalysis(null)} className="text-xs font-medium text-slate-400 hover:text-slate-600 underline">Resetar</button>
                      </div>

                      <div className="space-y-4">
                          <div className="bg-white/60 p-3 rounded-lg border border-white/50">
                               <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${analysis.isMock ? 'text-amber-700' : 'text-indigo-700'}`}>Resumo Clínico</p>
                               <p className="text-sm text-slate-700 leading-relaxed">{analysis.summary}</p>
                          </div>
                          <div>
                               <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${analysis.isMock ? 'text-amber-700' : 'text-indigo-700'}`}>Protocolo de Preparo Sugerido</p>
                               <ul className="space-y-2">
                                   {analysis.preparation.map((item, idx) => (
                                       <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                                           <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${analysis.isMock ? 'bg-amber-400' : 'bg-indigo-400'}`}></div>
                                           {item}
                                       </li>
                                   ))}
                               </ul>
                          </div>
                      </div>
                 </div>
             )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center sticky bottom-0 z-10">
            {appointment.status !== 'cancelled' && appointment.status !== 'completed' ? (
                 <button 
                    onClick={() => {
                        if (confirm('Tem certeza que deseja cancelar este agendamento?')) {
                            onUpdateStatus(appointment.id, 'cancelled');
                        }
                    }}
                    className="flex items-center px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Cancelar
                </button>
            ) : (
                <div />
            )}

            <div className="flex items-center gap-3">
                <button 
                    onClick={() => onEdit(appointment)}
                    className="flex items-center px-4 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:shadow-sm hover:text-slate-900 bg-transparent border border-transparent hover:border-slate-200 rounded-lg transition-all"
                >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Editar
                </button>
                
                {appointment.status !== 'in_progress' && appointment.status !== 'completed' && appointment.status !== 'cancelled' && (
                    <button 
                        onClick={() => onUpdateStatus(appointment.id, 'in_progress')}
                        className="flex items-center px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md shadow-indigo-200 transition-all hover:-translate-y-0.5"
                    >
                        <Play className="w-4 h-4 mr-2 fill-current" />
                        Iniciar
                    </button>
                )}
                
                {appointment.status === 'in_progress' && (
                    <button 
                         onClick={() => onUpdateStatus(appointment.id, 'completed')}
                         className="flex items-center px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-md shadow-emerald-200 transition-all hover:-translate-y-0.5"
                    >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Finalizar
                    </button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
