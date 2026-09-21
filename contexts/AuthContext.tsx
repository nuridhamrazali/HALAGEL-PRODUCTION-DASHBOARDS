import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { User, Role } from '../types';
import { StorageService } from '../services/storageService';

/**
 * Creates a SHA-256 hash of a string.
 * Used for storing/comparing passwords securely.
 * Includes a fallback for non-secure contexts (HTTP/IP-based access).
 */
export async function hashPassword(password: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn("Hashing failed, falling back to basic encoding", e);
    }
  }

  // Fallback for non-secure contexts (development/internal IPs)
  return "plain_" + btoa(password).substring(0, 59);
}

interface AuthContextType {
  user: User | null;
  login: (username: string, pass: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => void;
  hasPermission: (roles: Role[]) => boolean;
  loginAttempts: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MAX_ATTEMPTS = 5;
const COOLDOWN_TIME = 30000; // 30 seconds

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lastAttemptTime, setLastAttemptTime] = useState(0);
  // Fix: Replacing NodeJS.Timeout with number for browser compatibility as per frontend engineering standards
  const cooldownRef = useRef<number | null>(null);

  useEffect(() => {
    // 1. Initial session verification against local user directory
    const session = StorageService.getSession();
    const storedUsers = StorageService.getUsers();
    if (session) {
      const matched = storedUsers.find(u => u.username.toLowerCase() === session.username.toLowerCase());
      if (matched) {
        if (matched.role !== session.role || matched.name !== session.name) {
          StorageService.setSession(matched);
          setUser(matched);
        } else {
          setUser(session);
        }
      } else {
        // User was removed
        StorageService.setSession(null);
        setUser(null);
      }
    }

    // 2. Fetch fresh user directory from cloud in background
    StorageService.syncUsers().then((freshUsers) => {
      const currentSession = StorageService.getSession();
      if (currentSession) {
        const fresh = freshUsers.find(u => u.username.toLowerCase() === currentSession.username.toLowerCase());
        if (fresh) {
          if (fresh.role !== currentSession.role || fresh.name !== currentSession.name) {
            StorageService.setSession(fresh);
            setUser(fresh);
          }
        } else {
          StorageService.setSession(null);
          setUser(null);
        }
      }
    }).catch(() => {});

    // 3. Listen for session updates triggered by background sync
    const handleSessionUpdated = (e: any) => {
      if (e.detail?.user) {
        setUser(e.detail.user);
        window.dispatchEvent(new CustomEvent('app-notification', { 
          detail: { message: `Account permissions updated: Now ${e.detail.user.role.toUpperCase()}`, type: 'info' } 
        }));
      }
    };

    const handleSessionInvalidated = (e: any) => {
      setUser(null);
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: e.detail?.message || 'Session expired. Please log in again.', type: 'info' } 
      }));
    };

    window.addEventListener('user-session-updated', handleSessionUpdated);
    window.addEventListener('user-session-invalidated', handleSessionInvalidated);

    return () => {
      window.removeEventListener('user-session-updated', handleSessionUpdated);
      window.removeEventListener('user-session-invalidated', handleSessionInvalidated);
    };
  }, []);

  // Auto-logout after 60 minutes of complete inactivity
  useEffect(() => {
    if (!user) return;

    let timeoutId: number;
    const INACTIVITY_LIMIT_MS = 60 * 60 * 1000; // 60 minutes

    const resetTimer = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        logout();
        window.dispatchEvent(new CustomEvent('app-notification', { 
          detail: { message: 'Session expired due to inactivity. Please log in again.', type: 'info' } 
        }));
      }, INACTIVITY_LIMIT_MS);
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];
    events.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      events.forEach(evt => window.removeEventListener(evt, resetTimer));
    };
  }, [user]);

  const login = async (username: string, pass: string, rememberMe: boolean = false): Promise<boolean> => {
    const now = Date.now();
    
    // Brute Force Protection
    if (loginAttempts >= MAX_ATTEMPTS && (now - lastAttemptTime) < COOLDOWN_TIME) {
      window.dispatchEvent(new CustomEvent('app-notification', { 
          detail: { message: `Too many attempts. Wait ${Math.ceil((COOLDOWN_TIME - (now - lastAttemptTime))/1000)}s`, type: 'info' } 
      }));
      return false;
    }

    if ((now - lastAttemptTime) > COOLDOWN_TIME) {
        setLoginAttempts(0);
    }

    setLastAttemptTime(now);

    // Synchronize latest user credentials from cloud before evaluating login
    try {
      await Promise.race([
        StorageService.syncUsers(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
      ]);
    } catch {
      // Fallback seamlessly to local storage if offline or slow
    }

    const storedUsers = StorageService.getUsers();
    const cleanUsername = username.trim().toLowerCase();
    const targetUser = storedUsers.find(u => u.username.toLowerCase() === cleanUsername);
    
    if (targetUser) {
      const incomingHash = await hashPassword(pass);
      const isInitialUserPlaintext = !targetUser.password?.match(/^[a-f0-9]{64}$/);
      
      // Check either hash or plaintext (for legacy migration)
      if (targetUser.password === incomingHash || (isInitialUserPlaintext && targetUser.password === pass)) {
        // Upgrade legacy plaintext passwords to hash on login
        if (isInitialUserPlaintext) {
            targetUser.password = incomingHash;
            await StorageService.saveUsers(storedUsers);
        }
        
        setUser(targetUser);
        StorageService.setSession(targetUser, rememberMe);
        setLoginAttempts(0);
        return true;
      }
    }
    
    setLoginAttempts(prev => prev + 1);
    return false;
  };

  const logout = () => {
    setUser(null);
    StorageService.setSession(null);
  };

  const hasPermission = (allowedRoles: Role[]) => {
    if (!user) return false;
    return allowedRoles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, hasPermission, loginAttempts }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
