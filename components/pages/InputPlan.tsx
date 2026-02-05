
import React, { useState, useMemo, useEffect } from 'react';
import { CATEGORIES, PROCESSES, UNITS } from '../../constants';
import { StorageService } from '../../services/storageService';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { ProductionEntry, Category, ProcessType, UnitType } from '../../types';
import { AlertCircle, CheckCircle2, Palmtree, MessageSquare } from 'lucide-react';
import { getTodayISO } from '../../utils/dateUtils';

interface PlanFormState {
  date: string;
  category: Category;
  process: ProcessType;
  productName: string;
  quantity: string;
  unit: UnitType;
  planRemark: string;
}

export const InputPlan: React.FC = () => {
  const { user } = useAuth();
  const { triggerRefresh } = useDashboard();
  
  const [formData, setFormData] = useState<PlanFormState>({
    date: getTodayISO(),
    category: CATEGORIES[0] as Category,
    process: PROCESSES[0] as ProcessType,
    productName: '',
    quantity: '',
    unit: UNITS[0] as UnitType,
    planRemark: ''
  });
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const offDays = useMemo(() => StorageService.getOffDays(), []);
  const currentOffDay = useMemo(() => offDays.find(od => od.date === formData.date), [formData.date, offDays]);

  useEffect(() => {
    if (currentOffDay) {
        window.dispatchEvent(new CustomEvent('app-notification', { 
            detail: { message: `HOLIDAY ALERT: ${currentOffDay.description}`, type: 'info' } 
        }));
    }
  }, [currentOffDay]);

  const availableProcesses = useMemo(() => {
    if (formData.category === 'Healthcare') return [...PROCESSES] as ProcessType[];
    
    let filtered = PROCESSES.filter(p => !['Encapsulation', 'Blister', 'Capsules'].includes(p));
    
    if (formData.category === 'Rocksalt') {
      filtered = filtered.filter(p => p !== 'Mixing' && p !== 'Sorting');
    } else if (formData.category === 'Toothpaste') {
      filtered = filtered.filter(p => p !== 'Filling' && p !== 'Sorting');
    } else if (formData.category === 'Cosmetic') {
      filtered = filtered.filter(p => p !== 'Sorting');
    }
    
    return filtered as ProcessType[];
  }, [formData.category]);

  useEffect(() => {
    if (!availableProcesses.includes(formData.process)) {
      setFormData(prev => ({ ...prev, process: availableProcesses[0] }));
    }
  }, [availableProcesses, formData.process]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentOffDay) {
      setMsg({ type: 'error', text: `Selected date is an Off Day: ${currentOffDay.description}.` });
      return;
    }

    if (!formData.productName || !formData.quantity) {
      setMsg({ type: 'error', text: 'Please fill all required fields.' });
      return;
    }

    try {
      const entries = StorageService.getProductionData();
      
      const newEntry: ProductionEntry = {
        id: Date.now().toString(),
        date: formData.date,
        category: formData.category,
        process: formData.process,
        productName: formData.productName,
        planQuantity: parseInt(formData.quantity),
        actualQuantity: 0,
        unit: formData.unit,
        planRemark: formData.planRemark,
        status: 'In Progress',
        lastUpdatedBy: user!.id,
        updatedAt: new Date().toISOString()
      };

      StorageService.saveProductionData([...entries, newEntry]);
      StorageService.addLog({
        userId: user!.id,
        userName: user!.name,
        action: 'CREATE_PLAN',
        details: `Planned ${newEntry.planQuantity} ${newEntry.unit} for ${newEntry.productName} on ${newEntry.date}`
      });

      triggerRefresh();
      setMsg({ type: 'success', text: 'Plan entry added successfully.' });
      setFormData(prev => ({ ...prev, productName: '', quantity: '', planRemark: '' }));
      
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'PRODUCTION PLAN SUBMITTED', type: 'success' } 
      }));
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to save data.' });
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-10 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-900/40 rounded-2xl">
            <MessageSquare className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white">New Production Plan</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Initialize production targets</p>
          </div>
        </div>
        
        {msg && (
          <div className={`p-5 rounded-2xl mb-8 flex items-center gap-4 animate-pulse ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
            {msg.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            <span className="font-bold text-sm uppercase tracking-tight">{msg.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Production Date</label>
              <input 
                type="date" 
                required
                className="w-full p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
              />
              
              {currentOffDay && (
                <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-4">
                  <Palmtree className="w-6 h-6 text-amber-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none mb-1">Non-Working Day</p>
                    <p className="text-xs font-black text-slate-800 dark:text-amber-100">{currentOffDay.description}</p>
                  </div>
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Department</label>
              <select 
                className="w-full p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value as Category})}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Process Node</label>
              <select 
                className="w-full p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={formData.process}
                onChange={e => setFormData({...formData, process: e.target.value as ProcessType})}
              >
                {availableProcesses.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Planned Quantity</label>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  min="1"
                  required
                  placeholder="0"
                  className="flex-1 p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-black outline-none focus:ring-2 focus:ring-indigo-500/20"
                  value={formData.quantity}
                  onChange={e => setFormData({...formData, quantity: e.target.value})}
                />
                <select 
                  className="w-24 p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-bold outline-none"
                  value={formData.unit}
                  onChange={e => setFormData({...formData, unit: e.target.value as UnitType})}
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Product Description</label>
            <input 
              type="text" 
              required
              placeholder="E.G. TOOTHPASTE HERBAL 150G"
              className="w-full p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-black outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={formData.productName}
              onChange={e => setFormData({...formData, productName: e.target.value.toUpperCase()})}
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Planning Remark</label>
            <textarea 
              placeholder="OPTIONAL PLANNING NOTES..."
              className="w-full p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white h-32 resize-none font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={formData.planRemark}
              onChange={e => setFormData({...formData, planRemark: e.target.value.toUpperCase()})}
            />
          </div>

          <div className="pt-6">
            <button 
              type="submit"
              disabled={!!currentOffDay}
              className="w-full bg-slate-900 dark:bg-indigo-600 text-white font-black py-4 rounded-2xl hover:opacity-90 transition-all shadow-xl shadow-indigo-500/10 disabled:bg-slate-300 disabled:cursor-not-allowed uppercase tracking-[0.2em] text-sm"
            >
              {currentOffDay ? 'Locked - Non Working Day' : 'Secure Plan Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
