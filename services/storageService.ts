
import { User, ProductionEntry, OffDay, ActivityLog, UnitType, ProductionStatus, OffDayType } from '../types';
import { INITIAL_USERS, INITIAL_OFF_DAYS, UNITS } from '../constants';
import { GoogleSheetsService } from './googleSheetsService';
import { getDbTimestamp } from '../utils/dateUtils';
import { sanitizeInput } from '../utils/securityUtils';

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
      productName: sanitizeInput(String(data[4] || 'Unknown')),
      planQuantity: Number(data[5] || 0),
      actualQuantity: actualQty,
      unit: normalizeUnit(data[7]),
      batchNo: sanitizeInput(String(data[8] || '')),
      manpower: Number(data[9] || 0),
      lastUpdatedBy: String(data[10] || ''),
      updatedAt: String(data[11] || getDbTimestamp()),
      remark: sanitizeInput(String(data[12] || '')),
      planRemark: sanitizeInput(String(data[13] || '')),
      actualRemark: sanitizeInput(String(data[14] || '')),
      status: (data[15] as ProductionStatus) || (actualQty > 0 ? 'Completed' : 'In Progress')
    };
  } else {
    entry = {
      ...data,
      id: String(data.id || Date.now()),
      date: String(data.date || '').split(' ')[0],
      productName: sanitizeInput(String(data.productName || '')),
      batchNo: sanitizeInput(String(data.batchNo || '')),
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
  name: sanitizeInput(String(u.name || '')),
  username: sanitizeInput(String(u.username || '')).toLowerCase(),
  role: (u.role || 'operator') as any,
  password: String(u.password || ''),
  avatar: String(u.avatar || '')
});

const setWriteLock = () => {
  localStorage.setItem(KEYS.LAST_WRITE, Date.now().toString());
};

const isWriteLocked = () => {
  const lastWrite = parseInt(localStorage.getItem(KEYS.LAST_WRITE) || '0');
  // Extended lock for older computers (1 minute)
  return (Date.now() - lastWrite) < 60000; 
};

/**
 * RECONCILIATION LOGIC
 * Solves the 'Ghost Data' problem where deleted records reappear.
 */
const reconcileData = <T extends { id: string, updatedAt?: string }>(local: T[], cloud: T[]): T[] => {
  const cloudMap = new Map<string, T>();
  cloud.forEach(item => cloudMap.set(String(item.id), item));

  const now = Date.now();
  const result: T[] = [];

  // 1. Process all Cloud items (They are the source of truth)
  cloud.forEach(cloudItem => {
    const localItem = local.find(l => String(l.id) === String(cloudItem.id));
    if (localItem && localItem.updatedAt && cloudItem.updatedAt && localItem.updatedAt > cloudItem.updatedAt) {
      // Local is newer (user modified it while offline)
      result.push(localItem);
    } else {
      // Cloud is newer or same
      result.push(cloudItem);
    }
  });

  // 2. Handle Local-Only items (Potential New items OR Deleted-In-Cloud items)
  local.forEach(localItem => {
    if (!cloudMap.has(String(localItem.id))) {
      const updatedAtTime = localItem.updatedAt ? new Date(localItem.updatedAt.replace(' ', 'T')).getTime() : 0;
      const ageInMinutes = (now - updatedAtTime) / (1000 * 60);

      // If the item is very new (created < 10 mins ago), it's probably waiting to sync up.
      // If it's old and NOT in the cloud, it was definitely deleted on another computer.
      if (ageInMinutes < 10) {
        result.push(localItem);
      }
    }
  });

  return result;
};

export const StorageService = {
  getUsers: (): User[] => {
    try {
      const raw = localStorage.getItem(KEYS.USERS);
      let list: User[] = [];
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = parsed.map(normalizeUser);
        }
      }
      if (!list.some(u => u.username === 'admin')) return INITIAL_USERS;
      return list;
    } catch { 
      return INITIAL_USERS; 
    }
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
    // Immediately save locally
    localStorage.setItem(KEYS.PRODUCTION, JSON.stringify(updatedData));
    // Save to cloud
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
    if (isWriteLocked()) return;
    
    try {
      const results = await Promise.all([
        GoogleSheetsService.fetchData<any[]>('getProduction'),
        GoogleSheetsService.fetchData<any[]>('getOffDays'),
        GoogleSheetsService.fetchData<User[]>('getUsers'),
        GoogleSheetsService.fetchData<any[]>('getLogs')
      ]);

      if (results[0] && Array.isArray(results[0])) {
        const cloudProduction = results[0].map(normalizeProduction);
        const localProduction = StorageService.getProductionData();
        const merged = reconcileData(localProduction, cloudProduction);
        localStorage.setItem(KEYS.PRODUCTION, JSON.stringify(merged));
      }
      
      if (results[2] && Array.isArray(results[2]) && results[2].length > 0) {
        const cloudUsers = results[2].map(normalizeUser);
        const localUsers = StorageService.getUsers();
        const mergedUsers = reconcileData(localUsers, cloudUsers);
        localStorage.setItem(KEYS.USERS, JSON.stringify(mergedUsers));
      }

      if (results[1] && Array.isArray(results[1]) && results[1].length > 0) {
        localStorage.setItem(KEYS.OFF_DAYS, JSON.stringify(results[1]));
      }

      if (results[3] && Array.isArray(results[3])) {
        // Simple overwrite for logs as they are append-only mostly
        localStorage.setItem(KEYS.LOGS, JSON.stringify(results[3].slice(0, 500)));
      }
    } catch (err) {
      console.error("Background Sync Failure:", err);
    }
  },
  
  getLogs: (): ActivityLog[] => {
    try {
      const logs = JSON.parse(localStorage.getItem(KEYS.LOGS) || '[]');
      return Array.isArray(logs) ? logs : [];
    } catch { return []; }
  },
  
  addLog: async (log: Omit<ActivityLog, 'id' | 'timestamp'>) => {
    setWriteLock();
    const logs = StorageService.getLogs();
    const newLog = { 
        ...log, 
        id: Date.now().toString(), 
        timestamp: getDbTimestamp() 
    };
    logs.unshift(newLog);
    if (logs.length > 500) logs.pop();
    localStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
    return await GoogleSheetsService.saveData('saveLogs', [newLog, ...logs.slice(0, 49)]);
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
