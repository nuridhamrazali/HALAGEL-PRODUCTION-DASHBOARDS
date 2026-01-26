
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { X, Lock, User as UserIcon } from 'lucide-react';

export const LoginModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(username, password)) {
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: `Login successful! Welcome ${username}.`, type: 'success' } 
      }));
      onClose();
    } else {
      setError('Invalid username or password');
    }
  };

  const inputClasses = "w-full pl-10 pr-4 py-3 rounded-xl bg-white text-slate-900 font-bold border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition shadow-sm";

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 w-full max-w-sm shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
        
        <div className="mb-8 flex flex-col items-center text-center">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl mb-4">
                <Lock className="w-7 h-7 text-indigo-600" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                Welcome Back
            </h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">HALAGEL Production System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg text-center font-bold border border-red-100">{error}</div>}
          
          <div className="relative">
            <UserIcon className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
            <input 
                type="text" placeholder="Username" required
                className={inputClasses}
                value={username} onChange={e => setUsername(e.target.value)}
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
            <input 
                type="password" placeholder="Password" required
                className={inputClasses}
                value={password} onChange={e => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="w-full bg-slate-900 dark:bg-indigo-600 text-white py-3.5 rounded-xl font-black hover:opacity-90 transition shadow-xl shadow-indigo-500/10 uppercase tracking-widest text-xs">
            Log In to Dashboard
          </button>
        </form>
      </div>
    </div>
  );
};
