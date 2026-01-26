
import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../../services/storageService';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { ProductionEntry } from '../../types';
import { AlertCircle, CheckCircle2, Palmtree, MessageSquare } from 'lucide-react';
import { getTodayISO } from '../../utils/dateUtils';

export const InputActual: React.FC = () => {
  const { user } = useAuth();
  const { triggerRefresh } = useDashboard();
  const [date, setDate] = useState(getTodayISO());
  
  const [pendingPlans, setPendingPlans] = useState<ProductionEntry[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  
  const [formData, setFormData] = useState({
    actualQty: '',
    manpower: '0',
    batchNo: '',
    actualRemark: ''
  });

  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const offDays = useMemo(() => StorageService.getOffDays(), []);
  const currentOffDay = useMemo(() => offDays.find(od => od.date === date), [date, offDays]);

  useEffect(() => {
    if (currentOffDay) {
        window.dispatchEvent(new CustomEvent('app-notification', { 
            detail: { message: `HOLIDAY DETECTED: ${currentOffDay.description}`, type: 'info' } 
        }));
    }
  }, [currentOffDay]);

  useEffect(() => {
    const all = StorageService.getProductionData();
    const forDate = all.filter(p => p.date === date);
    setPendingPlans(forDate);
    setSelectedPlanId('');
    setFormData({ actualQty: '', manpower: '0', batchNo: '', actualRemark: '' });
  }, [date]);

  const handleAutoBatch = () => {
    const r = Math.floor(Math.random() * 10000);
    const b = `B-${date.replace(/-/g, '')}-${r}`;
    setFormData(prev => ({ ...prev, batchNo: b }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentOffDay) {
      setMsg({ type: 'error', text: 'Cannot enter data on an Off Day.' });
      return;
    }

    if (!selectedPlanId) {
      setMsg({ type: 'error', text: 'Please select a production plan to update.' });
      return;
    }

    try {
      const allData = StorageService.getProductionData();
      const updatedData = allData.map(entry => {
        if (entry.id === selectedPlanId) {
          return {
            ...entry,
            actualQuantity: parseInt(formData.actualQty),
            manpower: parseFloat(formData.manpower),
            batchNo: formData.batchNo,
            actualRemark: formData.actualRemark,
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
        details: `Updated actuals for ${target?.productName}: ${formData.actualQty} units`
      });

      triggerRefresh();
      setMsg({ type: 'success', text: 'Actual data updated successfully.' });
      
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'ACTUAL PRODUCTION RECORDED', type: 'success' } 
      }));

      const forDate = updatedData.filter(p => p.date === date);
      setPendingPlans(forDate);
    } catch (err) {
      setMsg({ type: 'error', text: 'Error saving data.' });
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-8">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Input Actual Production</h2>

        {msg && (
          <div className={`p-4 rounded-lg mb-6 flex items-center ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5 mr-2" /> : <AlertCircle className="w-5 h-5 mr-2" />}
            {msg.text}
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Date</label>
          <input 
            type="date" 
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-slate-900 dark:text-white font-bold"
            value={date}
            onChange={e => setDate(e.target.value)}
          />

          {currentOffDay && (
            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-4">
              <div className="p-3 bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-500/20">
                <Palmtree className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none mb-1">System Restriction</p>
                <p className="text-sm font-black text-slate-800 dark:text-amber-100">Public Holiday: {currentOffDay.description}</p>
                <p className="text-[10px] font-bold text-amber-500 mt-1 uppercase">Production entry is disabled today</p>
              </div>
            </div>
          )}
        </div>

        {!currentOffDay && (
          <>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Job / Plan</label>
              {pendingPlans.length === 0 ? (
                <div className="text-sm text-gray-500 italic p-3 border rounded bg-gray-50 dark:bg-slate-900 dark:border-slate-700">No plans found for this date. Ask a planner to input data first.</div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 dark:border-slate-700 rounded-lg p-2">
                  {pendingPlans.map(plan => (
                    <div 
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`p-3 rounded-md cursor-pointer border transition-colors ${
                        selectedPlanId === plan.id 
                          ? 'bg-brand-50 border-brand-500 ring-1 ring-brand-500 dark:bg-brand-900/20' 
                          : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-800 dark:text-white">{plan.productName}</span>
                        <span className="text-xs bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded text-gray-600 dark:text-gray-400">{plan.category}</span>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 flex justify-between mt-1">
                        <span>{plan.process}</span>
                        <span>Plan: {plan.planQuantity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedPlanId && (
              <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Actual Quantity</label>
                    <input 
                      type="number" 
                      min="0"
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-slate-900 dark:text-white"
                      value={formData.actualQty}
                      onChange={e => setFormData({...formData, actualQty: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Manpower</label>
                    <input 
                      type="number" 
                      step="any"
                      min="0"
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-slate-900 dark:text-white"
                      value={formData.manpower}
                      onChange={e => setFormData({...formData, manpower: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Batch Number</label>
                  <div className="flex space-x-2">
                    <input 
                      type="text" 
                      required
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-slate-900 dark:text-white"
                      value={formData.batchNo}
                      onChange={e => setFormData({...formData, batchNo: e.target.value})}
                    />
                    <button
                      type="button"
                      onClick={handleAutoBatch}
                      className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600"
                    >
                      Generate
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-slate-400" /> Actual Remark
                  </label>
                  <textarea 
                    placeholder="Notes from production floor, variances, downtime reasons..."
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-slate-900 dark:text-white h-24 resize-none"
                    value={formData.actualRemark}
                    onChange={e => setFormData({...formData, actualRemark: e.target.value.toUpperCase()})}
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-brand-600 text-white font-semibold py-2.5 rounded-lg hover:bg-brand-700 transition-colors shadow-sm"
                >
                  Update Production Data
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};
