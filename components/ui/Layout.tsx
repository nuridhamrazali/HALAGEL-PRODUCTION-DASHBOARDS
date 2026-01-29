
import React, { ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { Category, ProductionEntry } from '../../types';
import { CATEGORIES } from '../../constants';
import { LoginModal } from '../modals/LoginModal';
import { InputModal } from '../modals/InputModal';
import { OffDayModal } from '../modals/OffDayModal';
import { ChangePasswordModal } from '../modals/ChangePasswordModal';
import { GoogleSheetsService } from '../../services/googleSheetsService';
import { StorageService } from '../../services/storageService';
import { Link, useLocation } from 'react-router-dom';
import { 
  Menu, X, Moon, Sun, Plus, LogOut, Database,
  CalendarX, LayoutDashboard, RefreshCw, LogIn, CheckCircle, Info,
  ClipboardList, Users, History, Key, BarChart3, Calendar
} from 'lucide-react';

/**
 * LOGO CONFIGURATION
 * 
 * To add your own logo:
 * 1. Convert your image to a Base64 string.
 * 2. Paste the entire string (starting with data:image/...) between the backticks below.
 */
const LOGO_BASE64 = `data:image/png;base64,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`;

export const Layout: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, logout, hasPermission } = useAuth();
  const { category, setCategory, isDarkMode, toggleDarkMode, refreshKey, triggerRefresh } = useDashboard();
  const location = useLocation();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [showOffDays, setShowOffDays] = useState(false);
  const [showChangePass, setShowChangePass] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<ProductionEntry | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const timeoutRef = useRef<number | null>(null);

  const handleNotify = useCallback((e: any) => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    setNotification({ message: e.detail.message, type: e.detail.type || 'success' });
    timeoutRef.current = window.setTimeout(() => {
      setNotification(null);
      timeoutRef.current = null;
    }, 3000);
  }, []);

  const handleEditEntry = useCallback((e: any) => {
    setEntryToEdit(e.detail);
    setShowInput(true);
  }, []);

  const handleLogout = () => {
    const userName = user?.name || 'User';
    logout();
    window.dispatchEvent(new CustomEvent('app-notification', { 
      detail: { message: `Logout successful. Goodbye ${userName}!`, type: 'success' } 
    }));
    setIsMobileMenuOpen(false);
  };

  const handleSync = async (silent = false) => {
    if (!GoogleSheetsService.isEnabled()) {
      if (!silent) {
        window.dispatchEvent(new CustomEvent('app-notification', { 
          detail: { message: 'Cloud sync not configured.', type: 'info' } 
        }));
      }
      return;
    }
    
    if (!silent) setIsSyncing(true);
    try {
      await StorageService.syncWithSheets();
      triggerRefresh();
      if (!silent) {
        window.dispatchEvent(new CustomEvent('app-notification', { 
          detail: { message: 'Cloud data synchronized!', type: 'success' } 
        }));
      }
    } catch (e) {
      if (!silent) {
        window.dispatchEvent(new CustomEvent('app-notification', { 
          detail: { message: 'Sync failed. Check connection.', type: 'info' } 
        }));
      }
    } finally {
      if (!silent) setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (GoogleSheetsService.isEnabled()) {
      handleSync(true); 
    }
  }, []);

  useEffect(() => {
    window.addEventListener('app-notification', handleNotify);
    window.addEventListener('edit-production-entry', handleEditEntry);
    return () => {
      window.removeEventListener('app-notification', handleNotify);
      window.removeEventListener('edit-production-entry', handleEditEntry);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [handleNotify, handleEditEntry]);

  const navItemClass = (path: string) => `
    w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all
    ${location.pathname === path 
      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800' 
      : 'text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800'}
  `;

  return (
    <div className={`min-h-screen flex ${isDarkMode ? 'dark' : ''} bg-slate-50 dark:bg-slate-900 transition-colors duration-300 font-sans`}>
      {notification && (
        <div className="fixed top-20 right-8 z-[10000] pointer-events-none w-full max-w-sm px-4">
          <div className="notification-animate pointer-events-auto">
            <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl shadow-xl border-2 bg-white dark:bg-slate-800 ${
              notification.type === 'success' ? 'border-emerald-500/30' : 'border-indigo-500/30'
            }`}>
              <div className={`p-2 rounded-xl ${notification.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-slate-800 dark:text-white leading-tight uppercase tracking-tight">{notification.message}</p>
              </div>
              <button onClick={() => setNotification(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 w-72 bg-white dark:bg-slate-850 border-r border-gray-200 dark:border-slate-700 z-50 transform transition-transform duration-300 md:translate-x-0 md:static md:block flex flex-col h-full ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Sidebar Header */}
        <div className="p-6 flex flex-col items-center justify-center border-b border-gray-100 dark:border-slate-800 shrink-0">
           <div className="w-48 text-center">
             <div className="flex justify-center mb-3">
               {LOGO_BASE64 ? (
                 <img src={LOGO_BASE64} alt="Halagel Logo" className="h-16 object-contain" />
               ) : (
                 <Database className="w-12 h-12 text-indigo-600" />
               )}
             </div>
             <div className="text-xl font-black tracking-tight text-slate-800 dark:text-white uppercase">
                HALA<span className="text-emerald-500">GEL</span>
             </div>
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Manufacturing System</p>
           </div>
        </div>

        {/* Sidebar Body - Scrollable Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto custom-scrollbar">
          <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className={navItemClass('/')}>
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </Link>
          <Link to="/calendar" onClick={() => setIsMobileMenuOpen(false)} className={navItemClass('/calendar')}>
            <Calendar className="w-4 h-4" /> Production Calendar
          </Link>
          <Link to="/reports" onClick={() => setIsMobileMenuOpen(false)} className={navItemClass('/reports')}>
            <ClipboardList className="w-4 h-4" /> Production Reports
          </Link>
          <Link to="/process-analytics" onClick={() => setIsMobileMenuOpen(false)} className={navItemClass('/process-analytics')}>
            <BarChart3 className="w-4 h-4" /> Process Analytics
          </Link>

          <div className="pt-4 px-3 py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">Departments</div>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => { setCategory(cat as Category); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                category === cat ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}>
              {cat}
            </button>
          ))}

          {user && (
            <>
              <div className="pt-4 px-3 py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">Operations</div>
              <button onClick={() => { setShowInput(true); setIsMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition">
                <Plus className="w-4 h-4 text-emerald-500" /> New Entry
              </button>
              
              {hasPermission(['admin', 'manager']) && (
                <button onClick={() => { setShowOffDays(true); setIsMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition">
                  <CalendarX className="w-4 h-4 text-rose-500" /> Holidays
                </button>
              )}

              {hasPermission(['admin']) && (
                <Link to="/users" onClick={() => setIsMobileMenuOpen(false)} className={navItemClass('/users')}>
                  <Users className="w-4 h-4" /> Users
                </Link>
              )}

              <Link to="/logs" onClick={() => setIsMobileMenuOpen(false)} className={navItemClass('/logs')}>
                <History className="w-4 h-4" /> Logs
              </Link>
            </>
          )}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 bg-white dark:bg-slate-850 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between px-6 shrink-0 z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
              <Menu className="w-6 h-6 text-slate-600 dark:text-slate-300" />
            </button>
            <div className="flex items-center gap-3">
              <h2 className="font-black text-lg hidden md:block text-slate-700 dark:text-white capitalize">
                {location.pathname === '/' ? 'Manufacturing Overview' : location.pathname.substring(1).replace('-', ' ')}
              </h2>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                GoogleSheetsService.isEnabled() ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'
              }`}>
                <Database className="w-3 h-3" />
                {GoogleSheetsService.isEnabled() ? 'Cloud DB Active' : 'Local Storage Only'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={() => handleSync()} disabled={isSyncing} title="Sync with Cloud" className={`p-2.5 text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition ${isSyncing ? 'animate-spin text-indigo-500' : ''}`}>
              <RefreshCw className="w-5 h-5" />
            </button>
            <button onClick={toggleDarkMode} title="Toggle Dark Mode" className="p-2.5 text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition">
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            {user ? (
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                 <div className="flex items-center gap-3 px-3 py-1">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center text-white overflow-hidden shadow-inner shrink-0">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-black uppercase">{user.name.charAt(0)}</span>
                        )}
                    </div>
                    <div className="hidden sm:block text-left min-w-[80px]">
                        <p className="text-[9px] font-black uppercase text-indigo-500 leading-none">{user.role}</p>
                        <p className="text-xs font-black text-slate-700 dark:text-white truncate">{user.name}</p>
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-1 pr-1 border-l border-slate-200 dark:border-slate-700 ml-1 pl-1">
                    <button 
                      onClick={() => setShowChangePass(true)} 
                      title="Change Password"
                      className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={handleLogout} 
                      title="Log Out"
                      className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                 </div>
              </div>
            ) : (
              <button onClick={() => setShowLogin(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white text-xs font-black rounded-xl hover:bg-slate-800 transition uppercase tracking-widest">
                <LogIn className="w-4 h-4" /> Login
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          {children}
        </div>
      </main>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {showInput && <InputModal onClose={() => { setShowInput(false); setEntryToEdit(null); }} editEntry={entryToEdit} />}
      {showOffDays && <OffDayModal onClose={() => setShowOffDays(false)} />}
      {showChangePass && <ChangePasswordModal onClose={() => setShowChangePass(false)} />}
    </div>
  );
};
