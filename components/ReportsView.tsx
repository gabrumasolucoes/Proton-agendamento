import React, { useState, useMemo } from 'react';
import { 
  BarChart, 
  PieChart, 
  TrendingUp, 
  Users, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter
} from 'lucide-react';
import { Appointment } from '../types';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear, 
  eachDayOfInterval, 
  eachMonthOfInterval,
  isSameDay, 
  isSameMonth, 
  addMonths, 
  subMonths,
  addWeeks, 
  subWeeks,
  addYears,
  subYears,
  isWithinInterval
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReportsViewProps {
  appointments: Appointment[];
}

type TimeRange = 'week' | 'month' | 'year';

export const ReportsView: React.FC<ReportsViewProps> = ({ appointments }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  // 1. Calculate Date Range
  const dateRange = useMemo(() => {
    switch (timeRange) {
      case 'week':
        return { start: startOfWeek(currentDate, { weekStartsOn: 0 }), end: endOfWeek(currentDate, { weekStartsOn: 0 }) };
      case 'month':
        return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
      case 'year':
        return { start: startOfYear(currentDate), end: endOfYear(currentDate) };
    }
  }, [timeRange, currentDate]);

  // 2. Filter Appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => 
      isWithinInterval(apt.start, dateRange) && apt.status !== 'cancelled'
    );
  }, [appointments, dateRange]);

  const cancelledAppointments = useMemo(() => {
    return appointments.filter(apt => 
        isWithinInterval(apt.start, dateRange) && apt.status === 'cancelled'
      ).length;
  }, [appointments, dateRange]);

  // 3. Aggregate Data for Charts

  // A. Procedure Distribution (Pie Chart Data)
  const procedureStats = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredAppointments.forEach(apt => {
      const key = apt.title;
      counts[key] = (counts[key] || 0) + 1;
    });
    
    // Sort and take top 5 + Others
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5).reduce((acc, curr) => acc + curr[1], 0);
    
    if (others > 0) top5.push(['Outros', others]);
    
    const total = filteredAppointments.length;
    return top5.map(([label, value], index) => ({
      label,
      value,
      percentage: total > 0 ? (value / total) * 100 : 0,
      color: [
        '#3b82f6', // blue-500
        '#10b981', // emerald-500
        '#8b5cf6', // violet-500
        '#f59e0b', // amber-500
        '#ef4444', // red-500
        '#9ca3af'  // gray-400
      ][index % 6]
    }));
  }, [filteredAppointments]);

  // B. Timeline Data (Bar Chart Data)
  const timelineStats = useMemo(() => {
    let intervals: Date[];
    let formatStr: string;
    let isSame: (d1: Date, d2: Date) => boolean;

    if (timeRange === 'year') {
      intervals = eachMonthOfInterval(dateRange);
      formatStr = 'MMM';
      isSame = isSameMonth;
    } else {
      intervals = eachDayOfInterval(dateRange);
      formatStr = 'dd'; // Just the day number for month view to save space
      if (timeRange === 'week') formatStr = 'EEE'; // Weekday name
      isSame = isSameDay;
    }

    // Find max value for scaling
    let maxCount = 0;

    const stats = intervals.map(date => {
      const count = filteredAppointments.filter(apt => isSame(apt.start, date)).length;
      if (count > maxCount) maxCount = count;
      return {
        label: format(date, formatStr, { locale: ptBR }),
        fullLabel: format(date, "d 'de' MMMM", { locale: ptBR }),
        fullDate: date,
        count
      };
    });

    return { data: stats, max: maxCount > 0 ? maxCount : 1 };
  }, [filteredAppointments, dateRange, timeRange]);


  // Navigation Handlers
  const handlePrev = () => {
    if (timeRange === 'week') setCurrentDate(subWeeks(currentDate, 1));
    if (timeRange === 'month') setCurrentDate(subMonths(currentDate, 1));
    if (timeRange === 'year') setCurrentDate(subYears(currentDate, 1));
  };

  const handleNext = () => {
    if (timeRange === 'week') setCurrentDate(addWeeks(currentDate, 1));
    if (timeRange === 'month') setCurrentDate(addMonths(currentDate, 1));
    if (timeRange === 'year') setCurrentDate(addYears(currentDate, 1));
  };

  const totalPatients = filteredAppointments.length;
  const cancellationRate = (totalPatients + cancelledAppointments) > 0 
    ? (cancelledAppointments / (totalPatients + cancelledAppointments)) * 100 
    : 0;

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Filters Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
             <BarChart className="w-6 h-6 text-blue-600" />
             Relatórios de Performance
           </h2>
           <p className="text-sm text-gray-500">Analise o desempenho da clínica e tendências.</p>
        </div>

        <div className="flex items-center bg-gray-100 rounded-lg p-1">
           <button 
             onClick={() => setTimeRange('week')}
             className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${timeRange === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
           >
             Semana
           </button>
           <button 
             onClick={() => setTimeRange('month')}
             className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${timeRange === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
           >
             Mês
           </button>
           <button 
             onClick={() => setTimeRange('year')}
             className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${timeRange === 'year' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
           >
             Ano
           </button>
        </div>

        <div className="flex items-center space-x-2 bg-white border border-gray-200 rounded-lg px-2 py-1">
           <button onClick={handlePrev} className="p-1 hover:bg-gray-100 rounded-full text-gray-600">
              <ChevronLeft className="w-5 h-5" />
           </button>
           <span className="min-w-[140px] text-center text-sm font-medium text-gray-800 capitalize">
              {timeRange === 'year' 
                ? format(currentDate, 'yyyy') 
                : format(currentDate, 'MMMM yyyy', { locale: ptBR })}
           </span>
           <button onClick={handleNext} className="p-1 hover:bg-gray-100 rounded-full text-gray-600">
              <ChevronRight className="w-5 h-5" />
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
              <div>
                 <p className="text-sm font-medium text-gray-500 mb-1">Total de Atendimentos</p>
                 <h3 className="text-3xl font-bold text-gray-800">{totalPatients}</h3>
                 <div className="flex items-center mt-2 text-sm text-green-600 font-medium">
                    <ArrowUpRight className="w-4 h-4 mr-1" />
                    <span>+12% vs anterior</span>
                 </div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                 <Users className="w-6 h-6" />
              </div>
           </div>

           <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
              <div>
                 <p className="text-sm font-medium text-gray-500 mb-1">Média Diária</p>
                 <h3 className="text-3xl font-bold text-gray-800">
                    {timeRange === 'week' ? (totalPatients / 5).toFixed(1) : (totalPatients / 20).toFixed(1)}
                 </h3>
                 <div className="flex items-center mt-2 text-sm text-gray-400 font-medium">
                    <span>Média em dias úteis</span>
                 </div>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
                 <TrendingUp className="w-6 h-6" />
              </div>
           </div>

           <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
              <div>
                 <p className="text-sm font-medium text-gray-500 mb-1">Taxa de Cancelamento</p>
                 <h3 className="text-3xl font-bold text-gray-800">{cancellationRate.toFixed(1)}%</h3>
                 <div className={`flex items-center mt-2 text-sm font-medium ${cancellationRate > 15 ? 'text-red-500' : 'text-green-600'}`}>
                    {cancellationRate > 15 ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
                    <span>{cancellationRate > 15 ? 'Atenção necessária' : 'Dentro da meta'}</span>
                 </div>
              </div>
              <div className="p-3 bg-red-50 rounded-lg text-red-600">
                 <Calendar className="w-6 h-6" />
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Pie Chart: Procedures */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                <h3 className="text-lg font-bold text-gray-800 mb-6">Procedimentos Mais Realizados</h3>
                
                <div className="flex flex-col md:flex-row items-center justify-center gap-8 flex-1">
                    {/* SVG Donut Chart */}
                    <div className="relative w-48 h-48 flex-shrink-0">
                        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                            {procedureStats.length === 0 ? (
                                <circle cx="50" cy="50" r="40" stroke="#f3f4f6" strokeWidth="20" fill="none" />
                            ) : (
                                (() => {
                                    let accumulatedPercent = 0;
                                    return procedureStats.map((stat, i) => {
                                        // Calculations for Donut Slices
                                        const dashArray = 2 * Math.PI * 40; // r=40
                                        const dashOffset = dashArray * ((100 - stat.percentage) / 100);
                                        const rotation = 360 * (accumulatedPercent / 100);
                                        accumulatedPercent += stat.percentage;

                                        return (
                                            <circle
                                                key={i}
                                                cx="50"
                                                cy="50"
                                                r="40"
                                                stroke={stat.color}
                                                strokeWidth="20"
                                                fill="none"
                                                strokeDasharray={dashArray}
                                                strokeDashoffset={dashOffset}
                                                transform={`rotate(${rotation} 50 50)`}
                                                className="transition-all duration-500 hover:opacity-80"
                                            />
                                        );
                                    });
                                })()
                            )}
                        </svg>
                        {/* Center Text */}
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                            <span className="text-2xl font-bold text-gray-800">{totalPatients}</span>
                            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Total</span>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex-1 w-full space-y-3 overflow-y-auto max-h-48 pr-2">
                        {procedureStats.length === 0 ? (
                             <p className="text-gray-400 text-center text-sm">Sem dados neste período</p>
                        ) : (
                            procedureStats.map((stat, i) => (
                                <div key={i} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stat.color }}></div>
                                        <span className="text-sm font-medium text-gray-700 truncate max-w-[120px]" title={stat.label}>{stat.label}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-bold text-gray-800">{stat.value}</span>
                                        <span className="text-xs text-gray-500 w-8 text-right">{stat.percentage.toFixed(0)}%</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Bar Chart: Timeline */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-800">Volume de Atendimentos</h3>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        Realizados
                    </div>
                </div>

                <div className="flex-1 flex items-end justify-between gap-1 h-64 border-b border-gray-200 pb-2 overflow-x-auto no-scrollbar">
                    {timelineStats.data.length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                            Sem dados
                        </div>
                    ) : (
                        timelineStats.data.map((item, i) => {
                            const heightPercentage = (item.count / timelineStats.max) * 100;
                            
                            // Optimization: Hide intermediate labels if dense (e.g. month view)
                            const isDense = timelineStats.data.length > 15;
                            const showLabel = !isDense || i === 0 || i === timelineStats.data.length - 1 || i % 5 === 0;

                            return (
                                <div key={i} className="flex-1 flex flex-col items-center group h-full justify-end min-w-[20px] relative">
                                    {/* Tooltip on hover */}
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute mb-2 bottom-full bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
                                        {item.fullLabel} - {item.count} atendimentos
                                    </div>
                                    
                                    {/* The Bar */}
                                    <div 
                                        className="w-full max-w-[16px] bg-blue-100 rounded-t-sm group-hover:bg-blue-500 transition-all duration-300 relative"
                                        style={{ height: `${heightPercentage}%` }}
                                    >
                                        {/* Value Label inside bar if tall enough */}
                                        {heightPercentage > 20 && (
                                            <span className="absolute top-2 w-full text-center text-[8px] font-bold text-blue-800 group-hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                {item.count}
                                            </span>
                                        )}
                                    </div>
                                    
                                    {/* X-Axis Label */}
                                    <span className={`text-[10px] text-gray-400 mt-2 truncate w-full text-center transition-opacity duration-200 ${
                                        showLabel ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                    }`}>
                                        {item.label}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};