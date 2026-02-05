
import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../../services/storageService';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { ProductionEntry, Category } from '../../types';
import { CATEGORIES } from '../../constants';
import { AlertCircle, CheckCircle2, Palmtree, ClipboardCheck, Users, Building2, Filter } from 'lucide-react';
import { getTodayISO, getWeeklyOffDayType } from '../../utils/dateUtils';

export const InputActual: React.FC = () => {
  const { user } = useAuth();
  const { triggerRefresh } = useDashboard();
  const [date, setDate] = useState(getTodayISO());
  const [selectedDept, setSelectedDept] = useState<Category>(CATEGORIES[0]);
  
  const [pendingPlans, setPendingPlans] = useState<ProductionEntry[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  
  const [formData, setFormData] = useState({
    actualQty: '',
    manpower: '0.00',
    batchNo: '',
    actualRemark: ''
  });

  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const offDays = useMemo(() => StorageService.getOffDays(), []);
  const currentOffDay = useMemo(() => {
    const manual = offDays.find(od => od.date === date);
    if (manual) return manual;
    const auto = getWeeklyOffDayType(date);
    if (auto) return { type: auto, description: auto === 'Rest Day' ? 'Friday Weekly Rest' : 'Saturday Weekly Off' };
    return null;
  }, [date, offDays]);

  useEffect(() => {
    const all = StorageService.getProductionData();
    const forDate = all.filter(p => p.date === date && p.category === selectedDept);
    setPendingPlans(forDate);
    setSelectedPlanId('');
    setFormData({ actualQty: '', manpower: '0.00', batchNo: '', actualRemark: '' });
  }, [date, selectedDept]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPlanId) {
      setMsg({ type: 'error', text: 'Please select a job node to update.' });
      return;
    }

    try {
      const allData = StorageService.getProductionData();
      const updatedData = allData.map(entry => {
        if (entry.id === selectedPlanId) {
          return {
            ...entry,
            actualQuantity: parseInt(formData.actualQty || '0'),
            manpower: parseFloat(formData.manpower || '0'),
            batchNo: formData.batchNo,
            actualRemark: formData.actualRemark,
            status: 'Completed' as const,
            lastUpdatedBy: user!.id,
            updatedAt: new Date().toISOString()
          };
        }
        return entry;
      });

      StorageService.saveProductionData(updatedData);
      
      const target = allData.find(e => e.id === selectedPlanId);
      StorageService.addLog({
        userId: user!.id,
        userName: user!.name,
        action: 'RECORD_ACTUAL',
        details: `Recorded output for ${target?.productName}: ${formData.actualQty} units with ${parseFloat(formData.manpower).toFixed(2)} manpower`
      });

      triggerRefresh();
      setMsg({ type: 'success', text: 'Production record updated and synchronized.' });
      
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'ACTUAL PRODUCTION SYNCHRONIZED', type: 'success' } 
      }));

      // Refresh pending list
      setPendingPlans(updatedData.filter(p => p.date === date && p.category === selectedDept));
    } catch (err) {
      setMsg({ type: 'error', text: 'Error communicating with storage.' });
    }
  };

  const inputClasses = "w-full p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500/20";

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-10 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 rounded-2xl">
            <ClipboardCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white">Record Production</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Verify floor output and resources</p>
          </div>
        </div>

        {msg && (
          <div className={`p-5 rounded-2xl mb-8 flex items-center gap-4 animate-pulse ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
            {msg.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            <span className="font-bold text-sm uppercase tracking-tight">{msg.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Review Date</label>
            <input 
              type="date" 
              className={inputClasses}
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1 flex items-center gap-1.5"><Building2 className="w-3 h-3"/> Choose Department</label>
            <select 
              value={selectedDept} 
              onChange={e => setSelectedDept(e.target.value as Category)}
              className={inputClasses}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {currentOffDay && (
            <div className="md:col-span-2 mt-2 p-5 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-2xl flex items-center gap-4">
              <Palmtree className="w-8 h-8 text-amber-500 shrink-0" />
              <div>
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none mb-1">{currentOffDay.type} Alert</p>
                <p className="text-sm font-black text-slate-900 dark:text-amber-50">{currentOffDay.description}</p>
              </div>
            </div>
          )}
        </div>

        <div className="mb-8">
          <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Select Pending {selectedDept} Job Node</label>
          {pendingPlans.length === 0 ? (
            <div className="text-sm text-slate-400 font-bold italic p-8 border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-2xl text-center bg-slate-50/50 dark:bg-slate-900/20">
              No active {selectedDept} plans found for this date.
            </div>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar border border-slate-100 dark:border-slate-700 rounded-2xl p-3 bg-slate-50/50 dark:bg-slate-900/50">
              {pendingPlans.map(plan => (
                <div 
                  key={plan.id}
                  onClick={() => {
                    setSelectedPlanId(plan.id);
                    setFormData(prev => ({ 
                      ...prev, 
                      actualQty: plan.actualQuantity ? plan.actualQuantity.toString() : '',
                      manpower: plan.manpower ? plan.manpower.toFixed(2) : '0.00',
                      batchNo: plan.batchNo || '',
                      actualRemark: plan.actualRemark || ''
                    }));
                  }}
                  className={`p-4 rounded-xl cursor-pointer border-2 transition-all ${
                    selectedPlanId === plan.id 
                      ? 'bg-emerald-50 border-emerald-500 shadow-md ring-4 ring-emerald-500/10 dark:bg-emerald-900/20' 
                      : 'bg-white dark:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-black text-slate-800 dark:text-white uppercase tracking-tight">{plan.productName}</span>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">{plan.category}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">{plan.process}</span>
                    <div className="text-[11px] font-black text-slate-400 uppercase">Target: <span className="text-slate-800 dark:text-white">{plan.planQuantity} {plan.unit}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedPlanId && (
          <form onSubmit={handleSubmit} className="space-y-6 animate-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Actual Yield Qty</label>
                <input 
                  type="number" 
                  min="0"
                  required
                  className={inputClasses.replace('font-bold', 'font-black')}
                  value={formData.actualQty}
                  onChange={e => setFormData({...formData, actualQty: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1 flex items-center gap-1.5">
                  <Users className="w-3 h-3" /> Manpower (2 Decimals)
                </label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  required
                  className={inputClasses}
                  value={formData.manpower}
                  onBlur={() => setFormData(prev => ({...prev, manpower: parseFloat(prev.manpower || '0').toFixed(2)}))}
                  onChange={e => setFormData({...formData, manpower: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Official Batch Number</label>
              <input 
                type="text" 
                required
                placeholder="ENTER LOT / BATCH ID..."
                className={inputClasses.replace('font-bold', 'font-black font-mono')}
                value={formData.batchNo}
                onChange={e => setFormData({...formData, batchNo: e.target.value.toUpperCase()})}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Actual Result Remark</label>
              <textarea 
                placeholder="ENTER DISCREPANCIES OR FLOOR NOTES..."
                className="w-full p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white h-32 resize-none font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={formData.actualRemark}
                onChange={e => setFormData({...formData, actualRemark: e.target.value.toUpperCase()})}
              />
            </div>

            <button 
              type="submit"
              className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl hover:opacity-90 transition-all shadow-xl shadow-emerald-500/20 uppercase tracking-[0.2em] text-sm"
            >
              Verify & Synchronize Record
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
