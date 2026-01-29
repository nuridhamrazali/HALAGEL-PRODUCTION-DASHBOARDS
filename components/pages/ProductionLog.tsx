
import React, { useState, useMemo, useEffect } from 'react';
import { StorageService } from '../../services/storageService';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { CATEGORIES, PROCESSES } from '../../constants';
import { ProductionEntry, ProductionStatus } from '../../types';
import { Download, Filter, XCircle, Palmtree, MessageSquare, ArrowUpDown, Clock, CheckCircle, Coffee, Ban } from 'lucide-react';
import { getTodayISO, getWeeklyOffDayType, formatDateToDMY } from '../../utils/dateUtils';

type SortConfig = {
    key: keyof ProductionEntry;
    direction: 'asc' | 'desc';
} | null;

export const ProductionLog: React.FC = () => {
  const { refreshKey } = useDashboard();
  const [data, setData] = useState<ProductionEntry[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const offDays = useMemo(() => StorageService.getOffDays(), []);
  
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [category, setCategory] = useState('All');
  const [processType, setProcessType] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    setData(StorageService.getProductionData());
  }, [refreshKey]);

  const handleSort = (key: keyof ProductionEntry) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredData = useMemo(() => {
    let result = data.filter(d => {
      if (!d) return false;
      const matchCat = category === 'All' || d.category === category;
      const matchProc = processType === 'All' || d.process === processType;
      const matchStatus = statusFilter === 'All' || d.status === statusFilter;
      const matchStart = !dateRange.start || (d.date && d.date >= dateRange.start);
      const matchEnd = !dateRange.end || (d.date && d.date <= dateRange.end);
      return matchCat && matchProc && matchStatus && matchStart && matchEnd;
    });

    const statusWeight: Record<string, number> = { 'In Progress': 1, 'Completed': 2 };

    if (sortConfig) {
        result = [...result].sort((a, b) => {
            let aVal: any = a[sortConfig.key];
            let bVal: any = b[sortConfig.key];
            if (sortConfig.key === 'status') {
                aVal = statusWeight[a.status as ProductionStatus] || 0;
                bVal = statusWeight[b.status as ProductionStatus] || 0;
            } else {
                aVal = (aVal || '').toString();
                bVal = (bVal || '').toString();
            }
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    } else {
        result.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }

    return result;
  }, [data, dateRange, category, processType, statusFilter, sortConfig]);

  const calculateEfficiency = (actual: number, plan: number) => plan > 0 ? ((actual / plan) * 100).toFixed(1) : '0';

  const resetFilters = () => {
    setDateRange({ start: '', end: '' });
    setCategory('All');
    setProcessType('All');
    setStatusFilter('All');
    setSortConfig(null);
  };

  const downloadCSV = () => {
    const headers = ["Date", "Category", "Process", "Product", "Plan", "Actual", "Unit", "Efficiency %", "Batch No", "Manpower", "Status", "Plan Remark", "Actual Remark"];
    const rows = filteredData.map(d => [
        d.date, d.category, d.process, `"${d.productName}"`, d.planQuantity || 0, d.actualQuantity || 0, d.unit || 'KG',
        calculateEfficiency(d.actualQuantity || 0, d.planQuantity || 0), d.batchNo || '', (d.manpower || 0).toFixed(2), d.status || 'In Progress', 
        `"${(d.planRemark || '').replace(/"/g, '""')}"`, `"${(d.actualRemark || '').replace(/"/g, '""')}"`
    ]);
    const filename = `production_log_${getTodayISO()}.csv`;

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'REPORT EXPORTED SUCCESSFULLY', type: 'success' } 
    }));
  };

  const SortHeader = ({ label, sortKey, align = 'left' }: { label: string, sortKey: keyof ProductionEntry, align?: 'left' | 'right' | 'center' }) => (
    <th className={`px-8 py-5 cursor-pointer group text-${align}`} onClick={() => handleSort(sortKey)}>
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
            <span className={sortConfig?.key === sortKey ? 'text-indigo-600' : ''}>{label}</span>
            <ArrowUpDown className={`w-3 h-3 transition-opacity ${sortConfig?.key === sortKey ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`} />
        </div>
    </th>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 dark:text-white">Production Log</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Detailed operational history</p>
        </div>
        
        <button 
          onClick={downloadCSV} 
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition shadow-lg shadow-emerald-500/20"
        >
          <Download className="w-4 h-4" /> Export Report
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 flex flex-wrap gap-6 items-end">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1"><Filter className="w-3 h-3" /> Date From</label>
          <input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({...prev, start: e.target.value}))} className="px-4 py-2.5 text-sm bg-gray-50 dark:bg-slate-900 rounded-xl border dark:border-slate-700 outline-none dark:text-white font-bold" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1"><Filter className="w-3 h-3" /> Date To</label>
          <input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({...prev, end: e.target.value}))} className="px-4 py-2.5 text-sm bg-gray-50 dark:bg-slate-900 rounded-xl border dark:border-slate-700 outline-none dark:text-white font-bold" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1"><Filter className="w-3 h-3" /> Department</label>
          <select value={category} onChange={e => setCategory(e.target.value)} className="px-4 py-2.5 text-sm bg-gray-50 dark:bg-slate-900 rounded-xl border dark:border-slate-700 outline-none dark:text-white font-bold w-full md:w-auto">
            <option value="All">All Departments</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1"><Filter className="w-3 h-3" /> Process Stage</label>
          <select value={processType} onChange={e => setProcessType(e.target.value)} className="px-4 py-2.5 text-sm bg-gray-50 dark:bg-slate-900 rounded-xl border dark:border-slate-700 outline-none dark:text-white font-bold w-full md:w-auto">
            <option value="All">All Processes</option>
            {PROCESSES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1"><Filter className="w-3 h-3" /> Status</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-4 py-2.5 text-sm bg-gray-50 dark:bg-slate-900 rounded-xl border dark:border-slate-700 outline-none dark:text-white font-bold w-full md:w-auto">
            <option value="All">All Statuses</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
        <button onClick={resetFilters} className="flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-black uppercase text-rose-500 hover:bg-rose-50 rounded-xl transition"><XCircle className="w-4 h-4" /> Reset</button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-gray-50/50 dark:bg-slate-900/50 text-slate-400 font-black uppercase text-[10px] tracking-widest border-b dark:border-slate-700">
                <tr>
                    <SortHeader label="Date / Status" sortKey="date" />
                    <SortHeader label="Dept" sortKey="category" align="center" />
                    <SortHeader label="Product" sortKey="productName" />
                    <th className="px-8 py-5 text-right font-black uppercase text-[10px] tracking-widest">Plan Data</th>
                    <th className="px-8 py-5 text-right font-black uppercase text-[10px] tracking-widest">Actual Data</th>
                    <th className="px-8 py-5 text-center font-black uppercase text-[10px] tracking-widest">Unit</th>
                    <th className="px-8 py-5 text-right font-black uppercase text-[10px] tracking-widest">Eff. %</th>
                    <SortHeader label="Batch No" sortKey="batchNo" align="center" />
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {filteredData.map(entry => {
                const eff = Number(calculateEfficiency(entry.actualQuantity || 0, entry.planQuantity || 0));
                const manualOffDay = offDays.find(od => od.date === entry.date);
                const autoOffType = getWeeklyOffDayType(entry.date || '');
                const labelType = manualOffDay?.type || autoOffType;
                const labelDesc = manualOffDay?.description || (autoOffType === 'Rest Day' ? 'Weekly Rest' : 'Weekly Off');

                return (
                    <tr key={entry.id} className={`hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors ${labelType ? 'bg-amber-50/10' : ''}`}>
                    <td className="px-8 py-6">
                        <div className="font-black text-slate-800 dark:text-white font-mono text-xs mb-1.5">{formatDateToDMY(entry.date)}</div>
                        {labelType ? (
                            <span className={`flex items-center gap-1.5 text-[9px] font-black uppercase ${
                            labelType === 'Public Holiday' ? 'text-rose-500' : 
                            labelType === 'Rest Day' ? 'text-indigo-500' : 'text-amber-500'
                            }`}>
                            {labelType === 'Public Holiday' ? <Palmtree className="w-3 h-3" /> : 
                                labelType === 'Rest Day' ? <Coffee className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                            {labelDesc}
                            </span>
                        ) : (
                            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase border ${entry.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                                {entry.status === 'Completed' ? <CheckCircle className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5 animate-pulse" />} 
                                {entry.status}
                            </div>
                        )}
                    </td>
                    <td className="px-8 py-6 text-center">
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-500 border dark:border-slate-800">{entry.category}</span>
                    </td>
                    <td className="px-8 py-6">
                        <div className="font-black text-slate-800 dark:text-white leading-tight mb-1">{entry.productName}</div>
                        <div className="text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">{entry.process}</div>
                    </td>
                    <td className="px-8 py-6 text-right font-black font-mono text-slate-700 dark:text-slate-200">
                        <div>{(entry.planQuantity || 0).toLocaleString()}</div>
                        {entry.planRemark && (
                            <div className="flex items-center justify-end gap-1 mt-1 opacity-60">
                            <MessageSquare className="w-2.5 h-2.5 text-indigo-500" />
                            <span className="text-[9px] font-medium italic truncate max-w-[120px]">{entry.planRemark}</span>
                            </div>
                        )}
                    </td>
                    <td className="px-8 py-6 text-right font-black font-mono text-emerald-500">
                        <div>{(entry.actualQuantity || 0).toLocaleString()}</div>
                        {entry.actualRemark && (
                            <div className="flex items-center justify-end gap-1 mt-1 opacity-60">
                            <MessageSquare className="w-2.5 h-2.5 text-emerald-500" />
                            <span className="text-[9px] font-medium italic truncate max-w-[120px]">{entry.actualRemark}</span>
                            </div>
                        )}
                    </td>
                    <td className="px-8 py-6 text-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{entry.unit || 'KG'}</span>
                    </td>
                    <td className="px-8 py-6 text-right font-black">
                        <span className={`${eff >= 90 ? 'text-emerald-500' : eff >= 70 ? 'text-amber-500' : 'text-rose-500'}`}>{eff}%</span>
                    </td>
                    <td className="px-8 py-6 text-center">
                        <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 font-mono uppercase">
                            {entry.batchNo || '---'}
                        </span>
                    </td>
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
