
import React, { useEffect, useState } from 'react';
import { 
    addDays, 
    format, 
    isSameDay, 
    startOfWeek, 
    isSameMonth, 
    startOfMonth, 
    endOfMonth, 
    endOfWeek, 
    eachDayOfInterval 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Appointment, CalendarViewMode } from '../types';
import { HOURS_OF_OPERATION } from '../constants';
import { Sparkles, Clock, MoreHorizontal, MessageCircle, CheckCircle } from 'lucide-react';

interface CalendarGridProps {
  currentDate: Date;
  viewMode: CalendarViewMode;
  appointments: Appointment[];
  onSelectAppointment: (apt: Appointment) => void;
  searchTerm: string;
  isReadOnly?: boolean;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({ currentDate, viewMode, appointments, onSelectAppointment, searchTerm, isReadOnly = false }) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const getAppointmentStyles = (apt: Appointment, mode: CalendarViewMode) => {
    // Styles vary slightly based on view mode (compact vs full)
    let cardClasses = '';
    let textClasses = '';
    let timeClasses = '';
    let borderAccent = '';

    if (apt.status === 'cancelled') {
        cardClasses = 'bg-slate-50/80 grayscale opacity-70 border border-slate-200';
        textClasses = 'text-slate-500 line-through';
        borderAccent = 'bg-slate-300';
    } else if (apt.status === 'in_progress') {
        cardClasses = 'bg-purple-50 border border-purple-100';
        textClasses = 'text-purple-900';
        borderAccent = 'bg-purple-500';
    } else if (apt.source === 'chatbot') {
        if (apt.status === 'pending') {
            cardClasses = 'bg-amber-50 border border-amber-100';
            textClasses = 'text-amber-900';
            borderAccent = 'bg-amber-400';
        } else {
            cardClasses = 'bg-indigo-50 border border-indigo-100';
            textClasses = 'text-indigo-900';
            borderAccent = 'bg-indigo-500';
        }
    } else {
        cardClasses = 'bg-emerald-50 border border-emerald-100';
        textClasses = 'text-emerald-900';
        borderAccent = 'bg-emerald-500';
    }

    // Apply specific overrides for month view (more compact)
    if (mode === 'month') {
        return { cardClasses, textClasses, borderAccent };
    }

    // Styles for Week/Day view (positioning based on time)
    const cellHeight = 96;
    const startHour = apt.start.getHours() + apt.start.getMinutes() / 60;
    const endHour = apt.end.getHours() + apt.end.getMinutes() / 60;
    const duration = endHour - startHour;
    const top = (startHour - HOURS_OF_OPERATION.start) * cellHeight;
    const height = duration * cellHeight;

    return {
      style: { top: `${top}px`, height: `${height}px` },
      cardClasses: `${cardClasses} shadow-sm backdrop-blur-sm`,
      textClasses,
      timeClasses,
      borderAccent
    };
  };

