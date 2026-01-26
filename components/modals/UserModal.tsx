import React, { useState } from 'react';
import { StorageService } from '../../services/storageService';
import { User, Role } from '../../types';
import { X, Trash2, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const UserModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>(StorageService.getUsers());
  const [newUser, setNewUser] = useState({ name: '', username: '', password: '', role: 'operator' as Role });

  const inputClasses = "p-2 rounded text-sm border border-slate-200 bg-white text-slate-900 font-bold outline-none focus:ring-2 focus:ring-purple-500/20";

  const handleAdd = (e: React.FormEvent) => {
      e.preventDefault();
      // Basic check for duplicate username
      if (users.some(u => u.username.toLowerCase() === newUser.username.toLowerCase())) {
          alert("Username already exists!");
          return;
      }
      const u: User = { 
          id: Date.now().toString(), 
          name: newUser.name, 
          username: newUser.username,
          password: newUser.password, 
          role: newUser.role 
      };
      const updated = [...users, u];
      StorageService.saveUsers(updated);
      setUsers(updated);
      setNewUser({ name: '', username: '', password: '', role: 'operator' });
      
      window.dispatchEvent(new CustomEvent('app-notification', { 
          detail: { message: 'New user account created successfully!', type: 'success' } 
      }));
  };

  const handleDelete = (id: string) => {
      if(!window.confirm("Delete user?")) return;
      const updated = users.filter(u => u.id !== id);
      StorageService.saveUsers(updated);
      setUsers(updated);
      window.dispatchEvent(new CustomEvent('app-notification', { 
          detail: { message: 'User account removed', type: 'info' } 
      }));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
            <h3 className="font-bold text-lg text-purple-600 dark:text-purple-400">User Management</h3>
            <button onClick={onClose}><X className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="p-4 bg-purple-50 dark:bg-purple-900/10">
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input type="text" placeholder="Full Name" required value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className={inputClasses} />
                <input type="text" placeholder="Username" required value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} className={inputClasses} />
                <input type="text" placeholder="Password" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className={inputClasses} />
                <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as Role})} className={inputClasses}>
                    <option value="operator">Operator</option>
                    <option value="planner">Planner</option>
                    <option value="manager">Manager/HOD</option>
                    <option value="admin">Admin</option>
                </select>
                <button type="submit" className="md:col-span-2 bg-purple-600 text-white py-2.5 rounded-lg font-bold hover:bg-purple-700 text-sm shadow-md transition">Add New User</button>
            </form>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 dark:bg-slate-700 font-bold text-gray-500">
                    <tr><th className="p-3">User Details</th><th className="p-3 text-center">Role</th><th className="p-3 text-right">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {users.map(u => (
                        <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                            <td className="p-3">
                                <div className="font-bold text-slate-700 dark:text-slate-200">{u.name}</div>
                                <div className="text-[10px] flex items-center gap-2 mt-1">
                                    <span className="bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded font-mono">@{u.username}</span>
                                </div>
                            </td>
                            <td className="p-3 text-center">
                                <span className="bg-gray-100 dark:bg-slate-700 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-400">
                                    {u.role === 'manager' ? 'manager/hod' : u.role}
                                </span>
                            </td>
                            <td className="p-3 text-right">
                                {currentUser?.id !== u.id && (
                                    <button onClick={() => handleDelete(u.id)} className="text-red-400 hover:text-red-600 transition p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};