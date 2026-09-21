
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { X, Lock, User as UserIcon, Loader2, ShieldAlert } from 'lucide-react';

export const LoginModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { login, loginAttempts } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError('');
    
    try {
        const success = await login(username, password, rememberMe);
        if (success) {
            window.dispatchEvent(new CustomEvent('app-notification', { 
                detail: { message: `IDENTITY VERIFIED: WELCOME ${username.toUpperCase()}`, type: 'success' } 
            }));
            onClose();
        } else {
            setError('ACCESS DENIED: INVALID CREDENTIALS');
        }
    } finally {
        setIsLoggingIn(false);
    }
  };

  const inputClasses = "w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition shadow-sm";

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl relative animate-in fade-in zoom-in duration-200 border border-indigo-50 dark:border-slate-700">
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
        
        <div className="mb-8 flex flex-col items-center text-center">
            <div className={`p-4 rounded-2xl mb-4 transition-colors ${loginAttempts >= 3 ? 'bg-rose-50 dark:bg-rose-900/40 text-rose-500' : 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600'}`}>
                {loginAttempts >= 3 ? <ShieldAlert className="w-8 h-8" /> : <Lock className="w-8 h-8" />}
            </div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
                Personnel Login
            </h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Identity verification required</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-4 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[10px] rounded-xl text-center font-black uppercase tracking-widest border border-rose-100 dark:border-rose-800">{error}</div>}
          
          <div className="relative">
            <UserIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
            <input 
                type="text" placeholder="Username" required
                className={inputClasses}
                value={username} onChange={e => setUsername(e.target.value)}
                disabled={isLoggingIn}
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
            <input 
                type="password" placeholder="Password" required
                className={inputClasses}
                value={password} onChange={e => setPassword(e.target.value)}
                disabled={isLoggingIn}
            />
          </div>

          <div className="flex flex-col gap-1 py-1 px-1">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={rememberMe} 
                onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 dark:bg-slate-900 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Remember login on this device
              </span>
            </label>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 pl-6 leading-tight">
              Auto-logout on browser/PWA close is active by default.
            </span>
          </div>

          <button 
            type="submit" 
            disabled={isLoggingIn}
            className="w-full bg-slate-900 dark:bg-indigo-600 text-white py-4 rounded-2xl font-black hover:opacity-90 transition shadow-xl shadow-indigo-500/10 uppercase tracking-widest text-[11px] flex items-center justify-center gap-2"
          >
            {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Authorize Access'}
          </button>
          
          {loginAttempts > 0 && loginAttempts < 5 && (
            <p className="text-[9px] text-center font-black text-rose-500 uppercase tracking-tighter mt-2">
                Warning: {5 - loginAttempts} Attempts Remaining
            </p>
          )}
        </form>
      </div>
    </div>
  );
};
