
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { StorageService } from '../../services/storageService';
import { CATEGORIES, PROCESSES, UNITS } from '../../constants';
import { ProductionEntry, Category, ProcessType, UnitType, ProductionStatus, OffDay } from '../../types';
import { X, Loader2, Palmtree, MessageSquare, Ban } from 'lucide-react';
import { getTodayISO, getDbTimestamp } from '../../utils/dateUtils';

interface InputModalProps {
  onClose: () => void;
  editEntry?: ProductionEntry | null;
}

export const InputModal: React.FC<InputModalProps> = ({ onClose, editEntry }) => {
  const { user, hasPermission } = useAuth();
  const { triggerRefresh } = useDashboard();
  const [tab, setTab] = useState<'Plan' | 'Actual'>('Plan');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [date, setDate] = useState(getTodayISO());
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [process, setProcess] = useState<ProcessType>(PROCESSES[0]);
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<UnitType>('KG');
  const [manpower, setManpower] = useState('0.00');
  const [batchNo, setBatchNo] = useState('');
  const [planRemark, setPlanRemark] = useState('');
  const [actualRemark, setActualRemark] = useState('');
  
  const [plans, setPlans] = useState<ProductionEntry[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  const offDays = useMemo(() => StorageService.getOffDays(), []);
  
  const currentOffDay = useMemo(() => {
    const inputDate = (date || '').trim().split(' ')[0];
    return offDays.find((od: OffDay) => (od.date || '').trim().split(' ')[0] === inputDate);
  }, [date, offDays]);

  const isLocked = !editEntry && !!currentOffDay;

  const availableProcesses = useMemo(() => {
    if (category === 'Healthcare') return [...PROCESSES];
    return PROCESSES.filter(p => !['Encapsulation', 'Blister', 'Capsules'].includes(p));
  }, [category]);

  const inputClasses = "w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm";

  useEffect(() => {
    if (!availableProcesses.includes(process)) {
      setProcess(availableProcesses[0]);
    }
  }, [category, availableProcesses, process]);

  useEffect(() => {
    if (editEntry) {
      setDate((editEntry.date || '').trim().split(' ')[0]);
      setCategory(editEntry.category);
      setProcess(editEntry.process);
      setProductName(editEntry.productName);
      setUnit(editEntry.unit || 'KG');
      
      if (editEntry.actualQuantity > 0) {
        setTab('Actual');
        setQuantity(editEntry.actualQuantity.toString());
      } else {
        setTab('Plan');
        setQuantity(editEntry.planQuantity.toString());
      }
      
      setManpower(editEntry.manpower ? Number(editEntry.manpower).toFixed(2) : '0.00');
      setBatchNo(editEntry.batchNo || '');
      setPlanRemark(editEntry.planRemark || '');
      setActualRemark(editEntry.actualRemark || '');
    } else {
      if (user?.role === 'operator') setTab('Actual');
      else if (user?.role === 'planner') setTab('Plan');
    }
  }, [editEntry, user]);

  useEffect(() => {
    if (tab === 'Actual' && !editEntry) {
        const all = StorageService.getProductionData();
        const normalizedInputDate = (date || '').trim().split(' ')[0];
        const relevant = all.filter((p: ProductionEntry) => (p.date || '').trim().split(' ')[0] === normalizedInputDate);
        setPlans(relevant);
        setSelectedPlanId('');
    }
  }, [date, tab, editEntry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    setIsSubmitting(true);
    const normalizedDate = (date || '').trim().split(' ')[0];
    const currentData = StorageService.getProductionData();
    
    try {
        if (editEntry) {
            const updated = currentData.map((p: ProductionEntry) => {
                if (p.id === editEntry.id) {
                    const newQty = parseInt(quantity || '0');
                    return { 
                        ...p, 
                        date: normalizedDate, 
                        category, process, productName, unit,
                        planQuantity: tab === 'Plan' ? newQty : p.planQuantity,
                        actualQuantity: tab === 'Actual' ? newQty : p.actualQuantity,
                        batchNo, manpower: parseFloat(manpower || '0'),
                        planRemark,
                        actualRemark,
                        status: (tab === 'Actual' && newQty > 0 ? 'Completed' : p.status) as ProductionStatus,
                        lastUpdatedBy: user!.id, updatedAt: getDbTimestamp()
                    } as ProductionEntry;
                }
                return p;
            });
            await StorageService.saveProductionData(updated);
            await StorageService.addLog({
                userId: user!.id,
                userName: user!.name,
                action: 'EDIT_RECORD',
                details: `Modified record for ${productName} (${normalizedDate})`
            });
        } else {
            if (tab === 'Plan') {
                const newEntry: ProductionEntry = {
                    id: Date.now().toString(),
                    date: normalizedDate, 
                    category, process, productName, unit,
                    planQuantity: parseInt(quantity || '0'), actualQuantity: 0,
                    planRemark,
                    actualRemark: '',
                    status: 'In Progress',
                    lastUpdatedBy: user!.id, updatedAt: getDbTimestamp()
                };
                await StorageService.saveProductionData([...currentData, newEntry]);
                await StorageService.addLog({
                    userId: user!.id,
                    userName: user!.name,
                    action: 'CREATE_PLAN',
                    details: `Planned ${newEntry.planQuantity} ${unit} for ${productName}`
                });
            } else {
                if (!selectedPlanId) throw new Error("Please select a plan");
                const updated = currentData.map((p: ProductionEntry) => {
                    if (p.id === selectedPlanId) {
                        return { 
                            ...p, 
                            actualQuantity: parseInt(quantity || '0'), 
                            unit, batchNo, manpower: parseFloat(manpower || '0'),
                            actualRemark, status: 'Completed' as ProductionStatus,
                            lastUpdatedBy: user!.id, updatedAt: getDbTimestamp()
                        } as ProductionEntry;
                    }
                    return p;
                });
                await StorageService.saveProductionData(updated);
                await StorageService.addLog({
                    userId: user!.id,
                    userName: user!.name,
                    action: 'RECORD_ACTUAL',
                    details: `Recorded ${quantity} ${unit} for ${productName} (Batch: ${batchNo})`
                });
            }
        }

        window.dispatchEvent(new CustomEvent('app-notification', { 
            detail: { message: tab === 'Actual' ? 'PRODUCTION COMPLETED' : 'PLAN SAVED', type: 'success' } 
        }));
        triggerRefresh();
        onClose();
    } catch (err: any) {
        window.dispatchEvent(new CustomEvent('app-notification', { detail: { message: 'Operation failed', type: 'info' } }));
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 relative max-h-[90vh] flex flex-col">
        {isSubmitting && (
            <div className="absolute inset-0 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm z-[60] flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-2" />
                <p className="text-xs font-black uppercase tracking-widest text-indigo-600">Uploading to Cloud...</p>
            </div>
        )}

        <div className="flex border-b border-gray-200 dark:border-slate-700 shrink-0">
            {!editEntry ? (
              <>
                {hasPermission(['admin', 'manager', 'planner']) && (
                    <button onClick={() => setTab('Plan')} 
                        className={`flex-1 py-4 font-black text-[11px] uppercase tracking-widest text-center transition border-b-2 ${tab === 'Plan' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                        1. Production Plan
                    </button>
                )}
                {hasPermission(['admin', 'manager', 'operator']) && (
                    <button onClick={() => setTab('Actual')} 
                        className={`flex-1 py-4 font-black text-[11px] uppercase tracking-widest text-center transition border-b-2 ${tab === 'Actual' ? 'border-emerald-50 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                        2. Record Actual
                    </button>
                )}
              </>
            ) : (
              <div className="flex-1 flex overflow-hidden">
                <button onClick={() => setTab('Plan')} className={`flex-1 py-4 font-black text-[11px] uppercase tracking-widest transition border-b-2 ${tab === 'Plan' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/10' : 'border-transparent text-slate-400'}`}>
                    Plan Details
                </button>
                <button onClick={() => setTab('Actual')} className={`flex-1 py-4 font-black text-[11px] uppercase tracking-widest transition border-b-2 ${tab === 'Actual' ? 'border-emerald-50 text-emerald-600 bg-emerald-50/10' : 'border-transparent text-slate-400'}`}>
                    Actual Results
                </button>
              </div>
            )}
        </div>

        <div className="p-6 relative overflow-y-auto custom-scrollbar flex-1">
            <button onClick={onClose} className="absolute top-2 right-4 text-slate-300 hover:text-rose-500 transition-colors z-20"><X className="w-5 h-5" /></button>
            
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Production Date</label>
                    <input type="date" required value={date} onChange={e => setDate(e.target.value)} className={inputClasses} />
                    
                    {currentOffDay && (
                      <div className={`mt-3 p-3 border rounded-xl flex items-center gap-3 shadow-sm ${
                        currentOffDay.type === 'Public Holiday' ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800' :
                        currentOffDay.type === 'Rest Day' ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' :
                        'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                      }`}>
                        <div className={`p-2 rounded-lg text-white ${
                            currentOffDay.type === 'Public Holiday' ? 'bg-rose-500' :
                            currentOffDay.type === 'Rest Day' ? 'bg-indigo-500' :
                            'bg-amber-500'
                        }`}>
                          <Ban className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 ${
                                currentOffDay.type === 'Public Holiday' ? 'text-rose-600 dark:text-rose-400' :
                                currentOffDay.type === 'Rest Day' ? 'text-indigo-600 dark:text-indigo-400' :
                                'text-amber-600 dark:text-amber-400'
                          }`}>{currentOffDay.type}</p>
                          <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">{currentOffDay.description}</p>
                        </div>
                      </div>
                    )}
                </div>

                {tab === 'Plan' ? (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Category</label>
                                <select value={category} onChange={e => setCategory(e.target.value as Category)} className={inputClasses}>
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Process</label>
                                <select value={process} onChange={e => setProcess(e.target.value as ProcessType)} className={inputClasses}>
                                    {availableProcesses.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Product Name</label>
                            <input type="text" required value={productName} onChange={e => setProductName(e.target.value.toUpperCase())} className={inputClasses} placeholder="Enter product name..." />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex-1">
                                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Target Plan Qty</label>
                                <input type="number" required min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className={inputClasses} />
                            </div>
                            <div className="w-24">
                                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Unit</label>
                                <select value={unit} onChange={e => setUnit(e.target.value as UnitType)} className={inputClasses}>
                                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 flex items-center gap-1.5"><MessageSquare className="w-3 h-3" /> Plan Remark</label>
                            <textarea value={planRemark} onChange={e => setPlanRemark(e.target.value.toUpperCase())} className={`${inputClasses} h-20 resize-none font-medium text-xs`} placeholder="ADD PLANNING NOTES..." />
                        </div>
                    </>
                ) : (
                    <>
                        {!editEntry && (
                          <div className="mb-4">
                               <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Select Pending Job</label>
                               {plans.length === 0 ? <div className="text-xs text-slate-400 italic text-center p-6 border-2 border-dashed rounded-xl">No plans found for this date.</div> : (
                                   <div className="max-h-40 overflow-y-auto border rounded-xl p-2 space-y-1 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                                       {plans.map(p => (
                                           <div key={p.id} onClick={() => { setSelectedPlanId(p.id); setProductName(p.productName); setProcess(p.process); setCategory(p.category); }}
                                              className={`p-3 rounded-lg cursor-pointer transition ${selectedPlanId === p.id ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'}`}>
                                              <div className="font-black text-sm">{p.productName}</div>
                                              <div className={`text-[10px] font-bold uppercase ${selectedPlanId === p.id ? 'text-emerald-100' : 'text-slate-400'}`}>{p.process} • Plan: {p.planQuantity} {p.unit || 'KG'}</div>
                                           </div>
                                       ))}
                                   </div>
                               )}
                          </div>
                        )}
                        {(selectedPlanId || editEntry) && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Actual Result Qty</label>
                                        <input type="number" required value={quantity} onChange={e => setQuantity(e.target.value)} className={inputClasses} />
                                    </div>
                                    <div className="w-24">
                                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Unit</label>
                                        <select value={unit} onChange={e => setUnit(e.target.value as UnitType)} className={inputClasses}>
                                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="col-span-2">
                                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Batch Number</label>
                                    <input type="text" required value={batchNo} onChange={e => setBatchNo(e.target.value)} className={inputClasses} placeholder="Enter batch ID..." />
                                  </div>
                                  <div className="col-span-2">
                                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Manpower Used</label>
                                    <input type="number" required step="0.01" value={manpower} onChange={e => setManpower(e.target.value)} className={inputClasses} />
                                  </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 flex items-center gap-1.5"><MessageSquare className="w-3 h-3" /> Actual Remark</label>
                                    <textarea value={actualRemark} onChange={e => setActualRemark(e.target.value.toUpperCase())} className={`${inputClasses} h-20 resize-none font-medium text-xs`} placeholder="ADD ACTUAL NOTES..." />
                                </div>
                            </>
                        )}
                    </>
                )}

                <button 
                    type="submit" 
                    disabled={isSubmitting || isLocked} 
                    className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] text-white mt-4 shadow-xl transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isLocked ? 'bg-slate-400 dark:bg-slate-700' : tab === 'Plan' ? 'bg-slate-900 dark:bg-indigo-600' : 'bg-emerald-600'
                    }`}
                >
                    {isSubmitting ? 'Syncing...' : isLocked ? 'Locked - Non Working Day' : (tab === 'Actual' ? 'Submit & Mark Completed' : 'Save Plan Entry')}
                </button>
            </form>
        </div>
      </div>
    </div>
  );
};
