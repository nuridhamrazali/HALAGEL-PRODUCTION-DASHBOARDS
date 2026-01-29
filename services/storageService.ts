
import { User, ProductionEntry, OffDay, ActivityLog, UnitType, ProductionStatus, OffDayType } from '../types';
import { INITIAL_USERS, INITIAL_OFF_DAYS, UNITS } from '../constants';
import { GoogleSheetsService } from './googleSheetsService';
import { getDbTimestamp } from '../utils/dateUtils';

const KEYS = {
  USERS: 'halagel_users',
  PRODUCTION: 'halagel_production',
  OFF_DAYS: 'halagel_off_days',
  LOGS: 'halagel_activity_logs',
  CURRENT_USER: 'halagel_current_user_session',
  LAST_WRITE: 'halagel_last_write_timestamp'
};

const normalizeUnit = (u: any): UnitType => {
  if (u === undefined || u === null || u === '') return 'KG';
  const upper = String(u).trim().toUpperCase();
  const validUnits = UNITS as unknown as string[];
  return validUnits.includes(upper) ? (upper as UnitType) : 'KG';
};

const normalizeProduction = (data: any): ProductionEntry => {
  if (!data) return {} as ProductionEntry;
  let entry: Partial<ProductionEntry> = {};
  if (Array.isArray(data)) {
    const actualQty = Number(data[6] || 0);
    entry = {
      id: String(data[0] || Date.now()),
      date: String(data[1] || '').split(' ')[0],
      category: String(data[2] || 'Healthcare') as any,
      process: String(data[3] || 'Mixing') as any,
      productName: String(data[4] || 'Unknown'),
      planQuantity: Number(data[5] || 0),
      actualQuantity: actualQty,
      unit: normalizeUnit(data[7]),
      batchNo: String(data[8] || ''),
      manpower: Number(data[9] || 0),
      lastUpdatedBy: String(data[10] || ''),
      updatedAt: String(data[11] || getDbTimestamp()),
      remark: String(data[12] || ''),
      planRemark: String(data[13] || ''),
      actualRemark: String(data[14] || ''),
      status: (data[15] as ProductionStatus) || (actualQty > 0 ? 'Completed' : 'In Progress')
    };
  } else {
    entry = {
      ...data,
      id: String(data.id || Date.now()),
      date: String(data.date || '').split(' ')[0],
      planQuantity: Number(data.planQuantity || 0),
      actualQuantity: Number(data.actualQuantity || 0),
      unit: normalizeUnit(data.unit),
      updatedAt: String(data.updatedAt || getDbTimestamp())
    };
  }
  return entry as ProductionEntry;
};

const normalizeUser = (u: any): User => ({
  id: String(u.id || ''),
  name: String(u.name || ''),
  username: String(u.username || ''),
  role: (u.role || 'operator') as any,
  password: String(u.password || ''),
  avatar: String(u.avatar || '')
});

const updateWriteTimestamp = () => {
  localStorage.setItem(KEYS.LAST_WRITE, Date.now().toString());
};

const isWriteLocked = () => {
  const lastWrite = parseInt(localStorage.getItem(KEYS.LAST_WRITE) || '0');
  return (Date.now() - lastWrite) < 10000; // 10 second safety buffer
};

export const StorageService = {
  getUsers: (): User[] => {
    try {
      const raw = localStorage.getItem(KEYS.USERS);
      if (!raw) return INITIAL_USERS;
      const data = JSON.parse(raw);
      return Array.isArray(data) && data.length > 0 ? data.map(normalizeUser) : INITIAL_USERS;
    } catch { return INITIAL_USERS; }
  },
  
  saveUsers: async (users: User[]) => {
    updateWriteTimestamp();
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    return await GoogleSheetsService.saveData('saveUsers', users);
  },
  
  getProductionData: (): ProductionEntry[] => {
    try {
      const data = JSON.parse(localStorage.getItem(KEYS.PRODUCTION) || '[]');
      return Array.isArray(data) ? data.map(normalizeProduction).filter(p => p.date) : [];
    } catch { return []; }
  },
  
  saveProductionData: async (data: ProductionEntry[]) => {
    updateWriteTimestamp();
    const cleaned = data.map(normalizeProduction).filter(p => p.date);
    localStorage.setItem(KEYS.PRODUCTION, JSON.stringify(cleaned));
    return await GoogleSheetsService.saveData('saveProduction', cleaned);
  },

  deleteProductionEntry: async (id: string): Promise<{ updatedData: ProductionEntry[], deletedItem: ProductionEntry | null }> => {
    const data = StorageService.getProductionData();
    const targetItem = data.find(p => String(p.id) === String(id)) || null;
    const updatedData = data.filter(p => String(p.id) !== String(id));
    await StorageService.saveProductionData(updatedData);
    return { updatedData, deletedItem: targetItem };
  },
  
  getOffDays: (): OffDay[] => {
    try {
      const data = JSON.parse(localStorage.getItem(KEYS.OFF_DAYS) || '[]');
      return Array.isArray(data) ? data : INITIAL_OFF_DAYS;
    } catch { return INITIAL_OFF_DAYS; }
  },
  
  saveOffDays: async (days: OffDay[]) => {
    updateWriteTimestamp();
    localStorage.setItem(KEYS.OFF_DAYS, JSON.stringify(days));
    return await GoogleSheetsService.saveData('saveOffDays', days);
  },

  syncWithSheets: async () => {
    if (!GoogleSheetsService.isEnabled() || isWriteLocked()) return;
    
    try {
      const results = await Promise.all([
        GoogleSheetsService.fetchData<any[]>('getProduction'),
        GoogleSheetsService.fetchData<any[]>('getOffDays'),
        GoogleSheetsService.fetchData<User[]>('getUsers')
      ]);

      // Only overwrite if cloud data is non-empty and seems valid
      if (results[0] && Array.isArray(results[0]) && results[0].length > 0) {
          const localCount = StorageService.getProductionData().length;
          // If cloud has significantly less data, it might be an outdated read
          if (results[0].length >= localCount || localCount === 0) {
            localStorage.setItem(KEYS.PRODUCTION, JSON.stringify(results[0].map(normalizeProduction)));
          }
      }
      
      if (results[2] && Array.isArray(results[2]) && results[2].length >= INITIAL_USERS.length) {
          localStorage.setItem(KEYS.USERS, JSON.stringify(results[2].map(normalizeUser)));
      }
    } catch (err) {
      console.error("Sync Failure:", err);
    }
  },
  
  getLogs: (): ActivityLog[] => {
    try {
      return JSON.parse(localStorage.getItem(KEYS.LOGS) || '[]');
    } catch { return []; }
  },
  
  addLog: async (log: Omit<ActivityLog, 'id' | 'timestamp'>) => {
    const logs = StorageService.getLogs();
    const newLog = { ...log, id: Date.now().toString(), timestamp: getDbTimestamp() };
    logs.unshift(newLog);
    if (logs.length > 500) logs.pop();
    localStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
    await GoogleSheetsService.saveData('saveLogs', logs);
  },

  getSession: (): User | null => {
    try {
      const session = localStorage.getItem(KEYS.CURRENT_USER);
      return session ? JSON.parse(session) : null;
    } catch { return null; }
  },
  
  setSession: (user: User | null) => {
    if (user) localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
    else localStorage.removeItem(KEYS.CURRENT_USER);
  }
};
