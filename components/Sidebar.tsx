
import React from 'react';
import { Calendar, Users, BarChart2, Settings, Plus, CalendarClock, LogOut, Shield } from 'lucide-react';
import { DoctorProfile, User } from '../types';

interface SidebarProps {
  user: User | null;
  onCreateClick: (type: 'event' | 'task' | 'appointment') => void;
  currentView: 'calendar' | 'patients' | 'reports';
  onViewChange: (view: 'calendar' | 'patients' | 'reports') => void;
  doctors: DoctorProfile[];
  onToggleDoctor: (id: string) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onOpenAdminPanel?: () => void;
  isReadOnly?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  user,
  onCreateClick, 
  currentView, 
  onViewChange, 
  doctors, 
  onToggleDoctor,
  onOpenSettings,
  onLogout,
  onOpenAdminPanel,
  isReadOnly = false
}) => {
  
  return (
    <div className="w-[280px] h-full bg-white flex flex-col hidden md:flex z-30 border-r border-slate-100 shadow-[2px_0_20px_rgba(0,0,0,0.01)]">
      {/* Brand */}
      <div className="px-6 py-8 flex items-center space-x-3">
        <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
          <CalendarClock className="w-6 h-6" />
        </div>
        <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">Proton</h1>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-wide uppercase truncate max-w-[140px]">
              {user?.clinicName || 'Agendamento'}
            </p>
        </div>
      </div>

      {/* CTA Button */}
      <div className="px-5 mb-8">
        <button 
          onClick={() => onCreateClick('appointment')}
          disabled={isReadOnly}
          className={`w-full ${isReadOnly ? 'bg-slate-300 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800'} text-white shadow-xl shadow-slate-200 rounded-xl py-3.5 px-4 flex items-center justify-center space-x-3 transition-all duration-200 group ${!isReadOnly ? 'active:scale-[0.98]' : ''}`}
          title={isReadOnly ? 'Modo visualização - não é possível criar agendamentos' : 'Criar novo agendamento'}
        >
            <Plus className="w-5 h-5 text-indigo-300" />
            <span className="font-semibold text-[15px]">Novo Agendamento</span>
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 space-y-1 custom-scrollbar">
        <p className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 mt-2">Menu Principal</p>
        <NavItem 
          icon={<Calendar className="w-5 h-5" />} 
          label="Agenda" 
          active={currentView === 'calendar'}
          onClick={() => onViewChange('calendar')}
        />
        <NavItem 
          icon={<Users className="w-5 h-5" />} 
          label="Clientes" 
          active={currentView === 'patients'}
          onClick={() => onViewChange('patients')}
        />
        <NavItem 
          icon={<BarChart2 className="w-5 h-5" />} 
          label="Relatórios" 
          active={currentView === 'reports'}
          onClick={() => onViewChange('reports')}
        />

        <div className="mt-8 mb-6 px-2">
             <div className="h-px bg-slate-100 w-full"></div>
        </div>

        {/* Admin Panel Button */}
        {user?.isAdmin && onOpenAdminPanel && (
            <>
                <button
                    onClick={() => onOpenAdminPanel()}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-all font-medium mb-6"
                >
                    <Shield className="w-5 h-5" />
                    <span className="text-sm">Admin Master</span>
                </button>
                <div className="mb-6 px-2">
                     <div className="h-px bg-slate-100 w-full"></div>
                </div>
            </>
        )}
        
        <div className="flex items-center justify-between px-2 mb-3">
             <p className="px-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Profissionais</p>
             <button onClick={onOpenSettings} className="p-1 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50 transition-colors">
                 <Settings className="w-3.5 h-3.5" />
             </button>
        </div>
        
        <div className="space-y-2">
            {doctors.map((doc) => (
                <label key={doc.id} className="flex items-start space-x-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 rounded-xl transition-all duration-200 group border border-transparent hover:border-slate-100">
                    <div className="relative mt-1">
                        <input 
                            type="checkbox" 
                            checked={doc.active} 
                            onChange={() => onToggleDoctor(doc.id)}
                            className="peer appearance-none w-4 h-4 rounded border border-slate-300 checked:bg-indigo-600 checked:border-indigo-600 focus:ring-offset-0 focus:ring-0 transition-all cursor-pointer" 
                        />
                        <svg className="absolute top-1 left-1 w-2 h-2 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 12 12" fill="none">
                             <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </div>
                    
                    <div className="flex items-start gap-3 overflow-hidden w-full">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-sm" style={{ backgroundColor: doc.active ? doc.color : '#cbd5e1' }}>
                            {doc.name.substring(0,2).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1 justify-center h-8">
                            <span className={`text-sm font-semibold leading-none transition-colors truncate ${doc.active ? 'text-slate-700' : 'text-slate-400'}`}>
                                {doc.name}
                            </span>
                            <span className={`text-[11px] mt-1 transition-colors truncate ${doc.active ? 'text-slate-500' : 'text-slate-300'}`}>
                                {doc.specialty}
                            </span>
                        </div>
                    </div>
                </label>
            ))}
            
            {doctors.length === 0 && (
                <p className="text-xs text-slate-400 px-3 italic">Nenhum profissional configurado</p>
            )}
        </div>
      </div>

      <div className="p-5 border-t border-slate-100 space-y-2">
        <button 
            onClick={onOpenSettings}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all font-medium"
        >
             <Settings className="w-5 h-5" />
             <span className="text-sm">Configurações</span>
        </button>
        <button 
            onClick={onLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all font-medium"
        >
             <LogOut className="w-5 h-5" />
             <span className="text-sm">Sair da Conta</span>
        </button>
      </div>
    </div>
  );
};

const NavItem: React.FC<{ icon: React.ReactNode; label: string; active?: boolean; badge?: string; onClick?: () => void }> = ({ icon, label, active, badge, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-[14px] font-medium transition-all duration-200 group relative overflow-hidden ${
      active
        ? 'bg-indigo-50 text-indigo-700'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`}
  >
    {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600"></div>}
    <div className="flex items-center space-x-3">
        <span className={`transition-colors duration-200 ${active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
            {icon}
        </span>
        <span>{label}</span>
    </div>
    {badge && (
        <span className="bg-rose-100 text-rose-600 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            {badge}
        </span>
    )}
  </button>
);
