import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { StorageService } from '../../services/storageService';
import { DEFAULT_AVATARS } from '../../constants';
import { X, User as UserIcon, Camera, Check } from 'lucide-react';
import { User } from '../../types';

export const AvatarModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string>(user?.avatar || '');

  const handleSave = () => {
    if (!user) return;
    const users = StorageService.getUsers();
    const updatedUser = { ...user, avatar: selected };
    const updatedList = users.map((u: User) => u.id === user.id ? updatedUser : u);
    
    StorageService.saveUsers(updatedList);
    StorageService.setSession(updatedUser);
    
    window.location.reload();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelected(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] w-full max-w-md shadow-2xl p-10 relative animate-in fade-in zoom-in duration-300 border border-white dark:border-slate-700">
        <button onClick={onClose} className="absolute top-8 right-8 text-slate-300 hover:text-slate-500 transition-colors p-1">
          <X className="w-6 h-6" />
        </button>
        
        <div className="mb-10 text-center">
            <div className="relative inline-block mb-6">
                <div className="w-24 h-24 rounded-full border-4 border-indigo-50 dark:border-slate-700 overflow-hidden bg-slate-100 flex items-center justify-center shadow-inner">
                    {selected ? (
                        <img src={selected} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                        <UserIcon className="w-12 h-12 text-slate-300" />
                    )}
                </div>
                <label className="absolute bottom-0 right-0 p-2 bg-indigo-600 text-white rounded-full cursor-pointer shadow-lg hover:bg-indigo-700 transition-all border-2 border-white dark:border-slate-800">
                    <Camera className="w-4 h-4" />
                    <input type="file" className="hidden" accept="image/*" onChange={onFileChange} />
                </label>
            </div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white">Profile Identity</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Select or upload your avatar</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
            <button 
                onClick={() => setSelected(DEFAULT_AVATARS.MAN)}
                className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${selected === DEFAULT_AVATARS.MAN ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' : 'border-slate-50 dark:border-slate-700 hover:border-slate-200'}`}
            >
                <div className="w-16 h-16 rounded-full overflow-hidden shadow-sm">
                    <img src={DEFAULT_AVATARS.MAN} alt="Man" className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cartoon Man</span>
                {selected === DEFAULT_AVATARS.MAN && <Check className="w-4 h-4 text-indigo-500" />}
            </button>

            <button 
                onClick={() => setSelected(DEFAULT_AVATARS.WOMAN_HIJAB)}
                className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${selected === DEFAULT_AVATARS.WOMAN_HIJAB ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' : 'border-slate-50 dark:border-slate-700 hover:border-slate-200'}`}
            >
                <div className="w-16 h-16 rounded-full overflow-hidden shadow-sm">
                    <img src={DEFAULT_AVATARS.WOMAN_HIJAB} alt="Woman Hijab" className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Hijab Cartoon</span>
                {selected === DEFAULT_AVATARS.WOMAN_HIJAB && <Check className="w-4 h-4 text-indigo-500" />}
            </button>
        </div>

        <div className="space-y-3">
            <button 
                onClick={handleSave}
                className="w-full bg-slate-900 dark:bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:opacity-90 transition shadow-xl shadow-indigo-500/10"
            >
                Save Profile Changes
            </button>
            <button 
                onClick={onClose}
                className="w-full py-3 text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:text-slate-600 transition"
            >
                Cancel
            </button>
        </div>
      </div>
    </div>
  );
};