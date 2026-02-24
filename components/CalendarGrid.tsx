
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
import { Sparkles, Clock, MoreHorizontal, MessageCircle, CheckCircle, CalendarOff } from 'lucide-react';
import type { AgendaBlock } from '../services/api';
import type { DoctorProfile } from '../types';

interface CalendarGridProps {
  currentDate: Date;
  viewMode: CalendarViewMode;
  appointments: Appointment[];
  onSelectAppointment: (apt: Appointment) => void;
  searchTerm: string;
  isReadOnly?: boolean;
  agendaBlocks?: AgendaBlock[];
  /** Dias da semana fechados por horário de atendimento (0=dom .. 6=sáb). Mesma indicação visual dos bloqueios de agenda. */
  closedWeekdays?: number[];
  doctors?: DoctorProfile[]; // Lista de profissionais para exibir nomes
}

function isDayBlocked(day: Date, blocks: AgendaBlock[], closedByHours?: number[]): boolean {
  if (closedByHours && closedByHours.length > 0 && closedByHours.includes(day.getDay())) return true;
  // Só mostrar bloqueio visual se for bloqueio da CLÍNICA INTEIRA (doctor_id = null)
  const active = (blocks || []).filter((b) => b.active && b.doctor_id === null);
  const yyyy = day.getFullYear();
  const mm = String(day.getMonth() + 1).padStart(2, '0');
  const dd = String(day.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;
  const weekday = day.getDay();
  for (const b of active) {
    if (b.block_type === 'weekdays' && Array.isArray(b.weekdays) && b.weekdays.includes(weekday)) return true;
    if (b.block_type === 'specific_date' && b.specific_date === dateStr) return true;
    if (b.block_type === 'date_range' && b.start_date && b.end_date && dateStr >= b.start_date && dateStr <= b.end_date) return true;
  }
  return false;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({ currentDate, viewMode, appointments, onSelectAppointment, searchTerm, isReadOnly = false, agendaBlocks, closedWeekdays, doctors = [] }) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Função auxiliar para pegar o nome do profissional
  const getDoctorName = (doctorId: string): string => {
    const doctor = doctors.find(d => d.id === doctorId);
    return doctor ? doctor.name : '';
  };

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
          <div className="flex flex-col h-full bg-white pb-20 md:pb-0">
              {/* Header Days */}
              <div className="grid grid-cols-7 border-b border-slate-200 flex-shrink-0">
                  {weekDays.map(day => (
                      <div key={day} className="py-1.5 md:py-2 text-center text-[10px] md:text-xs font-semibold text-slate-400">
                          {day}
                      </div>
                  ))}
              </div>
              
              {/* Month Grid */}
              <div className="flex-1 grid grid-cols-7 grid-rows-5 lg:grid-rows-6 auto-rows-fr min-h-0">
                  {calendarDays.map((day, idx) => {
                      const isCurrentMonth = isSameMonth(day, monthStart);
                      const isToday = isSameDay(day, now);
                      const dayAppointments = appointments
                        .filter(apt => isSameDay(apt.start, day))
                        .sort((a, b) => a.start.getTime() - b.start.getTime());

                      const blocked = isDayBlocked(day, agendaBlocks || [], closedWeekdays);
                      // Logic for background color of the cell
                      let bgClass = 'bg-white';
                      if (blocked) {
                        bgClass = 'bg-amber-50/70 border border-amber-200/60';
                      } else if (isToday) {
                        bgClass = 'bg-indigo-50/70 ring-1 ring-inset ring-indigo-200 z-10';
                      } else if (!isCurrentMonth) {
                        bgClass = 'bg-slate-50/50 text-slate-400';
                      }

                      return (
                          <div 
                            key={idx} 
                            className={`border-b border-r border-slate-100 p-1 md:p-2 min-h-[72px] md:min-h-[100px] flex flex-col relative group transition-colors hover:bg-slate-50 ${bgClass}`}
                          >
                              {/* Today Indicator Line (Top) - Optional extra highlight */}
                              {isToday && !blocked && <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500"></div>}
                              {blocked && <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-300/70" title="Dia bloqueado"></div>}

                              <div className="flex justify-between items-start mb-0.5 md:mb-1">
                                  <span className={`text-[10px] md:text-xs font-medium min-w-[28px] min-h-[28px] w-7 h-7 flex items-center justify-center rounded-full transition-all ${isToday && !blocked ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-110' : ''}`}>
                                      {format(day, 'd')}
                                  </span>
                                  {blocked && <CalendarOff className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" title="Dia bloqueado" aria-hidden />}
                                  {isToday && !blocked && <span className="text-[9px] md:text-[10px] font-bold text-indigo-600 uppercase tracking-wide mr-0.5">Hoje</span>}
                              </div>
                              
                              <div className="flex-1 space-y-0.5 md:space-y-1 overflow-hidden mt-0.5 md:mt-1 min-h-0">
                                  {dayAppointments.slice(0, 4).map(apt => {
                                      const { cardClasses, textClasses, borderAccent } = getAppointmentStyles(apt, 'month');
                                      const matches = isMatch(apt);
                                      const doctorName = getDoctorName(apt.doctorId);
                                      return (
                                          <button
                                              key={apt.id}
                                              onClick={(e) => { 
                                                  e.stopPropagation(); 
                                                  onSelectAppointment(apt);
                                              }}
                                              className={`w-full text-left px-1.5 py-1 md:py-0.5 rounded text-[9px] md:text-[10px] truncate flex items-center gap-1 min-h-[32px] md:min-h-0 transition-all ${cardClasses} ${matches ? 'opacity-100' : 'opacity-20'} cursor-pointer touch-manipulation`}
                                          >
                                              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${borderAccent.replace('bg-', 'bg-')}`}></div>
                                              <span className={`font-medium truncate flex-1 min-w-0 ${textClasses}`}>
                                                  {format(apt.start, 'HH:mm')} {apt.patientName}
                                                  {doctorName && <span className="text-[9px] opacity-70 ml-1">• {doctorName}</span>}
                                              </span>
                                              {apt.confirmedAt && <CheckCircle className="w-3 h-3 text-emerald-600 flex-shrink-0" aria-label="Cliente confirmou" />}
                                          </button>
                                      );
                                  })}
                                  {dayAppointments.length > 4 && (
                                      <div className="text-[9px] md:text-[10px] text-slate-400 font-medium pl-1 md:pl-2">
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
                    const blocked = isDayBlocked(day, agendaBlocks || [], closedWeekdays);
                    return (
                    <div key={i} className={`flex-1 text-center py-4 min-w-[120px] group border-l border-transparent transition-colors rounded-b-xl ${blocked ? 'bg-amber-50/80' : isToday ? 'bg-indigo-50/50' : 'hover:bg-slate-50/50'}`}>
                        <div className={`text-[11px] font-bold uppercase tracking-widest mb-1.5 ${blocked ? 'text-amber-700' : isToday ? 'text-indigo-700' : 'text-slate-400'}`}>
                        {format(day, 'EEE', { locale: ptBR })}
                        </div>
                        <div className={`text-2xl font-light w-11 h-11 mx-auto flex items-center justify-center rounded-full transition-all duration-300 ${blocked ? 'bg-amber-100 text-amber-800' : isToday ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-300 scale-110' : 'text-slate-600 group-hover:bg-white group-hover:shadow-sm group-hover:text-slate-900'}`}>
                        {format(day, 'd')}
                        </div>
                        {blocked && <div className="flex justify-center mt-1" title="Dia bloqueado"><CalendarOff className="w-3.5 h-3.5 text-amber-600" /></div>}
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
                                const blocked = isDayBlocked(day, agendaBlocks || [], closedWeekdays);
                                return (
                                    <div key={i} className={`flex-1 border-l border-slate-100/60 h-full relative ${blocked ? 'bg-amber-50/50' : isToday ? 'bg-indigo-50/40 ring-1 ring-inset ring-indigo-50' : ''}`}>
                                        {blocked && <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-300/70" title="Dia bloqueado"></div>}
                                        {isToday && !blocked && <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-200"></div>}
                                        
                                        {hours.map(h => (
                                            <div key={h} className={`border-b border-dashed w-full ${blocked ? 'border-amber-100/60' : isToday ? 'border-indigo-100/50' : 'border-slate-100'}`} style={{ height: `${cellHeight}px` }}></div>
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
                                
                                // Detectar agendamentos simultâneos (sobreposição de horários)
                                const appointmentsWithOverlap = dayAppointments.map((apt, idx) => {
                                    // Encontrar todos os agendamentos que se sobrepõem com este
                                    const overlapping = dayAppointments.filter((other, otherIdx) => {
                                        if (otherIdx === idx) return false;
                                        // Verificar se há sobreposição de horários
                                        return (apt.start < other.end && apt.end > other.start);
                                    });
                                    
                                    // Calcular posição horizontal (coluna)
                                    const columnIndex = overlapping.filter((other, otherIdx) => 
                                        dayAppointments.findIndex(a => a.id === other.id) < idx
                                    ).length;
                                    
                                    const totalColumns = overlapping.length + 1;
                                    
                                    return {
                                        ...apt,
                                        columnIndex,
                                        totalColumns
                                    };
                                });
                                
                                return (
                                    <div key={dayIndex} className="flex-1 relative h-full pointer-events-auto px-1">
                                        {appointmentsWithOverlap.map(apt => {
                                            const styles = getAppointmentStyles(apt, viewMode);
                                            // @ts-ignore
                                            const { style, cardClasses, textClasses, borderAccent } = styles;
                                            
                                            const matches = isMatch(apt);
                                            const opacityClass = matches ? 'opacity-100 scale-100 z-10' : 'opacity-20 grayscale scale-95 z-0';

                                            // Calcular largura e posição horizontal para agendamentos simultâneos
                                            const widthPercent = apt.totalColumns > 1 ? (100 / apt.totalColumns) : 100;
                                            const leftPercent = apt.totalColumns > 1 ? (apt.columnIndex * widthPercent) : 0;
                                            
                                            const positionStyle = {
                                                ...style,
                                                width: `${widthPercent - 1}%`, // -1% para gap
                                                left: `${leftPercent}%`,
                                                right: 'auto'
                                            };

                                            return (
                                                <button
                                                    key={apt.id}
                                                    onClick={() => onSelectAppointment(apt)}
                                                    // @ts-ignore
                                                    style={positionStyle}
                                                    className={`absolute rounded-xl text-left overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:z-30 cursor-pointer group ${cardClasses} ${opacityClass}`}
                                                >
                                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${borderAccent}`}></div>
                                                    <div className="pl-3 pr-2 py-2 h-full flex flex-col min-w-0">
                                                        {/* Linha 1: horário + nome do cliente + profissional (sempre visível, como na vista mensal) */}
                                                        <div className="flex items-center justify-between gap-1 mb-0.5 flex-shrink-0 min-w-0">
                                                            <span className={`text-[11px] font-semibold leading-tight truncate min-w-0 flex items-center gap-1 ${textClasses}`}>
                                                                <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                                                                {format(apt.start, 'HH:mm')} {apt.patientName}
                                                                {getDoctorName(apt.doctorId) && (
                                                                    <span className="text-[10px] opacity-85 font-medium">• {getDoctorName(apt.doctorId)}</span>
                                                                )}
                                                            </span>
                                                            <span className="flex items-center gap-0.5 flex-shrink-0">
                                                                {apt.source === 'chatbot' && (
                                                                    <div className="bg-white/50 rounded-full p-0.5 shadow-sm">
                                                                        <MessageCircle className="w-2.5 h-2.5 text-indigo-500" />
                                                                    </div>
                                                                )}
                                                                {apt.confirmedAt && (
                                                                    <CheckCircle className="w-3 h-3 text-emerald-600" title="Cliente confirmou pelo link" />
                                                                )}
                                                            </span>
                                                        </div>
                                                        {/* Linha 2: tipo (consulta, etc.) */}
                                                        <div className={`text-[11px] font-medium leading-tight truncate flex-shrink-0 text-slate-600/90 ${textClasses}`}>
                                                            {apt.title}
                                                        </div>

                                                        {/* Tags - só quando o bloco tem altura suficiente */}
                                                        {/* @ts-ignore */}
                                                        {parseInt(style?.height || 0) > 70 && apt.tags && apt.tags.length > 0 && (
                                                            <div className="mt-auto pt-1 flex flex-wrap gap-1 overflow-hidden max-h-5 content-end">
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
