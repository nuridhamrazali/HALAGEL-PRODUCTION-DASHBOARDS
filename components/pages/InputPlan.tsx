
import React, { useState, useMemo, useEffect } from 'react';
import { CATEGORIES, PROCESSES, UNITS } from '../../constants';
import { StorageService } from '../../services/storageService';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { ProductionEntry } from '../../types';
import { AlertCircle, CheckCircle2, Palmtree, MessageSquare } from 'lucide-react';
import { getTodayISO } from '../../utils/dateUtils';

export const InputPlan: React.FC = () => {
  const { user } = useAuth();
  const { triggerRefresh } = useDashboard();
  const [formData, setFormData] = useState({
    date: getTodayISO(),
    category: CATEGORIES[0],
    process: PROCESSES[0],
    productName: '',
    quantity: '',
    unit: UNITS[0],
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
        category: formData.category as any,
        process: formData.process as any,
        productName: formData.productName,
        planQuantity: parseInt(formData.quantity),
        actualQuantity: 0,
        unit: formData.unit as any,
        planRemark: formData.planRemark,
        // Fix: Added missing status property
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
    <div className="max-w-2xl mx-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-8">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Input Production Plan</h2>
        
        {msg && (
          <div className={`p-4 rounded-lg mb-6 flex items-center ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5 mr-2" /> : <AlertCircle className="w-5 h-5 mr-2" />}
            {msg.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
              <input 
                type="date" 
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-slate-900 dark:text-white"
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
              />
              
              {currentOffDay && (
                <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-3">
                  <Palmtree className="w-5 h-5 text-amber-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none mb-1">Public Holiday</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-amber-100">{currentOffDay.description}</p>
                  </div>
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
              <select 
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-slate-900 dark:text-white"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value as any})}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Process</label>
              <select 
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-slate-900 dark:text-white"
                value={formData.process}
                onChange={e => setFormData({...formData, process: e.target.value as any})}
              >
                {PROCESSES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Plan Quantity</label>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  min="1"
                  required
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-slate-900 dark:text-white"
                  value={formData.quantity}
                  onChange={e => setFormData({...formData, quantity: e.target.value})}
                />
                <select 
                  className="w-24 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-slate-900 dark:text-white"
                  value={formData.unit}
                  onChange={e => setFormData({...formData, unit: e.target.value as any})}
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Name</label>
            <input 
              type="text" 
              required
              placeholder="e.g. PAIN RELIEF GEL 50G"
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-slate-900 dark:text-white"
              value={formData.productName}
              onChange={e => setFormData({...formData, productName: e.target.value.toUpperCase()})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-slate-400" /> Plan Remark
            </label>
            <textarea 
              placeholder="Planning notes, requirements or urgency..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-slate-900 dark:text-white h-24 resize-none"
              value={formData.planRemark}
              onChange={e => setFormData({...formData, planRemark: e.target.value.toUpperCase()})}
            />
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              disabled={!!currentOffDay}
              className="w-full bg-brand-600 text-white font-semibold py-2.5 rounded-lg hover:bg-brand-700 transition-colors shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {currentOffDay ? 'Off Day - Entry Locked' : 'Submit Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
