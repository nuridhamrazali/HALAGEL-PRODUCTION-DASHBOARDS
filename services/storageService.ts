
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

const normalizeLog = (l: any): ActivityLog => {
  if (Array.isArray(l)) {
    return {
      id: String(l[0] || Date.now()),
      timestamp: String(l[1] || getDbTimestamp()),
      userId: String(l[2] || ''),
      userName: String(l[3] || 'Unknown'),
      action: String(l[4] || 'ACTION'),
      details: String(l[5] || '')
    };
  }
  return {
    ...l,
    id: String(l.id || Date.now()),
    timestamp: String(l.timestamp || getDbTimestamp())
  };
};

const setWriteLock = () => {
  localStorage.setItem(KEYS.LAST_WRITE, Date.now().toString());
};

const isWriteLocked = () => {
  const lastWrite = parseInt(localStorage.getItem(KEYS.LAST_WRITE) || '0');
  return (Date.now() - lastWrite) < 45000; 
};

// Helper to merge arrays by ID, keeping the latest version based on updatedAt
const mergeById = <T extends { id: string, updatedAt?: string }>(local: T[], cloud: T[]): T[] => {
  const map = new Map<string, T>();
  // Start with cloud data
  cloud.forEach(item => map.set(String(item.id), item));
  // Override with local data if local is newer or cloud version missing
  local.forEach(item => {
    const existing = map.get(String(item.id));
    if (!existing || (item.updatedAt && existing.updatedAt && item.updatedAt > existing.updatedAt)) {
      map.set(String(item.id), item);
    }
  });
  return Array.from(map.values());
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
    setWriteLock();
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
    setWriteLock();
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
      return Array.isArray(data) && data.length > 0 ? data : INITIAL_OFF_DAYS;
    } catch { return INITIAL_OFF_DAYS; }
  },
  
  saveOffDays: async (days: OffDay[]) => {
    setWriteLock();
    localStorage.setItem(KEYS.OFF_DAYS, JSON.stringify(days));
    return await GoogleSheetsService.saveData('saveOffDays', days);
  },

  syncWithSheets: async () => {
    if (!GoogleSheetsService.isEnabled()) return;
    
    const locked = isWriteLocked();
    
    try {
      const results = await Promise.all([
        GoogleSheetsService.fetchData<any[]>('getProduction'),
        GoogleSheetsService.fetchData<any[]>('getOffDays'),
        GoogleSheetsService.fetchData<User[]>('getUsers'),
        GoogleSheetsService.fetchData<any[]>('getLogs')
      ]);

      const localProduction = StorageService.getProductionData();
      const localLogs = StorageService.getLogs();

      // For Production and Logs: MERGE instead of OVERWRITE
      if (results[0] && Array.isArray(results[0])) {
        const cloudProduction = results[0].map(normalizeProduction);
        const merged = mergeById(localProduction, cloudProduction);
        localStorage.setItem(KEYS.PRODUCTION, JSON.stringify(merged));
      }
      
      if (results[3] && Array.isArray(results[3])) {
        const cloudLogs = results[3].map(normalizeLog);
        const mergedLogs = mergeById(localLogs, cloudLogs);
        // Sort logs descending by timestamp
        mergedLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        localStorage.setItem(KEYS.LOGS, JSON.stringify(mergedLogs.slice(0, 500)));
      }

      if (results[2] && Array.isArray(results[2]) && results[2].length > 0) {
        localStorage.setItem(KEYS.USERS, JSON.stringify(results[2].map(normalizeUser)));
      }

      if (results[1] && Array.isArray(results[1]) && results[1].length > 0) {
        localStorage.setItem(KEYS.OFF_DAYS, JSON.stringify(results[1]));
      }
    } catch (err) {
      console.error("Background Sync Failure:", err);
    }
  },
  
  getLogs: (): ActivityLog[] => {
    try {
      const logs = JSON.parse(localStorage.getItem(KEYS.LOGS) || '[]');
      return Array.isArray(logs) ? logs.map(normalizeLog) : [];
    } catch { return []; }
  },
  
  addLog: async (log: Omit<ActivityLog, 'id' | 'timestamp'>) => {
    setWriteLock(); // CRITICAL: Adding a log must lock production sync to prevent overwrites
    const logs = StorageService.getLogs();
    const newLog = { ...log, id: Date.now().toString(), timestamp: getDbTimestamp(), updatedAt: getDbTimestamp() };
    logs.unshift(newLog);
    if (logs.length > 500) logs.pop();
    localStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
    return await GoogleSheetsService.saveData('saveLogs', [newLog, ...logs.slice(0, 49)]); // Send batch to cloud
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
