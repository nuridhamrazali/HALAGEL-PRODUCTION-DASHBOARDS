import React, { useState } from 'react';
import { StorageService } from '../../services/storageService';
import { GoogleSheetsService } from '../../services/googleSheetsService';
import { useAuth, hashPassword, sanitizeInput } from '../../contexts/AuthContext';
import { User, Role } from '../../types';
import { Trash2, Plus, Database, ShieldCheck, X, Check, AlertCircle, Loader2, Pencil, RefreshCw } from 'lucide-react';
import { getDbTimestamp } from '../../utils/dateUtils';

export const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>(StorageService.getUsers());
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Edit user state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<Role>('operator');
  const [editPassword, setEditPassword] = useState('');
  
  const [sheetUrl, setSheetUrl] = useState<string>(
    localStorage.getItem('halagel_sheets_api_url') || 
    GoogleSheetsService.getActiveUrl() || 
    ''
  );
  
  const isPlaceholder = sheetUrl.includes('EXAMPLE_URL');

  const handleSaveSheetUrl = () => {
    if (!sheetUrl.startsWith('https://script.google.com')) {
      alert("Please provide a valid Google Apps Script URL.");
      return;
    }
    localStorage.setItem('halagel_sheets_api_url', sheetUrl || '');
    window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'DATABASE CONFIGURATION UPDATED', type: 'success' } 
    }));
    window.location.reload();
  };

  const handleSyncFromCloud = async () => {
    setIsRefreshing(true);
    try {
      const freshUsers = await StorageService.syncUsers();
      setUsers(freshUsers);
      window.dispatchEvent(new CustomEvent('app-notification', { 
          detail: { message: `PERSONNEL DIRECTORY SYNCHRONIZED (${freshUsers.length} USERS)`, type: 'success' } 
      }));
    } catch {
      window.dispatchEvent(new CustomEvent('app-notification', { 
          detail: { message: 'Sync failed. Check cloud connection.', type: 'info' } 
      }));
    } finally {
      setIsRefreshing(false);
    }
  };

  const [newUser, setNewUser] = useState<Omit<User, 'id'>>({
      name: '',
      username: '',
      role: 'operator',
      password: ''
  });

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = sanitizeInput(newUser.username).toLowerCase().trim();
    if (users.some(u => u.username.toLowerCase() === cleanUsername)) {
        alert(`Username '@${cleanUsername}' already exists! To change their role, click the Edit button on their card.`);
        return;
    }
    
    setIsSubmitting(true);
    try {
        const hashedPassword = await hashPassword(newUser.password || 'password123');
        const u: User = { 
            ...newUser, 
            id: Date.now().toString(),
            name: sanitizeInput(newUser.name),
            username: cleanUsername,
            password: hashedPassword,
            updatedAt: getDbTimestamp()
        };
        const updated = [...users, u];
        await StorageService.saveUsers(updated);
        await StorageService.addLog({
          userId: currentUser!.id,
          userName: currentUser!.name,
          action: 'ADD_USER',
          details: `Created secure user account: ${u.name} (@${u.username}, Role: ${u.role})`
        });
        setUsers(updated);
        window.dispatchEvent(new CustomEvent('app-notification', { 
            detail: { message: `NEW USER CREATED AND SYNCED TO CLOUD`, type: 'success' } 
        }));
        setIsAdding(false);
        setNewUser({ name: '', username: '', role: 'operator', password: '' });
    } catch (err) {
        window.dispatchEvent(new CustomEvent('app-notification', { 
            detail: { message: `Failed to create user: ${String(err)}`, type: 'info' } 
        }));
    } finally {
        setIsSubmitting(false);
    }
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditRole(u.role);
    setEditPassword('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    setIsSubmitting(true);
    try {
      let finalPassword = editingUser.password;
      if (editPassword.trim()) {
        finalPassword = await hashPassword(editPassword.trim());
      }

      const updatedUser: User = {
        ...editingUser,
        name: sanitizeInput(editName),
        role: editRole,
        password: finalPassword,
        updatedAt: getDbTimestamp()
      };

      const updated = users.map(u => u.id === editingUser.id ? updatedUser : u);
      await StorageService.saveUsers(updated);
      await StorageService.addLog({
        userId: currentUser!.id,
        userName: currentUser!.name,
        action: 'EDIT_USER',
        details: `Updated personnel profile: ${updatedUser.name} (@${updatedUser.username}) -> Role: ${updatedUser.role.toUpperCase()}`
      });
      setUsers(updated);
      window.dispatchEvent(new CustomEvent('app-notification', { 
          detail: { message: `USER UPDATED: ${updatedUser.name.toUpperCase()} IS NOW ${updatedUser.role.toUpperCase()}`, type: 'success' } 
      }));
      setEditingUser(null);
      setEditPassword('');
    } catch (err) {
      window.dispatchEvent(new CustomEvent('app-notification', { 
          detail: { message: `Failed to update user: ${String(err)}`, type: 'info' } 
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const target = users.find(u => u.id === id);
    if (!target) return;
    if (window.confirm(`Delete user account "${target.name}" (@${target.username})? This change will propagate to all devices.`)) {
        setDeletingId(id);
        setIsSubmitting(true);
        try {
          const updated = users.filter(u => u.id !== id);
          await StorageService.saveUsers(updated);
          await StorageService.addLog({
            userId: currentUser!.id,
            userName: currentUser!.name,
            action: 'DELETE_USER',
            details: `Removed user account: ${target.name} (@${target.username})`
          });
          setUsers(updated);
          window.dispatchEvent(new CustomEvent('app-notification', { 
              detail: { message: `USER DELETED AND PURGED FROM CLOUD`, type: 'info' } 
          }));
        } catch (err) {
          window.dispatchEvent(new CustomEvent('app-notification', { 
              detail: { message: `Failed to remove user: ${String(err)}`, type: 'info' } 
          }));
        } finally {
          setIsSubmitting(false);
          setDeletingId(null);
        }
    }
  };

  return (
    <div className="space-y-8">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-indigo-100 dark:border-indigo-900/30 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Database className={`w-6 h-6 ${isPlaceholder ? 'text-rose-500' : 'text-indigo-500'}`} />
                    <div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-white leading-none">Security Configuration</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Database Endpoints</p>
                    </div>
                </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
                <input 
                    type="password"
                    value={sheetUrl} 
                    onChange={e => setSheetUrl(e.target.value)}
                    placeholder="Enter Apps Script URL..."
                    className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-xs dark:text-slate-300 outline-none"
                />
                <button onClick={handleSaveSheetUrl} className="px-6 py-3 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/20">
                    Apply Global Lock
                </button>
            </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
            <div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white">Active Personnel</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Authorized system access list ({users.length} accounts)</p>
            </div>
            <div className="flex items-center gap-3">
                <button 
                  onClick={handleSyncFromCloud} 
                  disabled={isRefreshing}
                  title="Synchronize user directory with cloud"
                  className="flex items-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-600 transition shadow-sm"
                >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
                    <span className="hidden sm:inline">Sync Cloud</span>
                </button>
                <button 
                  onClick={() => setIsAdding(true)} 
                  className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:opacity-90 shadow-xl transition active:scale-95"
                >
                    <Plus className="w-4 h-4" /> Add User
                </button>
            </div>
        </div>

        {/* ADD USER MODAL */}
        {isAdding && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl relative animate-in zoom-in duration-200 border border-indigo-50 dark:border-slate-700">
                    {isSubmitting && (
                        <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm z-50 rounded-[2.5rem] flex flex-col items-center justify-center">
                            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-3" />
                            <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">Syncing Personnel to Cloud...</p>
                        </div>
                    )}
                    <button onClick={() => setIsAdding(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-500"><X /></button>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Create Secure Identity</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-8">Role-based credential generation</p>
                    <form onSubmit={handleAddUser} className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Full Name</label>
                                <input type="text" required value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 text-sm font-bold" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Username</label>
                                <input type="text" required value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 text-sm font-bold" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Account Role</label>
                                <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as Role})} className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 text-sm font-bold">
                                    <option value="operator">Operator</option>
                                    <option value="planner">Planner</option>
                                    <option value="manager">Manager/HOD</option>
                                    <option value="admin">Administrator</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Password</label>
                                <input type="password" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 text-sm font-bold" />
                            </div>
                        </div>
                        <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-indigo-500/20 mt-4">
                            Provision Secure Account
                        </button>
                    </form>
                </div>
            </div>
        )}

        {/* EDIT USER MODAL */}
        {editingUser && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl relative animate-in zoom-in duration-200 border border-indigo-50 dark:border-slate-700">
                    {isSubmitting && (
                        <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm z-50 rounded-[2.5rem] flex flex-col items-center justify-center">
                            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-3" />
                            <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">Updating Cloud Permissions...</p>
                        </div>
                    )}
                    <button onClick={() => setEditingUser(null)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-500"><X /></button>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Edit Personnel Profile</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-8">Update role or password for @{editingUser.username}</p>
                    <form onSubmit={handleSaveEdit} className="space-y-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Full Name</label>
                            <input 
                              type="text" 
                              required 
                              value={editName} 
                              onChange={e => setEditName(e.target.value)} 
                              className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 text-sm font-bold" 
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Account Role</label>
                                <select 
                                  value={editRole} 
                                  onChange={e => setEditRole(e.target.value as Role)} 
                                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 text-sm font-bold"
                                >
                                    <option value="operator">Operator</option>
                                    <option value="planner">Planner</option>
                                    <option value="manager">Manager/HOD</option>
                                    <option value="admin">Administrator</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">New Password (Optional)</label>
                                <input 
                                  type="password" 
                                  placeholder="Leave blank to keep" 
                                  value={editPassword} 
                                  onChange={e => setEditPassword(e.target.value)} 
                                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 text-sm font-bold" 
                                />
                            </div>
                        </div>
                        <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-indigo-500/20 mt-4">
                            Save Changes & Propagate to Cloud
                        </button>
                    </form>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map(u => (
                <div key={u.id} className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all group">
                    <div className="flex justify-between items-start mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center border border-indigo-100 dark:border-indigo-800">
                           <ShieldCheck className="w-7 h-7 text-indigo-500" />
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => openEditModal(u)} 
                            title="Edit User Role & Details" 
                            className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all"
                          >
                              <Pencil className="w-4 h-4" />
                          </button>
                          {currentUser?.id !== u.id && (
                            <button 
                              onClick={() => handleDelete(u.id)} 
                              disabled={deletingId === u.id}
                              title="Delete User Account" 
                              className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                            >
                                {deletingId === u.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                            </button>
                          )}
                        </div>
                    </div>
                    <h4 className="font-black text-lg text-slate-800 dark:text-white uppercase tracking-tight leading-none mb-1">{u.name}</h4>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">@{u.username}</p>
                    
                    <div className="mt-6 pt-6 border-t border-slate-50 dark:border-slate-700 flex justify-between items-center">
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                          u.role === 'admin' 
                            ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800'
                            : u.role === 'manager'
                            ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-800'
                            : u.role === 'planner'
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-500 border-slate-100 dark:border-slate-800'
                        }`}>
                          {u.role === 'manager' ? 'Manager/HOD' : u.role}
                        </span>
                        {u.password?.match(/^[a-f0-9]{64}$/) ? (
                          <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-500 uppercase">
                            <Check className="w-3 h-3" /> Encrypted
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[9px] font-black text-amber-500 uppercase animate-pulse">
                            <AlertCircle className="w-3 h-3" /> Plaintext
                          </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};
