
import React, { useMemo, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { StorageService } from '../../services/storageService';
import { PROCESSES } from '../../constants';
import { ProductionEntry } from '../../types';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  CheckCircle2,
  Plus,
  Info
} from 'lucide-react';
import { formatDisplayDate, getTodayISO, getWeeklyOffDayType, formatDateToDMY } from '../../utils/dateUtils';

/**
 * UNIFIED PROCESS IDENTITY SYSTEM
 * Every manufacturing stage follows the exact same visual branding structure.
 */
const PROCESS_COLORS: Record<string, { bg: string, text: string, border: string, tint: string }> = {
  'Mixing': { bg: 'bg-blue-600', text: 'text-blue-700', border: 'border-blue-600', tint: 'bg-blue-50/20' },
  'Encapsulation': { bg: 'bg-purple-600', text: 'text-purple-700', border: 'border-purple-600', tint: 'bg-purple-50/20' },
  'Filling': { bg: 'bg-emerald-600', text: 'text-emerald-700', border: 'border-emerald-600', tint: 'bg-emerald-50/20' },
  'Sorting': { bg: 'bg-slate-700', text: 'text-slate-800', border: 'border-slate-700', tint: 'bg-slate-100/30' },
  'Packing': { bg: 'bg-rose-600', text: 'text-rose-700', border: 'border-rose-600', tint: 'bg-rose-50/20' },
  'Blister': { bg: 'bg-indigo-600', text: 'text-indigo-700', border: 'border-indigo-600', tint: 'bg-indigo-50/20' },
  'Capsules': { bg: 'bg-amber-500', text: 'text-amber-700', border: 'border-amber-500', tint: 'bg-amber-50/20' },
};

