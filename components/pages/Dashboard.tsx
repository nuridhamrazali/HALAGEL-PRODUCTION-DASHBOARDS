
import React, { useMemo, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { StorageService } from '../../services/storageService';
import { ProductionEntry, OffDay, ProductionStatus, OffDayType } from '../../types';
import { PROCESSES } from '../../constants';
import { 
  ClipboardList, List, Calendar, 
  Download, Pencil, Trash2, Layers,
  Palmtree, MessageSquare, ArrowUpDown, Coffee, Ban
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatDisplayDate, getCurrentMonthISO, getWeeklyOffDayType } from '../../utils/dateUtils';

type SortConfig = {
    key: keyof ProductionEntry;
    direction: 'asc' | 'desc';
} | null;

export const Dashboard: React.FC = () => {
  const { category, refreshKey, triggerRefresh } = useDashboard();
  const { user, hasPermission } = useAuth();
  
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthISO());
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  const { productionData, offDays } = useMemo(() => {
    return {
      productionData: StorageService.getProductionData(),
      offDays: StorageService.getOffDays(),
    };
  }, [refreshKey]);

  const handleSort = (key: keyof ProductionEntry) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const dashboardData = useMemo(() => {
    const relevant = productionData.filter(d => d && d.category === category && d.date);
    let selectedMonthPlan = 0;
    let selectedMonthActual = 0;
    const selectedMonthProcessMap = new Map<string, {process: string, Plan: number, Actual: number}>();
    
    const validProcesses = category === 'Healthcare' 
      ? [...PROCESSES] 
      : PROCESSES.filter(p => !['Encapsulation', 'Blister', 'Capsules'].includes(p));

    validProcesses.forEach(proc => {
      selectedMonthProcessMap.set(proc, { process: proc, Plan: 0, Actual: 0 });
    });

    relevant.forEach(d => {
      const dateStr = (d.date || '').trim().substring(0, 7);
      if (dateStr === selectedMonth) {
        selectedMonthPlan += (d.planQuantity || 0);
        selectedMonthActual += (d.actualQuantity || 0);
        const procName = d.process || 'Other';
        if (selectedMonthProcessMap.has(procName)) {
          const p = selectedMonthProcessMap.get(procName)!;
          p.Plan += (d.planQuantity || 0);
          p.Actual += (d.actualQuantity || 0);
        }
      }
    });

    return {
      filteredData: relevant.sort((a,b) => (b.date || '').localeCompare(a.date || '')),
      selectedMonthStats: { 
        plan: selectedMonthPlan, 
        actual: selectedMonthActual,
        efficiency: selectedMonthPlan > 0 ? (selectedMonthActual / selectedMonthPlan) * 100 : 0
      },
      chartData: Array.from(selectedMonthProcessMap.values())
    };
  }, [productionData, category, selectedMonth]);

  const dailyGroups = useMemo(() => {
    const baseData = dashboardData.filteredData;
    const filteredEntries = baseData.filter(d => d && d.date && d.date.trim().startsWith(selectedMonth));
    const dates = new Set<string>();
    
    filteredEntries.forEach(e => {
        if (e.date) dates.add(e.date.trim().substring(0, 10));
    });
    
    offDays.forEach(od => {
        if (od.date && od.date.trim().startsWith(selectedMonth)) {
            dates.add(od.date.trim().substring(0, 10));
        }
    });

    const sortedDates = Array.from(dates).sort((a, b) => (b || '').localeCompare(a || ''));
    const statusWeight: Record<string, number> = { 'In Progress': 1, 'Completed': 2 };

    return sortedDates.map(dateKey => {
        let entriesForDate = filteredEntries.filter(d => d.date && d.date.trim().substring(0, 10) === dateKey);
        
        if (sortConfig) {
            entriesForDate = [...entriesForDate].sort((a, b) => {
                let aValue: any = a[sortConfig.key];
                let bValue: any = b[sortConfig.key];
                if (sortConfig.key === 'status') {
                    aValue = statusWeight[a.status as ProductionStatus] || 0;
                    bValue = statusWeight[b.status as ProductionStatus] || 0;
                }
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        let offDayInfo = offDays.find(od => od.date && od.date.trim().substring(0, 10) === dateKey);
        
        if (!offDayInfo) {
           const autoType = getWeeklyOffDayType(dateKey);
           if (autoType) {
               offDayInfo = {
                   id: `auto-${dateKey}`,
                   date: dateKey,
                   type: autoType,
                   description: autoType === 'Rest Day' ? 'Friday Weekly Rest' : 'Saturday Weekly Off',
                   createdBy: 'System'
               };
           }
        }

        const totalActualForDate = entriesForDate.reduce((sum, entry) => sum + (entry.actualQuantity || 0), 0);
        
        return {
            date: dateKey,
            totalActualForDate,
            entries: entriesForDate,
            offDay: offDayInfo
        };
    });
  }, [dashboardData.filteredData, offDays, selectedMonth, sortConfig]);

  const handleDelete = async (id: string) => {
      if(!window.confirm("PERMANENTLY delete record?")) return;
      
      // Fix: Specifically await the result to ensure it is resolved before destructuring
      const result = await StorageService.deleteProductionEntry(id);
      const { deletedItem } = result;

      if (deletedItem) {
          await StorageService.addLog({
            userId: user!.id, userName: user!.name, action: 'DELETE_RECORD',
            details: `Deleted: ${deletedItem.productName} (${deletedItem.date})`
          });
          window.dispatchEvent(new CustomEvent('app-notification', { 
            detail: { message: 'RECORD DELETED', type: 'success' } 
          }));
      }
      triggerRefresh();
  };

  const handleEdit = (entry: ProductionEntry) => {
    window.dispatchEvent(new CustomEvent('edit-production-entry', { detail: entry }));
  };

  const getOffDayIcon = (type: string) => {
    switch(type) {
      case 'Public Holiday': return <Palmtree className="w-6 h-6 text-rose-500" />;
      case 'Rest Day': return <Coffee className="w-6 h-6 text-indigo-500" />;
      case 'Off Day': return <Ban className="w-6 h-6 text-amber-500" />;
      default: return <Calendar className="w-6 h-6 text-slate-400" />;
    }
  };

  const getOffDayBadgeStyle = (type: string) => {
    switch(type) {
      case 'Public Holiday': return 'bg-rose-500 text-white shadow-rose-500/20';
      case 'Rest Day': return 'bg-indigo-500 text-white shadow-indigo-500/20';
      case 'Off Day': return 'bg-amber-500 text-white shadow-amber-500/20';
      default: return 'bg-slate-400 text-white';
    }
  };

  const SortHeader = ({ label, sortKey, align = 'left' }: { label: string, sortKey: keyof ProductionEntry, align?: 'left' | 'right' | 'center' }) => (
    <th className={`px-8 py-4 cursor-pointer group text-${align}`} onClick={() => handleSort(sortKey)}>
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
            <span className={sortConfig?.key === sortKey ? 'text-indigo-600' : ''}>{label}</span>
            <ArrowUpDown className={`w-3 h-3 transition-opacity ${sortConfig?.key === sortKey ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`} />
        </div>
    </th>
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-2">
            <Layers className="w-4 h-4 text-indigo-500" />
            <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em]">Monthly Process Breakdown</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {dashboardData.chartData.map((item) => {
                const eff = item.Plan > 0 ? (item.Actual / item.Plan) * 100 : 0;
                return (
                    <div key={item.process} className="glass-panel p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 shadow-sm group hover:border-indigo-500/30 transition-all duration-300">
                        <div className="flex items-center justify-between mb-6">
                          <p className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{item.process}</p>
                          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        </div>
                        <div className="space-y-5">
                            <div className="flex flex-col gap-1">
                                <span className="text-[11px] font-black text-slate-400 uppercase">Plan</span>
                                <span className="text-2xl font-black text-slate-800 dark:text-white font-mono">{(item.Plan || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[11px] font-black text-slate-400 uppercase">Actual</span>
                                <span className="text-2xl font-black text-emerald-500 font-mono">{(item.Actual || 0).toLocaleString()}</span>
                            </div>
                            <div className="pt-5 border-t border-gray-50 dark:border-slate-700 flex justify-between items-center">
                                <span className="text-[11px] font-black text-slate-400 uppercase">Efficiency</span>
                                <span className={`text-xl font-black font-mono ${eff >= 100 ? 'text-emerald-500' : eff >= 75 ? 'text-amber-500' : 'text-rose-500'}`}>
                                    {(eff || 0).toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-end gap-4 px-2">
            <div>
               <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <List className="w-5 h-5 text-indigo-500" />
                  Daily Production Log
               </h3>
               <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{selectedMonth} Operational granularity</p>
            </div>
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-4 py-2 text-sm font-bold bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 dark:text-white outline-none" />
        </div>
        
        <div className="space-y-6">
            {dailyGroups.length === 0 ? (
                <div className="p-20 text-center glass-panel rounded-[2rem]">
                    <div className="inline-flex p-4 rounded-full bg-slate-50 dark:bg-slate-800 mb-4">
                        <ClipboardList className="w-10 h-10 text-slate-300" />
                    </div>
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No scheduled data for this month</p>
                </div>
            ) : dailyGroups.map((group, groupIdx) => {
                const displayDate = formatDisplayDate(group.date);
                const [datePart, dayPart] = displayDate.split(' ');
                const isOff = !!group.offDay;

                const allCompleted = group.entries.length > 0 && group.entries.every(e => e.status === 'Completed');

                return (
                  <div key={`group-${groupIdx}`} className={`bg-white dark:bg-slate-850 rounded-[2rem] overflow-hidden shadow-sm border ${
                    isOff ? (
                        group.offDay?.type === 'Public Holiday' ? 'border-rose-400/30' :
                        group.offDay?.type === 'Rest Day' ? 'border-indigo-400/30' :
                        'border-amber-400/30'
                    ) : 'border-gray-100 dark:border-slate-800'
                  }`}>
                      <div className={`p-6 flex justify-between items-center border-b ${
                        isOff ? (
                            group.offDay?.type === 'Public Holiday' ? 'bg-rose-50/30 dark:bg-rose-900/10' :
                            group.offDay?.type === 'Rest Day' ? 'bg-indigo-50/30 dark:bg-indigo-900/10' :
                            'bg-amber-50/30 dark:bg-amber-900/10'
                        ) : 'bg-gray-50/50 dark:bg-slate-800/50'
                      }`}>
                          <div className="flex items-center gap-4">
                              {getOffDayIcon(group.offDay?.type || '')}
                              <div className="flex items-center gap-3">
                                <span className={`text-xl font-black text-slate-800 dark:text-white`}>{datePart}</span>
                                <span className="text-xl font-medium uppercase tracking-tight text-slate-400">{dayPart}</span>
                              </div>
                              {isOff && (
                                <div className="flex items-center gap-2">
                                    <span className={`px-3 py-1 text-[9px] font-black uppercase rounded-full shadow-sm tracking-widest ${getOffDayBadgeStyle(group.offDay!.type)}`}>
                                        {group.offDay!.type}
                                    </span>
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                                        {group.offDay!.description}
                                    </span>
                                </div>
                              )}
                          </div>
                          
                          <div className="flex flex-col items-end gap-1.5">
                            <div className="px-4 py-1.5 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-[11px] uppercase tracking-widest shadow-sm">
                              Actual: <span className="text-emerald-500 ml-1 font-mono">{(group.totalActualForDate || 0).toLocaleString()}</span>
                            </div>
                            {group.entries.length > 0 && (
                              <div className={`px-2.5 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tighter border shadow-sm ${
                                allCompleted ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                              }`}>
                                {allCompleted ? 'All Jobs Completed' : 'Production In Progress'}
                              </div>
                            )}
                          </div>
                      </div>

                      {group.entries.length > 0 && (
                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-50 dark:border-slate-800 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-gray-50/30 dark:bg-slate-900/30">
                                        <SortHeader label="Process" sortKey="process" />
                                        <SortHeader label="Product Name" sortKey="productName" />
                                        <th className="px-8 py-4 text-right font-black uppercase text-[10px] tracking-widest">Plan Data</th>
                                        <th className="px-8 py-4 text-right font-black uppercase text-[10px] tracking-widest">Actual Data</th>
                                        <th className="px-8 py-4 text-center font-black uppercase text-[10px] tracking-widest">Efficiency</th>
                                        <th className="px-8 py-4 text-center font-black uppercase text-[10px] tracking-widest">Batch No</th>
                                        <th className="px-8 py-4 text-center font-black uppercase text-[10px] tracking-widest">Manpower</th>
                                        {hasPermission(['admin', 'manager', 'hod']) && <th className="px-8 py-4 text-center font-black uppercase text-[10px] tracking-widest">Action</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-slate-800/30">
                                    {group.entries.map(entry => {
                                        const eff = entry.planQuantity > 0 ? (entry.actualQuantity / entry.planQuantity) * 100 : 0;
                                        return (
                                            <tr key={entry.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="px-8 py-5">
                                                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg border border-indigo-100 dark:border-indigo-800">{entry.process}</span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className="text-sm font-black text-slate-800 dark:text-white uppercase">{entry.productName}</span>
                                                </td>
                                                <td className="px-8 py-5 text-right font-black font-mono text-indigo-600/80 dark:text-indigo-400/80 text-sm">
                                                    <div>{(entry.planQuantity || 0).toLocaleString()} <span className="text-[9px] ml-1 opacity-60 font-sans">{entry.unit}</span></div>
                                                    {entry.planRemark && <div className="flex items-center justify-end gap-1 mt-1 opacity-70"><MessageSquare className="w-3 h-3 text-slate-300" /><span className="text-[9px] font-medium text-slate-400 italic max-w-[150px] truncate">{entry.planRemark}</span></div>}
                                                </td>
                                                <td className="px-8 py-5 text-right font-black font-mono text-emerald-500 text-sm">
                                                    <div>{(entry.actualQuantity || 0).toLocaleString()} <span className="text-[9px] ml-1 opacity-60 font-sans">{entry.unit}</span></div>
                                                    {entry.actualRemark && <div className="flex items-center justify-end gap-1 mt-1 opacity-70"><MessageSquare className="w-3 h-3 text-emerald-200" /><span className="text-[9px] font-medium text-emerald-400/80 italic max-w-[150px] truncate">{entry.actualRemark}</span></div>}
                                                </td>
                                                <td className="px-8 py-5 text-center">
                                                    <span className={`text-sm font-black font-mono ${eff >= 100 ? 'text-emerald-500' : eff >= 75 ? 'text-amber-500' : 'text-rose-500'}`}>{(eff || 0).toFixed(0)}%</span>
                                                </td>
                                                <td className="px-8 py-5 text-center">
                                                    <span className="text-[11px] font-bold text-slate-400 uppercase font-mono">{entry.batchNo || '-'}</span>
                                                </td>
                                                <td className="px-8 py-5 text-center">
                                                    <span className="text-base font-black text-slate-800 dark:text-white font-mono">{(entry.manpower || 0).toFixed(2)}</span>
                                                </td>
                                                {hasPermission(['admin', 'manager', 'hod']) && (
                                                  <td className="px-8 py-5 text-center">
                                                      <div className="flex items-center justify-center gap-2">
                                                          <button onClick={() => handleEdit(entry)} className="p-1.5 text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition"><Pencil className="w-4 h-4" /></button>
                                                          <button onClick={() => handleDelete(entry.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                                                      </div>
                                                  </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                      )}
                  </div>
                );
            })}
        </div>
      </div>
    </div>
  );
};
