import React, { useState } from 'react';
import { StorageService } from '../../services/storageService';
import { GoogleSheetsService } from '../../services/googleSheetsService';
import { useAuth } from '../../contexts/AuthContext';
import { User, Role } from '../../types';
import { Trash2, Plus, Database, ShieldCheck, X, Check, AlertCircle } from 'lucide-react';

export const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>(StorageService.getUsers());
  const [isAdding, setIsAdding] = useState(false);
  
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
    // Reload to apply changes
    window.location.reload();
  };

  const [newUser, setNewUser] = useState<Omit<User, 'id'>>({
      name: '',
      username: '',
      role: 'operator',
      password: ''
  });

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (users.some(u => u.username.toLowerCase() === newUser.username.toLowerCase())) {
        alert("Username already exists!");
        return;
    }
    const u: User = { ...newUser, id: Date.now().toString() };
    const updated = [...users, u];
    StorageService.saveUsers(updated);
    StorageService.addLog({
      userId: currentUser!.id,
      userName: currentUser!.name,
      action: 'ADD_USER',
      details: `Created new user account: ${u.name} (${u.role})`
    });
    setUsers(updated);
    window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: `NEW USER CREATED: ${u.name.toUpperCase()}`, type: 'success' } 
    }));
    setIsAdding(false);
    setNewUser({ name: '', username: '', role: 'operator', password: '' });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this user?')) {
        const target = users.find(u => u.id === id);
        const updated = users.filter(u => u.id !== id);
        StorageService.saveUsers(updated);
        StorageService.addLog({
          userId: currentUser!.id,
          userName: currentUser!.name,
          action: 'DELETE_USER',
          details: `Removed user account: ${target?.name} (@${target?.username})`
        });
        setUsers(updated);
        window.dispatchEvent(new CustomEvent('app-notification', { 
            detail: { message: `USER REMOVED: ${target?.name.toUpperCase()}`, type: 'info' } 
        }));
    }
  };

  return (
    <div className="space-y-8">
        {/* DB CONFIG FOR ADMINS */}
        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-indigo-100 dark:border-indigo-900/30 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Database className={`w-6 h-6 ${isPlaceholder ? 'text-rose-500' : 'text-indigo-500'}`} />
                    <div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-white leading-none">Database Connection</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                          Status: {isPlaceholder ? 'Action Required' : (localStorage.getItem('halagel_sheets_api_url') ? 'Browser Override' : 'System Default')}
                        </p>
                    </div>
                </div>
                {!isPlaceholder && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-full">
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Live Sync Ready</span>
                  </div>
                )}
            </div>
            
            {isPlaceholder ? (
              <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-2xl border border-rose-100 dark:border-rose-800 mb-6 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                      <p className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-tight">Configuration Required</p>
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                          The current URL is a <strong>placeholder</strong>. You must replace it with your actual Google Apps Script Web App URL to enable cloud features.
                      </p>
                  </div>
              </div>
            ) : (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800 mb-6 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                      <p className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-tight">Deployment Tip</p>
                      <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
                          Saving here only applies to <strong>this browser</strong>. To make this database global for all staff, update the <code>HARDCODED_URL</code> in <code>services/googleSheetsService.ts</code>.
                      </p>
                  </div>
              </div>
