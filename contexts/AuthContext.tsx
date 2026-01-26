
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Role } from '../types';
import { StorageService } from '../services/storageService';
import { INITIAL_USERS } from '../constants';

interface AuthContextType {
  user: User | null;
  login: (username: string, pass: string) => boolean;
  logout: () => void;
  hasPermission: (roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const session = StorageService.getSession();
    if (session) {
      setUser(session);
    }
  }, []);

  const login = (username: string, pass: string) => {
    const storedUsers = StorageService.getUsers();
    // Combine initial and stored users, prioritizing stored ones if there's conflict
    const userMap = new Map<string, User>();
    [...INITIAL_USERS, ...storedUsers].forEach(u => userMap.set(u.username.toLowerCase(), u));
    
    const targetUser = userMap.get(username.toLowerCase());
    
    if (targetUser && targetUser.password === pass) {
      setUser(targetUser);
      StorageService.setSession(targetUser);
      return true;
    }
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
    <AuthContext.Provider value={{ user, login, logout, hasPermission }}>
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