export const ProductionCalendar: React.FC = () => {
  const { category, refreshKey, isDarkMode } = useDashboard();
  const [viewType, setViewType] = useState<'month' | 'week'>('month');
  const [baseDate, setBaseDate] = useState(getTodayISO());

  const { productionData, offDays } = useMemo(() => {
    return {
      productionData: StorageService.getProductionData(),
      offDays: StorageService.getOffDays(),
    };
  }, [refreshKey]);

  // Generate columns based on viewType: Day-by-Day (Month) or Week-by-Week (4-Week)
  const columns = useMemo(() => {
    const cols = [];
    const curr = new Date(baseDate);

    if (viewType === 'month') {
      const year = curr.getFullYear();
      const month = curr.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0];
        const display = formatDisplayDate(dateKey);
        cols.push({
          key: dateKey,
          label: display.split(' ')[0],
          subLabel: display.split(' ')[1],
          isAggregated: false,
          startDate: dateKey,
          endDate: dateKey
        });
      }
    } else {
      // 4-WEEK STRATEGIC HORIZON
      const day = curr.getDay();
      const diff = curr.getDate() - day; // Adjust to start of current week (Sunday)
      const startOfFirstWeek = new Date(curr.setDate(diff));

      for (let i = 0; i < 4; i++) {
        const start = new Date(startOfFirstWeek);
        start.setDate(start.getDate() + (i * 7));
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        
        cols.push({
          key: `week-${i + 1}`,
          label: `WEEK ${i + 1}`,
          subLabel: `${start.getDate()} ${start.toLocaleString('default', { month: 'short' })} - ${end.getDate()} ${end.toLocaleString('default', { month: 'short' })}`,
          isAggregated: true,
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0]
        });
      }
    }
    return cols;
  }, [baseDate, viewType]);

  const filteredProcesses = useMemo(() => {
    if (category === 'Healthcare') return [...PROCESSES];
    return PROCESSES.filter(p => !['Encapsulation', 'Blister', 'Capsules'].includes(p));
  }, [category]);

  const navigateDate = (direction: number) => {
    const d = new Date(baseDate);
    if (viewType === 'month') d.setMonth(d.getMonth() + direction);
    else d.setDate(d.getDate() + (direction * 7));
    setBaseDate(d.toISOString().split('T')[0]);
  };

  const handleAddNewAt = (date: string, process: string) => {
    window.dispatchEvent(new CustomEvent('edit-production-entry', { 
      detail: { 
        id: '', date, process, category, productName: '', 
        planQuantity: 0, actualQuantity: 0, unit: 'KG', status: 'In Progress'
      } 
    }));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Matrix Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2 uppercase tracking-tight">
            <CalendarIcon className="w-7 h-7 text-indigo-600" />
            Scheduling Matrix
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">
            {viewType === 'week' ? '4-Week Strategic Planning Horizon' : 'Monthly Daily Execution View'} • {category}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-white dark:bg-slate-850 p-1.5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 flex shadow-sm">
            <button 
              onClick={() => setViewType('month')}
              className={`px-5 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${viewType === 'month' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Day Grid
            </button>
            <button 
              onClick={() => setViewType('week')}
              className={`px-5 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${viewType === 'week' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Week 1-4
            </button>
          </div>

          <div className="flex items-center gap-2 bg-white dark:bg-slate-850 p-1.5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 shadow-sm">
            <button onClick={() => navigateDate(-1)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-black uppercase text-slate-700 dark:text-white px-4 tracking-widest min-w-[160px] text-center">
              {new Date(baseDate).toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => navigateDate(1)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Unified Matrix Board */}
      <div className="bg-white dark:bg-slate-850 rounded-[2.5rem] shadow-2xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50">
                <th className="sticky left-0 z-30 bg-slate-50 dark:bg-slate-900 p-8 text-left border-b-2 border-r-4 border-slate-200 dark:border-slate-700 min-w-[220px] shadow-[6px_0_15px_rgba(0,0,0,0.1)]">
                  <span className="text-[11px] font-black uppercase text-slate-500 tracking-[0.2em]">Process Node</span>
                </th>
                {columns.map(col => {
                  const isOff = !col.isAggregated && !!(getWeeklyOffDayType(col.key) || offDays.find(od => od.date === col.key));
                  return (
                    <th key={col.key} className={`p-5 text-center border-b-2 border-r-[3px] border-slate-200 dark:border-slate-700 min-w-[280px] last:border-r-0 ${isOff ? 'bg-slate-100/50 dark:bg-slate-800/30' : ''}`}>
                      <div className="flex flex-col items-center">
                        <span className={`text-sm font-black text-slate-800 dark:text-white mb-1 ${col.isAggregated ? 'text-indigo-600' : ''}`}>
                          {col.label}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{col.subLabel}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredProcesses.map(proc => {
                const colors = PROCESS_COLORS[proc] || PROCESS_COLORS['Mixing'];
                return (
                  <tr key={proc} className="group hover:bg-slate-50/50 transition-colors">
                    {/* UNIFIED IDENTITY ANCHOR COLUMN */}
                    <td className={`sticky left-0 z-20 p-8 border-b-2 border-r-4 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition-colors shadow-[6px_0_15px_rgba(0,0,0,0.06)] border-l-[14px] ${colors.border}`}>
                      <div className="flex flex-col">
                        <span className={`text-[14px] font-black uppercase tracking-[0.1em] mb-3 ${colors.text}`}>
                          {proc}
                        </span>
                        {/* Horizontal Identity Bar */}
                        <div className={`w-14 h-2.5 rounded-full shadow-sm ${colors.bg}`}></div>
                      </div>
                    </td>

                    {/* Matrix Cells */}
                    {columns.map(col => {
                      const entries = productionData.filter(d => 
                        d.process === proc && 
                        d.category === category && 
                        d.date >= col.startDate && 
                        d.date <= col.endDate
                      );

                      const manualOff = !col.isAggregated ? offDays.find(od => od.date === col.key) : null;
                      const autoOff = !col.isAggregated ? getWeeklyOffDayType(col.key) : null;
                      const offType = manualOff?.type || autoOff;
                      
                      const holidaysInPeriod = col.isAggregated ? offDays.filter(od => od.date >= col.startDate && od.date <= col.endDate).length : 0;

                      return (
                        <td key={`${col.key}-${proc}`} className={`p-4 border-b-2 border-r-[3px] border-slate-200 dark:border-slate-700 relative align-top min-h-[160px] last:border-r-0 ${offType ? 'bg-slate-100/30 dark:bg-slate-900/30' : colors.tint}`}>
                          {offType ? (
                             <div className="h-full py-10 flex items-center justify-center opacity-10">
                                <span className="text-[11px] font-black uppercase tracking-[0.3em] -rotate-12 border-2 border-current px-4 py-1.5 rounded-xl text-center leading-tight">
                                  {manualOff?.description || (autoOff === 'Rest Day' ? 'Friday Rest' : 'Saturday Off')}
                                </span>
                             </div>
                          ) : (
                            <div className="space-y-4">
                                {col.isAggregated && holidaysInPeriod > 0 && (
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="flex -space-x-1">
                                      {[...Array(holidaysInPeriod)].map((_, i) => (
                                        <div key={i} className="w-2 h-2 rounded-full bg-rose-500 shadow-sm border border-white" />
                                      ))}
                                    </div>
                                    <span className="text-[8px] font-black text-rose-500 uppercase tracking-tighter">{holidaysInPeriod} Holiday(s)</span>
                                  </div>
                                )}
                                
                                {entries.length > 0 ? (
                                    entries.map(entry => (
                                        <div key={entry.id} className={`p-4 rounded-[1.5rem] border-2 transition-all relative overflow-hidden group/card shadow-sm ${
                                        entry.status === 'Completed' 
                                            ? 'bg-emerald-50/50 border-emerald-500/30 dark:bg-emerald-900/10' 
                                            : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
                                        }`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
                                            entry.status === 'Completed' ? 'bg-emerald-500 text-white' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300'
                                            }`}>
                                              {col.isAggregated ? formatDateToDMY(entry.date).split('-')[0] : ''} {entry.status === 'Completed' ? 'DONE' : 'PLAN'}
                                            </span>
                                            <span className="text-[9px] font-black font-mono text-slate-400">{entry.batchNo || '---'}</span>
                                        </div>
                                        <p className="text-[11px] font-black text-slate-800 dark:text-white leading-tight uppercase mb-2 break-words">
                                          {entry.productName}
                                        </p>
                                        <div className="flex justify-between items-end border-t border-slate-50 dark:border-slate-700/50 pt-2">
                                            <div className={`text-[10px] font-black ${colors.text}`}>
                                              {entry.planQuantity} <span className="text-[8px] opacity-60 uppercase font-bold">{entry.unit}</span>
                                            </div>
                                            {entry.actualQuantity > 0 && (
                                              <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 flex flex-col items-end leading-none">
                                                  <span className="text-[7px] opacity-50 uppercase mb-0.5">Yield</span>
                                                  {entry.actualQuantity}
                                              </div>
                                            )}
                                        </div>
                                        </div>
                                    ))
                                ) : (
                                  <div className="h-12 flex items-center justify-center opacity-5 group-hover:opacity-20 transition-opacity">
                                    <Info className="w-4 h-4 text-slate-400" />
                                  </div>
                                )}
                                <button 
                                  onClick={() => handleAddNewAt(col.startDate, proc)}
                                  className={`w-full py-2 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-white dark:hover:bg-slate-800/40 ${colors.text}`}
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
