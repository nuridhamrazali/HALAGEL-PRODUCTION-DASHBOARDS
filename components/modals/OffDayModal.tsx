
import React, { useState } from 'react';
import { StorageService } from '../../services/storageService';
import { OffDay, OffDayType } from '../../types';
import { X, Trash2, CalendarX, Tag } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { OFF_DAY_TYPES } from '../../constants';

export const OffDayModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const { triggerRefresh } = useDashboard();
  const [offDays, setOffDays] = useState<OffDay[]>(StorageService.getOffDays());
  const [date, setDate] = useState('');
  const [desc, setDesc] = useState('');
  const [type, setType] = useState<OffDayType>('Public Holiday');

  const inputClasses = "w-full p-2.5 border border-slate-200 bg-white text-slate-900 font-bold rounded-xl outline-none shadow-sm dark:bg-slate-900 dark:border-slate-700 dark:text-white";

  const handleAdd = () => {
      if(!date) return;
      if(offDays.some(od => od.date === date)) return alert('Already set as a non-working day');
      
      const newOd: OffDay = { 
        id: Date.now().toString(), 
        date, 
        description: desc || type, 
        type,
        createdBy: user!.id 
      };
      
      const updated = [...offDays, newOd].sort((a,b) => (a.date || '').localeCompare(b.date || ''));
      StorageService.saveOffDays(updated);
      
      StorageService.addLog({
        userId: user!.id,
        userName: user!.name,
        action: 'ADD_HOLIDAY',
        details: `Set ${type}: ${newOd.description} (${newOd.date})`
      });

      setOffDays(updated);
      triggerRefresh();
      
      window.dispatchEvent(new CustomEvent('app-notification', { 
          detail: { message: `${type.toUpperCase()} SET: ${newOd.description.toUpperCase()}`, type: 'success' } 
      }));
      
      setDate(''); setDesc('');
  };

  const handleRemove = (id: string) => {
      const target = offDays.find(od => od.id === id);
      const updated = offDays.filter(od => od.id !== id);
      StorageService.saveOffDays(updated);
      
      StorageService.addLog({
        userId: user!.id,
        userName: user!.name,
        action: 'DELETE_HOLIDAY',
        details: `Removed non-working day: ${target?.description} (${target?.date})`
      });

      setOffDays(updated);
      triggerRefresh();
      window.dispatchEvent(new CustomEvent('app-notification', { 
          detail: { message: 'DATE RESTORED TO WORKING STATUS', type: 'info' } 
      }));
  };

  const getTypeStyle = (t: OffDayType) => {
    switch(t) {
      case 'Public Holiday': return 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400';
      case 'Rest Day': return 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400';
      case 'Off Day': return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] w-[450px] max-w-full shadow-2xl p-8 animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-black text-xl flex items-center gap-2 text-slate-800 dark:text-white">
                <CalendarX className="text-rose-500 w-6 h-6"/> Non-Working Days
              </h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Manage manual locks on production</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
              <X className="text-gray-400 w-5 h-5" />
            </button>
        </div>

        <div className="space-y-4 mb-8 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[1.5rem] border border-slate-100 dark:border-slate-700">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Date Selection</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClasses} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Day Category</label>
                <select value={type} onChange={e => setType(e.target.value as OffDayType)} className={inputClasses}>
                    {OFF_DAY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason / Description</label>
                <input type="text" placeholder="e.g. Deepavali, Maintenance Day..." value={desc} onChange={e => setDesc(e.target.value)} className={inputClasses} />
            </div>
            <button onClick={handleAdd} className="w-full bg-slate-900 dark:bg-indigo-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:opacity-90 shadow-xl transition-all active:scale-[0.98]">
              Lock Selected Date
            </button>
        </div>

        <div className="max-h-[300px] overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-700 rounded-[1.5rem] bg-white dark:bg-slate-800">
            {offDays.length === 0 ? (
                <div className="text-center py-16 px-8 flex flex-col items-center gap-4">
                    <CalendarX className="w-12 h-12 text-slate-100 dark:text-slate-700" />
                    <p className="text-slate-400 text-xs font-black uppercase tracking-widest italic">All dates are currently working days</p>
                </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {offDays.map(od => (
                  <div key={od.id} className="p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <div className="flex gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center border border-slate-100 dark:border-slate-700 shadow-inner">
                              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 leading-none">
                                {od.date.split('-')[2]}
                              </span>
                              <span className="text-[8px] font-black text-slate-400 uppercase leading-none mt-0.5">
                                {new Date(od.date).toLocaleString('default', { month: 'short' }).toUpperCase()}
                              </span>
                          </div>
                          <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800 dark:text-white text-sm">{od.description}</span>
                                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tighter ${getTypeStyle(od.type)}`}>
                                  {od.type}
                                </span>
                              </div>
                              <p className="text-[10px] font-mono text-slate-400 mt-0.5 font-bold">{od.date}</p>
                          </div>
                      </div>
                      <button onClick={() => handleRemove(od.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
