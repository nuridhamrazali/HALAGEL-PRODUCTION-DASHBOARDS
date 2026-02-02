import { User, ProductionEntry, OffDay, OffDayType } from './types';
import { getTodayISO, getDbTimestamp } from './utils/dateUtils';

export const CATEGORIES = ['Healthcare', 'Toothpaste', 'Rocksalt', 'Cosmetic'] as const;
export const PROCESSES = ['Mixing', 'Encapsulation', 'Filling', 'Sorting', 'Packing', 'Blister', 'Capsules'] as const;
export const UNITS = ['KG', 'PCS', 'CARTON', 'BTL', 'BOX', 'PAX', 'TUBE'] as const;
export const OFF_DAY_TYPES: OffDayType[] = ['Public Holiday', 'Rest Day', 'Off Day'];

// Friday (5) is Rest Day, Saturday (6) is Off Day
export const WEEKLY_OFF_DAYS: number[] = [5, 6]; 

export const DEFAULT_AVATARS = {
  MAN: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  WOMAN_HIJAB: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aria'
};

export const INITIAL_USERS: User[] = [
  { id: 'u1', name: 'Admin User', username: 'admin', email: 'admin@halagel.com', role: 'admin', password: 'password123' },
  { id: 'u2', name: 'Manager User', username: 'manager', email: 'manager@halagel.com', role: 'manager', password: 'password123' },
  { id: 'u3', name: 'Planner User', username: 'planner', email: 'planner@halagel.com', role: 'planner', password: 'password123' },
  { id: 'u3', name: 'Planner User', username: 'Umaira', email: 'umaira@halagel.com', role: 'planner', password: 'pass123' },
  { id: 'u4', name: 'Operator User', username: 'operator', email: 'operator@halagel.com', role: 'operator', password: 'password123' },
];

export const INITIAL_OFF_DAYS: OffDay[] = [
  { id: 'od1', date: '2025-12-25', description: 'Christmas Day', type: 'Public Holiday', createdBy: 'u1' },
  { id: 'od2', date: '2026-01-01', description: 'New Year', type: 'Public Holiday', createdBy: 'u1' },
];

export const generateSeedProductionData = (): ProductionEntry[] => {
  return []; // Explicitly empty as requested by user previously
};
