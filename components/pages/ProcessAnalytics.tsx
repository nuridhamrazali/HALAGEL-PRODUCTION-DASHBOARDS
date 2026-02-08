
import React, { useMemo, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { StorageService } from '../../services/storageService';
import { CATEGORIES, PROCESSES } from '../../constants';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, LineChart, Line, AreaChart, Area, ComposedChart,
  Cell, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { 
  BarChart3, Activity, Target, Zap, 
  Filter, Calendar, TrendingUp, ArrowUpRight, 
  AlertTriangle, Users, Gauge, Info,
  ChevronRight, Thermometer
} from 'lucide-react';
import { getTodayISO } from '../../utils/dateUtils';

export const ProcessAnalytics: React.FC = () => {
  const { refreshKey, isDarkMode } = useDashboard();
  const [dateRange, setDateRange] = useState({ 
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], 
    end: getTodayISO() 
  });
  const [selectedCategory, setSelectedCategory] = useState('All');

  const productionData = useMemo(() => StorageService.getProductionData(), [refreshKey]);

  const filteredData = useMemo(() => {
    return productionData.filter(d => {
      const matchCat = selectedCategory === 'All' || d.category === selectedCategory;
      const matchStart = !dateRange.start || d.date >= dateRange.start;
      const matchEnd = !dateRange.end || d.date <= dateRange.end;
      return matchCat && matchStart && matchEnd;
    });
  }, [productionData, dateRange, selectedCategory]);

  const analytics = useMemo(() => {
    const metrics: Record<string, { 
        process: string, 
        plan: number, 
        actual: number, 
        manpower: number,
        entries: number 
    }> = {};
    
    // Filter valid processes based on department
    let validProcesses = [...PROCESSES] as string[];
    if (selectedCategory !== 'All' && selectedCategory !== 'Healthcare') {
      validProcesses = PROCESSES.filter(p => !['Encapsulation', 'Blister', 'Capsules'].includes(p));
      if (selectedCategory === 'Rocksalt') validProcesses = validProcesses.filter(p => p !== 'Mixing' && p !== 'Sorting');
      else if (selectedCategory === 'Toothpaste') validProcesses = validProcesses.filter(p => p !== 'Filling' && p !== 'Sorting');
      else if (selectedCategory === 'Cosmetic') validProcesses = validProcesses.filter(p => p !== 'Sorting');
    }

    validProcesses.forEach(p => {
      metrics[p] = { process: p, plan: 0, actual: 0, manpower: 0, entries: 0 };
    });

    filteredData.forEach(d => {
      if (metrics[d.process]) {
        metrics[d.process].plan += (d.planQuantity || 0);
        metrics[d.process].actual += (d.actualQuantity || 0);
        metrics[d.process].manpower += (d.manpower || 0);
        metrics[d.process].entries++;
      }
    });

    const processed = Object.values(metrics).map(m => {
        const efficiency = m.plan > 0 ? (m.actual / m.plan) * 100 : 0;
        const gap = m.plan - m.actual;
        const yieldPerPerson = m.manpower > 0 ? (m.actual / m.manpower) : 0;
        return { ...m, efficiency, gap, yieldPerPerson };
    });

    // IDENTIFY BOTTLENECK: Largest Gap or Lowest Efficiency with high Plan volume
    const bottleneck = [...processed].sort((a, b) => b.gap - a.gap)[0];
    const topPerformer = [...processed].sort((a, b) => b.efficiency - a.efficiency)[0];

    return { 
        metrics: processed.sort((a, b) => b.gap - a.gap), 
        bottleneck, 
        topPerformer 
    };
  }, [filteredData, selectedCategory]);

  const dailyTrend = useMemo(() => {
    const daily: Record<string, { date: string, plan: number, actual: number }> = {};
    filteredData.forEach(d => {
      if (!daily[d.date]) daily[d.date] = { date: d.date, plan: 0, actual: 0 };
      daily[d.date].plan += d.planQuantity;
      daily[d.date].actual += d.actualQuantity;
    });
    return Object.values(daily).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredData]);

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      {/* Header section remains similar but updated titles */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
              <Gauge className="w-5 h-5 text-white" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600 dark:text-indigo-400">Operational Scan</span>
          </div>
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Production <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-500">Health</span>
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-gray-100 dark:border-slate-700">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              value={selectedCategory} 
              onChange={e => setSelectedCategory(e.target.value)}
              className="bg-transparent text-xs font-black text-slate-600 dark:text-slate-200 outline-none uppercase tracking-widest cursor-pointer"
            >
              <option value="All">Global Factory</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-gray-100 dark:border-slate-700">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input 
                type="date" 
                value={dateRange.start} 
                onChange={e => setDateRange(prev => ({...prev, start: e.target.value}))}
                className="bg-transparent text-[10px] font-black text-slate-600 dark:text-slate-200 outline-none uppercase"
            />
            <span className="text-slate-300 text-[10px] font-black">TO</span>
            <input 
                type="date" 
                value={dateRange.end} 
                onChange={e => setDateRange(prev => ({...prev, end: e.target.value}))}
                className="bg-transparent text-[10px] font-black text-slate-600 dark:text-slate-200 outline-none uppercase"
            />
          </div>
        </div>
      </div>

      {/* INTELLIGENCE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* BOTTLENECK ALERT */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border-2 border-rose-500/20 shadow-lg relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <AlertTriangle className="w-16 h-16 text-rose-500" />
            </div>
            <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Active Bottleneck</p>
            </div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                {analytics.bottleneck?.process || 'STABLE'}
            </h3>
            <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest leading-none">
                Variance: <span className="text-rose-500">{analytics.bottleneck?.gap.toLocaleString()} Units</span>
            </p>
            <div className="mt-4 flex items-center gap-2">
                <span className="px-2 py-1 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-[9px] font-black rounded-lg border border-rose-100 dark:border-rose-800 uppercase">
                    Action required
                </span>
            </div>
        </div>

        {/* LABOR EFFICIENCY */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-sm group">
            <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Yield per Manpower</p>
                <Users className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-slate-800 dark:text-white font-mono">
                    {analytics.metrics.reduce((s, m) => s + m.yieldPerPerson, 0).toFixed(1)}
                </h3>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Output/Staff</span>
            </div>
            <div className="mt-4 h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: '65%' }} />
            </div>
        </div>

        {/* CUMULATIVE GAP */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-sm group">
            <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cumulative Loss</p>
                <TrendingUp className="w-4 h-4 text-rose-500" />
            </div>
            <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-rose-500 font-mono">
                    {analytics.metrics.reduce((s, m) => s + m.gap, 0).toLocaleString()}
                </h3>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Units</span>
            </div>
            <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-widest italic">Target Fulfillment Gap</p>
        </div>

        {/* TOP PERFORMER */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-emerald-500/20 shadow-sm group">
            <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Process Leader</p>
                <Target className="w-4 h-4 text-emerald-500" />
            </div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase truncate">
                {analytics.topPerformer?.process || 'N/A'}
            </h3>
            <div className="mt-4 flex items-center gap-2">
                <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black rounded-full border border-emerald-100 dark:border-emerald-800 font-mono">
                    {analytics.topPerformer?.efficiency.toFixed(1)}% Eff.
                </span>
            </div>
        </div>
      </div>

      {/* MAIN ANALYSIS CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* BOTTLENECK MATRIX */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-8 rounded-[3rem] shadow-xl border border-gray-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Production Gaps by Station</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Identifying Plan vs Actual Results across all process</p>
            </div>
          </div>
          
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={analytics.metrics} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                <XAxis 
                  dataKey="process" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} 
                  dy={10} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} 
                />
                <Tooltip 
                  cursor={{ fill: isDarkMode ? '#1e293b' : '#f8fafc', opacity: 0.4 }}
                  contentStyle={{ 
                      backgroundColor: isDarkMode ? '#1e293b' : '#fff', 
                      borderRadius: '24px', border: 'none', 
                      boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)', 
                      fontSize: '12px', padding: '16px', fontWeight: 'bold'
                  }}
                />
                <Bar dataKey="plan" name="Target Plan" fill={isDarkMode ? '#1e293b' : '#f1f5f9'} radius={[8, 8, 0, 0]} barSize={40} />
                <Bar dataKey="actual" name="Actual Production" radius={[8, 8, 0, 0]} barSize={25}>
                    {analytics.metrics.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.efficiency >= 90 ? '#4f46e5' : entry.efficiency >= 70 ? '#f59e0b' : '#f43f5e'} />
                    ))}
                </Bar>
                <Line type="monotone" dataKey="gap" name="Variance Gap" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* NODE HEATMAP & INSIGHTS */}
        <div className="space-y-6">
            <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl">
                <div className="flex items-center gap-3 mb-8">
                    <Thermometer className="w-5 h-5 text-rose-500" />
                    <h3 className="text-lg font-black uppercase tracking-widest">Node Health</h3>
                </div>
                
                <div className="space-y-5">
                    {analytics.metrics.map((m) => (
                        <div key={m.process} className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-end">
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{m.process}</span>
                                <span className={`text-[11px] font-black font-mono ${
                                    m.efficiency >= 95 ? 'text-emerald-400' : 
                                    m.efficiency >= 80 ? 'text-indigo-400' : 
                                    'text-rose-400'
                                }`}>{m.efficiency.toFixed(0)}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-1000 ${
                                    m.efficiency >= 95 ? 'bg-emerald-400' : 
                                    m.efficiency >= 80 ? 'bg-indigo-500' : 
                                    'bg-rose-500'
                                }`} style={{ width: `${Math.min(m.efficiency, 100)}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-8 rounded-[3rem] border border-indigo-100 dark:border-indigo-800">
                <div className="flex items-center gap-3 mb-4">
                    <Info className="w-5 h-5 text-indigo-500" />
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Smart Summary</h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-bold">
                    The <span className="text-rose-500">{analytics.bottleneck?.process}</span> node is currently causing a 
                    <span className="text-rose-500"> {analytics.bottleneck?.gap.toLocaleString()} unit</span> drag on output. 
                    Labor efficiency is highest in <span className="text-emerald-500">{analytics.topPerformer?.process}</span>, 
                    averaging <span className="text-emerald-500">{analytics.topPerformer?.yieldPerPerson.toFixed(1)}</span> units per staff member.
                </p>
            </div>
        </div>
      </div>

      {/* PRODUCTION TREND VS TARGET */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] shadow-xl border border-gray-100 dark:border-slate-700">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Daily Output Performance</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Measuring ability to meet daily demand targets</p>
              </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPlan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8' }} 
                  tickFormatter={(val) => val.split('-').slice(1).join('/')}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8' }} />
                <Tooltip 
                   contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: '16px', border: 'none', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="plan" name="Daily Plan" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorPlan)" />
                <Area type="monotone" dataKey="actual" name="Daily Actual" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorActual)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
      </div>
    </div>
  );
};
