
import React, { useState } from 'react';
import { StorageService } from '../../services/storageService';
import { useAuth } from '../../contexts/AuthContext';
import { OffDay } from '../../types';
import { Trash2, Plus } from 'lucide-react';
import { formatDateToDMY } from '../../utils/dateUtils';

export const OffDays: React.FC = () => {
  const { user } = useAuth();
  const [offDays, setOffDays] = useState<OffDay[]>(StorageService.getOffDays());
  const [newDate, setNewDate] = useState('');
  const [description, setDescription] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) return;
    
    if (offDays.some(d => d.date === newDate)) {
        alert('Date already marked as off day');
        return;
    }

    const newOffDay: OffDay = {
        id: Date.now().toString(),
        date: newDate,
        description: description || 'Scheduled Off',
        type: 'Off Day',
        createdBy: user!.id
    };
    
    const updated = [...offDays, newOffDay].sort((a,b) => a.date.localeCompare(b.date));
    StorageService.saveOffDays(updated);
    setOffDays(updated);
    setNewDate('');
    setDescription('');
  };

  const handleRemove = (id: string) => {
    const updated = offDays.filter(d => d.id !== id);
    StorageService.saveOffDays(updated);
    setOffDays(updated);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Add Off Day</h3>
            <form onSubmit={handleAdd} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input 
                        type="date" 
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        value={newDate}
                        onChange={e => setNewDate(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input 
                        type="text" 
                        placeholder="e.g. National Holiday"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                    />
                </div>
                <button 
                    type="submit"
                    className="w-full bg-slate-800 text-white py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-700"
                >
                    <Plus className="w-4 h-4" /> Add Date
                </button>
            </form>
        </div>

        <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-800">Scheduled Off Days</h3>
            </div>
            <ul className="divide-y divide-gray-100">
                {offDays.length === 0 ? (
                    <li className="p-6 text-gray-400 text-center">No off days scheduled.</li>
                ) : offDays.map(day => (
                    <li key={day.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex items-center space-x-4">
                            <div className="bg-red-50 text-red-600 px-3 py-1 rounded-md font-mono text-sm font-bold">
                                {formatDateToDMY(day.date)}
                            </div>
                            <span className="text-gray-700 font-medium">{day.description}</span>
                        </div>
                        <button 
                            onClick={() => handleRemove(day.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    </div>
  );
};
