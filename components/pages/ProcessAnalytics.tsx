import React, { useMemo, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { StorageService } from '../../services/storageService';
import { CATEGORIES, PROCESSES } from '../../constants';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, LineChart, Line, AreaChart, Area, ComposedChart,
  Cell
} from 'recharts';
import { 
  BarChart3, Activity, Target, Zap, 
  Filter, Calendar, ChevronRight, Info,
  TrendingUp, ArrowUpRight, ArrowDownRight,
  GripVertical, MousePointer2
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

  const processMetrics = useMemo(() => {
    const metrics: Record<string, { process: string, plan: number, actual: number, efficiency: number, count: number }> = {};
    
    // Determine which processes are valid for the selected category
    const validProcesses = ['Toothpaste', 'Rocksalt', 'Cosmetic'].includes(selectedCategory)
      ? PROCESSES.filter(p => p !== 'Encapsulation')
      : [...PROCESSES];

    validProcesses.forEach(p => {
      metrics[p] = { process: p, plan: 0, actual: 0, efficiency: 0, count: 0 };
    });

    filteredData.forEach(d => {
      if (metrics[d.process]) {
        metrics[d.process].plan += (d.planQuantity || 0);
        metrics[d.process].actual += (d.actualQuantity || 0);
        metrics[d.process].count++;
      }
    });

    return Object.values(metrics).map(m => ({
      ...m,
      efficiency: m.plan > 0 ? Number(((m.actual / m.plan) * 100).toFixed(1)) : 0
    })).sort((a, b) => b.efficiency - a.efficiency);
  }, [filteredData, selectedCategory]);

  const aggregateMetrics = useMemo(() => {
    const totalPlan = processMetrics.reduce((s, m) => s + m.plan, 0);
    const totalActual = processMetrics.reduce((s, m) => s + m.actual, 0);
    const avgEff = totalPlan > 0 ? (totalActual / totalPlan) * 100 : 0;
    const peakProcess = processMetrics[0];

    return { totalPlan, totalActual, avgEff, peakProcess };
  }, [processMetrics]);

  const dailyTrendData = useMemo(() => {
    const daily: Record<string, { date: string, efficiency: number, actual: number, count: number }> = {};
    
    filteredData.forEach(d => {
      if (!daily[d.date]) daily[d.date] = { date: d.date, efficiency: 0, actual: 0, count: 0 };
      const eff = d.planQuantity > 0 ? (d.actualQuantity / d.planQuantity) * 100 : 0;
      daily[d.date].efficiency += eff;
      daily[d.date].actual += d.actualQuantity;
      daily[d.date].count++;
    });

    return Object.values(daily)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        efficiency: d.count > 0 ? Number((d.efficiency / d.count).toFixed(1)) : 0
      }));
  }, [filteredData]);

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      {/* PROFESSIONAL HEADER BAR */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600 dark:text-indigo-400">Intelligence Bureau</span>
          </div>
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Process <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-500">Analytics</span>
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
              <option value="All">All Departments</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-gray-100 dark:border-slate-700">
            <Calendar className="w-4 h-4 text-slate-400" />
            <div className="flex items-center gap-2">
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
      </div>

      {/* EXECUTIVE SCORECARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-gray-100 dark:border-slate-700 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <TrendingUp className="w-12 h-12 text-indigo-500" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Average Efficiency</p>
            <div className="flex items-baseline gap-2">
                <h3 className="text-4xl font-black text-slate-800 dark:text-white font-mono">{aggregateMetrics.avgEff.toFixed(1)}%</h3>
                <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-0.5">
                    <ArrowUpRight className="w-3 h-3" /> Nominal
                </span>
            </div>
            <div className="mt-4 w-full h-1 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${aggregateMetrics.avgEff}%` }} />
            </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-gray-100 dark:border-slate-700 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <Target className="w-12 h-12 text-emerald-500" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Peak Performance</p>
            <div className="flex flex-col">
                <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter truncate">{aggregateMetrics.peakProcess?.process || 'N/A'}</h3>
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">Top throughput node</span>
            </div>
            <div className="mt-4 flex items-center gap-2">
                <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-black rounded-full border border-emerald-100 dark:border-emerald-800 uppercase tracking-widest">
                    {aggregateMetrics.peakProcess?.efficiency}% Eff.
                </span>
            </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-gray-100 dark:border-slate-700 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <Activity className="w-12 h-12 text-rose-500" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Actual Output</p>
            <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-slate-800 dark:text-white font-mono">{aggregateMetrics.totalActual.toLocaleString()}</h3>
                <span className="text-[10px] font-black text-slate-400 uppercase">Units</span>
            </div>
            <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-widest">Against {aggregateMetrics.totalPlan.toLocaleString()} Plan</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-gray-100 dark:border-slate-700 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <Zap className="w-12 h-12 text-amber-500" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Process Nodes</p>
            <div className="flex items-baseline gap-2">
                <h3 className="text-4xl font-black text-slate-800 dark:text-white font-mono">{processMetrics.length}</h3>
                <span className="text-[10px] font-black text-slate-400 uppercase">Stages</span>
            </div>
            <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-widest">Active Manufacturing Steps</p>
        </div>
      </div>

      {/* CORE VISUALIZATION GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Composed Performance Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-8 rounded-[3rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-gray-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Throughput vs Efficiency</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Correlation analysis across manufacturing nodes</p>
            </div>
            <div className="hidden sm:flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase">Output</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase">Eff. %</span>
                </div>
            </div>
          </div>
          
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={processMetrics} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                <XAxis 
                  dataKey="process" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} 
                  dy={10} 
                />
                <YAxis 
                  yAxisId="left"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} 
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} 
                  domain={[0, 120]}
                />
                <Tooltip 
                  cursor={{ fill: isDarkMode ? '#1e293b' : '#f8fafc', opacity: 0.4 }}
                  contentStyle={{ 
                      backgroundColor: isDarkMode ? '#1e293b' : '#fff', 
                      borderRadius: '24px', 
                      border: 'none', 
                      boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)', 
                      fontSize: '12px',
                      padding: '16px',
                      fontWeight: 'bold'
                  }}
                />
                <Bar yAxisId="left" dataKey="actual" name="Actual Production" radius={[8, 8, 0, 0]} barSize={40}>
                    {processMetrics.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.efficiency >= 90 ? '#4f46e5' : '#f43f5e'} />
                    ))}
                </Bar>
                <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="efficiency" 
                    stroke="#f59e0b" 
                    strokeWidth={4} 
                    dot={{ fill: '#f59e0b', r: 5, strokeWidth: 2, stroke: '#fff' }} 
                    activeDot={{ r: 8 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Process Node List - Right Column */}
        <div className="space-y-6">
            <div className="bg-indigo-600 p-8 rounded-[3rem] text-white shadow-xl shadow-indigo-200">
                <h3 className="text-xl font-black mb-1">Process Nodes</h3>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Real-time status monitor</p>
                
                <div className="mt-8 space-y-6">
                    {processMetrics.slice(0, 5).map((m, idx) => (
                        <div key={m.process} className="flex flex-col gap-2">
                            <div className="flex justify-between items-end">
                                <span className="text-xs font-black uppercase tracking-widest">{m.process}</span>
                                <span className="text-sm font-black font-mono">{m.efficiency}%</span>
                            </div>
                            <div className="w-full h-2 bg-indigo-500/30 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-1000 ${
                                    m.efficiency >= 95 ? 'bg-emerald-400' : 
                                    m.efficiency >= 85 ? 'bg-white' : 
                                    'bg-rose-400'
                                }`} style={{ width: `${Math.min(m.efficiency, 100)}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
                
                <button className="w-full mt-10 py-4 bg-white/10 hover:bg-white/20 rounded-2xl border border-white/20 text-[10px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-2">
                    <MousePointer2 className="w-3 h-3" /> View Full Network
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-6">
                    <Zap className="w-5 h-5 text-amber-500" />
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">Quick Insight</h3>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    The <span className="font-black text-indigo-600 dark:text-indigo-400">{aggregateMetrics.peakProcess?.process || 'Main'}</span> node is operating at peak capacity. Overall manufacturing velocity is <span className="font-black text-emerald-500">Nominal</span> for this period.
                </p>
            </div>
        </div>
      </div>

      {/* TREND ANALYSIS & DETAILED MATRIX */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* Momentum Area Chart */}
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-10">
                <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">Production Momentum</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Efficiency trajectory over selected timeline</p>
                </div>
                <TrendingUp className="w-6 h-6 text-indigo-500/20" />
            </div>

            <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyTrendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorMomentum" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                        <XAxis 
                          dataKey="date" 
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
                            contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="efficiency" 
                          stroke="#6366f1" 
                          strokeWidth={4} 
                          fillOpacity={1} 
                          fill="url(#colorMomentum)" 
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Professional Efficiency Matrix */}
        <div className="bg-white dark:bg-slate-800 rounded-[3rem] border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
            <div className="p-8 border-b border-gray-50 dark:border-slate-700 flex items-center justify-between bg-gray-50/50 dark:bg-slate-900/50">
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Efficiency Matrix</h3>
                <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 py-2 bg-white dark:bg-slate-800 rounded-full border border-gray-100 dark:border-slate-700 shadow-sm">
                    <MousePointer2 className="w-3 h-3" /> Data Density: High
                </div>
            </div>
            
            <div className="overflow-x-auto flex-1 custom-scrollbar">
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-white dark:bg-slate-800 border-b dark:border-slate-700">
                            <th className="px-8 py-5">Manufacturing Node</th>
                            <th className="px-8 py-5">Throughput</th>
                            <th className="px-8 py-5">Efficiency</th>
                            <th className="px-8 py-5 text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                        {processMetrics.map((m, idx) => (
                            <tr key={m.process} className="hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 transition-colors group">
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-1.5 h-6 rounded-full ${m.efficiency >= 95 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : m.efficiency >= 85 ? 'bg-indigo-500' : 'bg-rose-500'}`} />
                                        <span className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">{m.process}</span>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="font-mono font-black text-slate-700 dark:text-slate-300">{m.actual.toLocaleString()} <span className="text-[10px] opacity-40">VOL</span></div>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm font-black text-slate-900 dark:text-white font-mono w-12">{m.efficiency}%</span>
                                        <div className="w-24 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full hidden sm:block">
                                            <div className={`h-full rounded-full transition-all duration-700 ${m.efficiency >= 90 ? 'bg-indigo-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(m.efficiency, 100)}%` }} />
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                                        m.efficiency >= 95 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                        m.efficiency >= 85 ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                                        'bg-rose-50 text-rose-600 border border-rose-100'
                                    }`}>
                                        {m.efficiency >= 95 ? 'Peak' : m.efficiency >= 85 ? 'Nominal' : 'Audit'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
};