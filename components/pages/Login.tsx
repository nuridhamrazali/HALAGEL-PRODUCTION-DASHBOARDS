
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Factory, Lock, User as UserIcon } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = login(username, password);
    if (!success) {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-slate-900 p-8 text-center">
            <div className="inline-flex p-3 rounded-full bg-slate-800 mb-4">
                <Factory className="w-8 h-8 text-brand-500" />
            </div>
            <h1 className="text-2xl font-bold text-white">NexusMfg</h1>
            <p className="text-slate-400 text-sm mt-1">Production Control System</p>
        </div>
        
        <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center">
                        <span className="block">{error}</span>
                    </div>
                )}
                
                <div className="relative">
                    <UserIcon className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Username"
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        required
                    />
                </div>
                
                <div className="relative">
                    <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                    <input 
                        type="password" 
                        placeholder="Password"
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                    />
                </div>

                <button 
                    type="submit"
                    className="w-full bg-brand-600 text-white font-bold py-2.5 rounded-lg hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/30"
                >
                    Sign In
                </button>
            </form>
        </div>
      </div>
    </div>
  );
};