  const isMatch = (apt: Appointment) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
        apt.patientName.toLowerCase().includes(term) ||
        apt.title.toLowerCase().includes(term) ||
        (apt.tags && apt.tags.some(tag => tag.toLowerCase().includes(term)))
    );
  };

  // --- RENDERERS ---

  const renderMonthView = () => {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(monthStart);
      const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
      const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
      const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

      const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

      return (
          <div className="flex flex-col h-full bg-white">
              {/* Header Days */}
              <div className="grid grid-cols-7 border-b border-slate-200">
                  {weekDays.map(day => (
                      <div key={day} className="py-2 text-center text-xs font-semibold text-slate-400">
                          {day}
                      </div>
                  ))}
              </div>
              
              {/* Month Grid */}
              <div className="flex-1 grid grid-cols-7 grid-rows-5 lg:grid-rows-6 auto-rows-fr">
                  {calendarDays.map((day, idx) => {
                      const isCurrentMonth = isSameMonth(day, monthStart);
                      const isToday = isSameDay(day, now);
                      const dayAppointments = appointments
                        .filter(apt => isSameDay(apt.start, day))
                        .sort((a, b) => a.start.getTime() - b.start.getTime());

                      // Logic for background color of the cell
                      let bgClass = 'bg-white';
                      if (!isCurrentMonth) bgClass = 'bg-slate-50/50 text-slate-400';
                      if (isToday) bgClass = 'bg-indigo-50/70 ring-1 ring-inset ring-indigo-200 z-10';

                      return (
                          <div 
                            key={idx} 
                            className={`border-b border-r border-slate-100 p-2 min-h-[100px] flex flex-col relative group transition-colors hover:bg-slate-50 ${bgClass}`}
                          >
                              {/* Today Indicator Line (Top) - Optional extra highlight */}
                              {isToday && <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500"></div>}

                              <div className="flex justify-between items-start mb-1">
                                  <span className={`text-xs font-medium w-7 h-7 flex items-center justify-center rounded-full transition-all ${isToday ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-110' : ''}`}>
                                      {format(day, 'd')}
                                  </span>
                                  {isToday && <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide mr-1">Hoje</span>}
                              </div>
                              
                              <div className="flex-1 space-y-1 overflow-hidden mt-1">
                                  {dayAppointments.slice(0, 4).map(apt => {
                                      const { cardClasses, textClasses, borderAccent } = getAppointmentStyles(apt, 'month');
                                      const matches = isMatch(apt);
                                      return (
                                          <button
                                              key={apt.id}
                                              onClick={(e) => { 
                                                  if (!isReadOnly) {
                                                      e.stopPropagation(); 
                                                      onSelectAppointment(apt);
                                                  }
                                              }}
                                              className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] truncate flex items-center gap-1 transition-all ${cardClasses} ${matches ? 'opacity-100' : 'opacity-20'} ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
                                          >
                                              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${borderAccent.replace('bg-', 'bg-')}`}></div>
                                              <span className={`font-medium truncate flex-1 min-w-0 ${textClasses}`}>
                                                  {format(apt.start, 'HH:mm')} {apt.patientName}
                                              </span>
                                              {apt.confirmedAt && <CheckCircle className="w-3 h-3 text-emerald-600 flex-shrink-0" aria-label="Paciente confirmou" />}
                                          </button>
                                      );
                                  })}
                                  {dayAppointments.length > 4 && (
                                      <div className="text-[10px] text-slate-400 font-medium pl-2">
                                          + {dayAppointments.length - 4} mais
                                      </div>
                                  )}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  const renderTimeGridView = (daysToShow: number) => {
    const start = viewMode === 'day' ? currentDate : startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekDays = Array.from({ length: daysToShow }).map((_, i) => addDays(start, i));
    const hours = Array.from({ length: HOURS_OF_OPERATION.end - HOURS_OF_OPERATION.start + 1 }).map((_, i) => HOURS_OF_OPERATION.start + i);
    const cellHeight = 96;
    
    const currentTimeTop = (now.getHours() + now.getMinutes() / 60 - HOURS_OF_OPERATION.start) * cellHeight;
    const isWithinHours = now.getHours() >= HOURS_OF_OPERATION.start && now.getHours() <= HOURS_OF_OPERATION.end;

    return (
        <div className="flex flex-col h-full bg-slate-50/30 overflow-hidden">
            {/* Header Row */}
            <div className={`flex border-b border-slate-200 bg-white z-20 shadow-[0_2px_8px_rgba(0,0,0,0.02)] ${viewMode === 'day' ? 'pl-20 pr-4' : 'pl-16 pr-4'}`}> 
                <div className="flex-1 flex overflow-hidden">
                {weekDays.map((day, i) => {
                    const isToday = isSameDay(day, now);
                    return (
                    <div key={i} className={`flex-1 text-center py-4 min-w-[120px] group border-l border-transparent transition-colors rounded-b-xl ${isToday ? 'bg-indigo-50/50' : 'hover:bg-slate-50/50'}`}>
                        <div className={`text-[11px] font-bold uppercase tracking-widest mb-1.5 ${isToday ? 'text-indigo-700' : 'text-slate-400'}`}>
                        {format(day, 'EEE', { locale: ptBR })}
                        </div>
                        <div className={`text-2xl font-light w-11 h-11 mx-auto flex items-center justify-center rounded-full transition-all duration-300 ${isToday ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-300 scale-110' : 'text-slate-600 group-hover:bg-white group-hover:shadow-sm group-hover:text-slate-900'}`}>
                        {format(day, 'd')}
                        </div>
                    </div>
                    );
                })}
                </div>
            </div>

            {/* Grid Area */}
            <div className="flex-1 overflow-y-auto relative custom-scrollbar">
                <div className="flex relative min-h-[960px] pr-4"> 
                    
                    {/* Time Sidebar */}
                    <div className="w-16 flex-shrink-0 bg-transparent sticky left-0 z-10 select-none flex flex-col items-end pr-3 pt-2">
                        {hours.map((hour) => (
                        <div key={hour} className="relative w-full text-right" style={{ height: `${cellHeight}px` }}>
                            <span className="text-xs font-semibold text-slate-400 block -mt-2">
                            {String(hour).padStart(2, '0')}:00
                            </span>
                        </div>
                        ))}
                    </div>

                    {/* Columns */}
                    <div className="flex-1 flex relative">
                        {/* Background Grid Lines */}
                        <div className="absolute inset-0 flex">
                            {weekDays.map((day, i) => {
                                const isToday = isSameDay(day, now);
                                return (
                                    <div key={i} className={`flex-1 border-l border-slate-100/60 h-full relative ${isToday ? 'bg-indigo-50/40 ring-1 ring-inset ring-indigo-50' : ''}`}>
                                        {/* Optional top highlight line for today column */}
                                        {isToday && <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-200"></div>}
                                        
                                        {hours.map(h => (
                                            <div key={h} className={`border-b border-dashed w-full ${isToday ? 'border-indigo-100/50' : 'border-slate-100'}`} style={{ height: `${cellHeight}px` }}></div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Current Time Indicator */}
                        {isWithinHours && (
                            <div 
                                className="absolute left-0 right-0 z-10 pointer-events-none flex items-center"
                                style={{ top: `${currentTimeTop}px` }}
                            >
                                <div className="absolute -left-1.5 w-3 h-3 bg-rose-500 rounded-full ring-2 ring-white shadow-sm z-20"></div>
                                <div className="w-full h-px bg-rose-500 shadow-[0_1px_4px_rgba(244,63,94,0.4)] z-10"></div>
                            </div>
                        )}

                        {/* Appointments Overlay */}
                        <div className="absolute inset-0 flex pointer-events-none">
                            {weekDays.map((day, dayIndex) => {
                                const dayAppointments = appointments.filter(apt => isSameDay(apt.start, day));
                                
                                return (
                                    <div key={dayIndex} className="flex-1 relative h-full pointer-events-auto px-1">
                                        {dayAppointments.map(apt => {
                                            const styles = getAppointmentStyles(apt, viewMode);
                                            // @ts-ignore
                                            const { style, cardClasses, textClasses, borderAccent } = styles;
                                            
                                            const matches = isMatch(apt);
                                            const opacityClass = matches ? 'opacity-100 scale-100 z-10' : 'opacity-20 grayscale scale-95 z-0';

                                            return (
                                                <button
                                                    key={apt.id}
                                                    onClick={() => {
                                                        if (!isReadOnly) {
                                                            onSelectAppointment(apt);
                                                        }
                                                    }}
                                                    disabled={isReadOnly}
                                                    // @ts-ignore
                                                    style={style}
                                                    className={`absolute left-1 right-1 rounded-xl text-left overflow-hidden transition-all duration-300 ${isReadOnly ? 'cursor-default' : 'hover:shadow-lg hover:-translate-y-1 hover:z-30 cursor-pointer'} group ${cardClasses} ${opacityClass}`}
                                                >
                                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${borderAccent}`}></div>
                                                    <div className="pl-3 pr-2 py-2 h-full flex flex-col">
                                                        <div className="flex items-center justify-between mb-0.5 flex-shrink-0">
                                                            <span className={`text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 text-slate-500/80`}>
                                                                <Clock className="w-2.5 h-2.5" />
                                                                {format(apt.start, 'HH:mm')}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                {apt.source === 'chatbot' && (
                                                                    <div className="bg-white/50 rounded-full p-0.5 shadow-sm">
                                                                        <MessageCircle className="w-2.5 h-2.5 text-indigo-500" />
                                                                    </div>
                                                                )}
                                                                {apt.confirmedAt && (
                                                                    <CheckCircle className="w-3 h-3 text-emerald-600 flex-shrink-0" title="Paciente confirmou pelo link" />
                                                                )}
                                                            </span>
                                                        </div>
                                                        
                                                        <div className={`text-[13px] font-bold leading-tight mb-0.5 truncate flex-shrink-0 ${textClasses}`}>
                                                            {apt.title}
                                                        </div>
                                                        
                                                        <div className="text-[11px] text-slate-600/90 truncate font-medium flex-shrink-0">
                                                            {apt.patientName}
                                                        </div>

                                                        {/* Tags */}
                                                        {/* @ts-ignore */}
                                                        {parseInt(style.height) > 60 && apt.tags && apt.tags.length > 0 && (
                                                            <div className="mt-auto pt-1 flex flex-wrap gap-1 overflow-hidden h-6 content-end">
                                                                {apt.tags.slice(0, 3).map(tag => (
                                                                    <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-white/60 rounded-md text-slate-700 font-semibold border border-black/5 shadow-sm backdrop-blur-md">
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  if (viewMode === 'month') {
      return renderMonthView();
  }

  return renderTimeGridView(viewMode === 'day' ? 1 : 7);
};
