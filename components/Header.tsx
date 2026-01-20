
import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, HelpCircle, ChevronLeft, ChevronRight, Calendar, Check, X, MessageSquare, BookOpen, Keyboard, ExternalLink, LifeBuoy, Info, LayoutList, Columns } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppNotification, CalendarViewMode, User } from '../types';

interface HeaderProps {
    user: User | null;
    currentDate: Date;
    viewMode?: CalendarViewMode;
    onViewModeChange?: (mode: CalendarViewMode) => void;
    onPrev: () => void;
    onNext: () => void;
    onToday: () => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    notifications: AppNotification[];
    onMarkAllRead: () => void;
    onClearNotifications: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
    user,
    currentDate, 
    viewMode = 'week',
    onViewModeChange,
    onPrev, 
    onNext, 
    onToday, 
    searchTerm, 
    onSearchChange,
    notifications,
    onMarkAllRead,
    onClearNotifications
}) => {
  const monthName = format(currentDate, 'MMMM', { locale: ptBR });
  const year = format(currentDate, 'yyyy');

  // State for Dropdowns/Modals
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleClearNotifications = () => {
    onClearNotifications();
    setIsNotifOpen(false);
  };

  const getNotificationIcon = (type: string) => {
      switch(type) {
          case 'success': return <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-full"><Check className="w-3 h-3" /></div>;
          case 'alert': return <div className="p-1.5 bg-rose-100 text-rose-600 rounded-full"><Info className="w-3 h-3" /></div>;
          case 'warning': return <div className="p-1.5 bg-amber-100 text-amber-600 rounded-full"><Info className="w-3 h-3" /></div>;
          default: return <div className="p-1.5 bg-blue-100 text-blue-600 rounded-full"><MessageSquare className="w-3 h-3" /></div>;
      }
  };

  const getCurrentLabel = () => {
      switch (viewMode) {
          case 'month': return 'Este Mês';
          case 'week': return 'Esta Semana';
          default: return 'Hoje';
      }
  };

  return (
    <>
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-8 z-20 sticky top-0 transition-all">
        
        {/* Left: Date Navigation */}
        <div className="flex items-center gap-6">
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                <button 
                    onClick={onPrev} 
                    className="p-2 rounded-lg hover:bg-slate-50 text-slate-500 hover:text-indigo-600 transition-all active:scale-95"
                    title="Anterior"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                    onClick={onToday}
                    className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-all min-w-[80px]"
                >
                    {getCurrentLabel()}
                </button>
                <button 
                    onClick={onNext} 
                    className="p-2 rounded-lg hover:bg-slate-50 text-slate-500 hover:text-indigo-600 transition-all active:scale-95"
                    title="Próximo"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            <div className="flex items-baseline gap-2 min-w-[200px]">
                <h1 className="text-2xl font-bold text-slate-800 capitalize tracking-tight leading-none">
                    {monthName}
                </h1>
                <span className="text-2xl font-light text-slate-400 leading-none">{year}</span>
            </div>
            
            {onViewModeChange && (
                <div className="hidden lg:flex items-center bg-slate-100/50 p-1 rounded-lg border border-slate-200 ml-4">
                    <button 
                        onClick={() => onViewModeChange('day')}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${viewMode === 'day' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <LayoutList className="w-3.5 h-3.5" /> Dia
                    </button>
                    <button 
                        onClick={() => onViewModeChange('week')}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${viewMode === 'week' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Columns className="w-3.5 h-3.5" /> Semana
                    </button>
                    <button 
                        onClick={() => onViewModeChange('month')}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${viewMode === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Calendar className="w-3.5 h-3.5" /> Mês
                    </button>
                </div>
            )}
        </div>

        {/* Right: Actions & Search */}
        <div className="flex items-center gap-6">
            
            {/* Search Bar */}
            <div className="hidden md:flex items-center relative group">
                <div className="absolute left-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none">
                    <Search className="w-4 h-4" />
                </div>
                <input 
                    type="text" 
                    placeholder="Buscar (ex: Nome, Procedimento)..." 
                    className="bg-slate-50 border-transparent hover:bg-slate-100 focus:bg-white border focus:border-indigo-200 rounded-full pl-11 pr-5 py-2.5 w-64 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-50/50 transition-all shadow-sm"
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>

            <div className="h-8 w-px bg-slate-100"></div>

            <div className="flex items-center gap-3 relative">
                {/* Notification Bell */}
                <div ref={notifRef} className="relative">
                    <button 
                        onClick={() => setIsNotifOpen(!isNotifOpen)}
                        className={`p-2.5 rounded-full text-slate-500 transition-colors border relative ${isNotifOpen ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'hover:bg-slate-50 hover:text-indigo-600 border-transparent hover:border-slate-100'}`}
                    >
                        <Bell className="w-5 h-5" />
                        {unreadCount > 0 && (
                            <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
                        )}
                    </button>

                    {/* Notification Dropdown */}
                    {isNotifOpen && (
                        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                            <div className="p-3 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                <h3 className="text-sm font-bold text-slate-700">Notificações</h3>
                                {unreadCount > 0 && (
                                    <button onClick={onMarkAllRead} className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-700">
                                        Marcar lidas
                                    </button>
                                )}
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400">
                                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                        <p className="text-xs">Nenhuma notificação</p>
                                    </div>
                                ) : (
                                    notifications.map(notif => (
                                        <div key={notif.id} className={`p-3 border-b border-slate-50 hover:bg-slate-50 transition-colors flex gap-3 ${notif.read ? 'opacity-60' : 'bg-indigo-50/30'}`}>
                                            <div className="mt-1">{getNotificationIcon(notif.type)}</div>
                                            <div className="flex-1">
                                                <p className="text-xs font-bold text-slate-800">{notif.title}</p>
                                                <p className="text-xs text-slate-500 mt-0.5 leading-snug">{notif.message}</p>
                                                <p className="text-[10px] text-slate-400 mt-1.5">{notif.time}</p>
                                            </div>
                                            {!notif.read && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2"></div>}
                                        </div>
                                    ))
                                )}
                            </div>
                            {notifications.length > 0 && (
                                <button 
                                    onClick={handleClearNotifications}
                                    className="w-full py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-rose-600 transition-colors border-t border-slate-50"
                                >
                                    Limpar tudo
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Help Button */}
                <button 
                    onClick={() => setIsHelpOpen(true)}
                    className="p-2.5 rounded-full text-slate-500 hover:bg-slate-50 hover:text-indigo-600 transition-colors border border-transparent hover:border-slate-100"
                >
                    <HelpCircle className="w-5 h-5" />
                </button>
            </div>

            {/* Profile */}
            <div className="flex items-center gap-3 pl-2 cursor-pointer group">
                <div className="text-right hidden lg:block">
                    <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                        {user?.name || 'Profissional'}
                    </p>
                    <p className="text-xs font-medium text-slate-500">Especialista</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-pink-200 ring-2 ring-white group-hover:ring-rose-100 transition-all">
                    {user?.name.substring(0, 2).toUpperCase() || 'P'}
                </div>
            </div>
        </div>
        </header>

        {/* Help Modal Overlay */}
        {isHelpOpen && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                {/* Backdrop Click Handler */}
                <div className="absolute inset-0" onClick={() => setIsHelpOpen(false)}></div>
                
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200 overflow-hidden relative z-10">
                    <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6 text-white relative">
                        <button 
                            onClick={() => setIsHelpOpen(false)}
                            className="absolute right-4 top-4 p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <HelpCircle className="w-10 h-10 mb-3 opacity-80" />
                        <h2 className="text-xl font-bold">Central de Ajuda</h2>
                        <p className="text-indigo-100 text-sm mt-1">Como podemos te ajudar hoje?</p>
                    </div>
                    
                    <div className="p-2">
                        <button 
                            onClick={() => window.open('https://google.com', '_blank')}
                            className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-xl transition-colors group text-left"
                        >
                            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <BookOpen className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-bold text-slate-800">Documentação</h3>
                                <p className="text-xs text-slate-500">Guias passo-a-passo do sistema.</p>
                            </div>
                            <ExternalLink className="w-4 h-4 text-slate-300" />
                        </button>
                        
                        <button 
                            onClick={() => {
                                const whatsappNumber = '554396368352'; // +55 43 9636-8352 sem formatação
                                const whatsappUrl = `https://wa.me/${whatsappNumber}`;
                                window.open(whatsappUrl, '_blank');
                            }}
                            className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-xl transition-colors group text-left"
                        >
                            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <LifeBuoy className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-bold text-slate-800">Suporte Técnico</h3>
                                <p className="text-xs text-slate-500">Falar com um atendente humano.</p>
                            </div>
                            <ExternalLink className="w-4 h-4 text-slate-300" />
                        </button>

                        <button 
                            onClick={() => alert("Atalhos:\nN - Novo Agendamento\n/ - Buscar")}
                            className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-xl transition-colors group text-left"
                        >
                            <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Keyboard className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-bold text-slate-800">Atalhos de Teclado</h3>
                                <p className="text-xs text-slate-500">Agilize seu fluxo de trabalho.</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300" />
                        </button>
                    </div>
                    
                    <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
                        <p className="text-[10px] text-slate-400 font-medium">CliniCal AI v1.0.2 • Build 2024</p>
                    </div>
                </div>
            </div>
        )}
    </>
  );
};
