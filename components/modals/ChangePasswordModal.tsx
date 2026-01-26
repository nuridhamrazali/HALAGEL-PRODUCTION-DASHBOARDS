import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { StorageService } from '../../services/storageService';
import { X, Key, ShieldCheck, AlertCircle } from 'lucide-react';
import { User } from '../../types';

export const ChangePasswordModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const [currPass, setCurrPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [error, setError] = useState('');

  const labelClasses = "block text-[10px] font-extrabold uppercase text-slate-400 tracking-[0.15em] mb-2 ml-1";
  const inputClasses = "w-full p-4 border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-200 shadow-sm transition-all placeholder:text-slate-300";

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (!user) return;
      
      if(newPass !== confirmPass) {
          setError("New passwords do not match");
          return;
      }

      if(user.password !== currPass) {
          setError("Incorrect current password");
          return;
      }
      
      if(newPass.length < 6) {
          setError("Password must be at least 6 characters");
          return;
      }

      try {
          const users = StorageService.getUsers();
          const updatedUser = { ...user, password: newPass };
          const updated = users.map((u: User) => u.id === user.id ? updatedUser : u);
          
          StorageService.saveUsers(updated);
          StorageService.setSession(updatedUser);
          
          StorageService.addLog({
            userId: user.id,
            userName: user.name,
            action: 'CHANGE_PASSWORD',
            details: `User successfully updated their account password`
          });

          window.dispatchEvent(new CustomEvent('app-notification', { 
              detail: { message: 'PASSWORD UPDATED SUCCESSFULLY', type: 'success' } 
          }));
          
          onClose();
      } catch (err) {
          setError("Failed to update password. Please try again.");
      }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] w-full max-w-sm shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] p-10 relative animate-in fade-in zoom-in duration-300 border border-white dark:border-slate-700">
        <button 
          onClick={onClose} 
          className="absolute top-8 right-8 text-slate-300 hover:text-slate-500 transition-colors p-1"
        >
          <X className="w-6 h-6" />
        </button>
        
        <div className="mb-10 flex flex-col items-center">
            <div className="flex items-center justify-center gap-4 mb-4 w-full">
                <div className="p-3.5 bg-indigo-50 dark:bg-indigo-900/40 rounded-2xl">
                    <Key className="w-8 h-8 text-indigo-500 dark:text-indigo-400" strokeWidth={2.5}/>
                </div>
                <h3 className="text-[32px] font-black text-[#1e293b] dark:text-white leading-none">
                    Security
                </h3>
            </div>
            <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em] text-center w-full">Update Account Password</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
                <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-2xl flex items-center gap-3 animate-pulse">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{error}</p>
                </div>
            )}

            <div className="space-y-2">
                <label className={labelClasses}>Current Password</label>
                <input 
                  type="password" 
                  required 
                  value={currPass} 
                  onChange={e => setCurrPass(e.target.value)} 
                  className={inputClasses} 
                  placeholder="••••••••" 
                />
            </div>

            <div className="pt-4 space-y-2 border-t border-slate-50 dark:border-slate-700/50">
                <label className={labelClasses}>New Password</label>
                <input 
                  type="password" 
                  required 
                  value={newPass} 
                  onChange={e => setNewPass(e.target.value)} 
                  className={inputClasses} 
                  placeholder="••••••••" 
                />
            </div>

            <div className="space-y-2">
                <label className={labelClasses}>Confirm New Password</label>
                <input 
                  type="password" 
                  required 
                  value={confirmPass} 
                  onChange={e => setConfirmPass(e.target.value)} 
                  className={inputClasses} 
                  placeholder="••••••••" 
                />
            </div>

            <button 
              type="submit" 
              className="w-full bg-[#0f172a] text-white py-5 rounded-[1.25rem] font-black hover:bg-[#1e293b] shadow-2xl shadow-slate-900/20 uppercase tracking-[0.15em] text-[13px] mt-6 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
            >
                <ShieldCheck className="w-5 h-5" strokeWidth={2.5} />
                Update Credentials
            </button>
        </form>
      </div>
    </div>
  );
};