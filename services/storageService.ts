


import { User, ProductionEntry, OffDay, ActivityLog, UnitType, ProductionStatus } from '../types';
import { INITIAL_USERS, INITIAL_OFF_DAYS, UNITS } from '../constants';
import { GoogleSheetsService } from './googleSheetsService';
import { getDbTimestamp } from '../utils/dateUtils';

const KEYS = {
  USERS: 'halagel_users',
  PRODUCTION: 'halagel_production',
  OFF_DAYS: 'halagel_off_days',
  LOGS: 'halagel_activity_logs',
  CURRENT_USER: 'halagel_current_user_session',
  LAST_WRITE: 'halagel_last_write_timestamp',
  DELETED_IDS: 'halagel_deleted_ids'
};

const getDeletedIds = (): string[] => {
  try { return JSON.parse(localStorage.getItem(KEYS.DELETED_IDS) || '[]'); } catch { return []; }
};

const addDeletedId = (id: string) => {
  const ids = getDeletedIds();
  if (!ids.includes(String(id))) {
    ids.push(String(id));
    if (ids.length > 2000) ids.shift(); // Keep max 2000 tombstones
    localStorage.setItem(KEYS.DELETED_IDS, JSON.stringify(ids));
  }
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
      productName: String(data.productName || ''),
      batchNo: String(data.batchNo || ''),
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
  username: String(u.username || '').toLowerCase(),
  role: (u.role || 'operator') as any,
  password: String(u.password || ''),
  avatar: String(u.avatar || ''),
  updatedAt: String(u.updatedAt || '')
});

const setWriteLock = () => {
  localStorage.setItem(KEYS.LAST_WRITE, Date.now().toString());
};

const isWriteLocked = () => {
  const lastWrite = parseInt(localStorage.getItem(KEYS.LAST_WRITE) || '0');
  return (Date.now() - lastWrite) < 60000; 
};

/**
 * RECONCILIATION LOGIC
 * Correctly merges cloud data with local data by comparing updatedAt via lexicographical string comparison.
 * Uses explicit tombstone matching to solve the 'Ghost Data' problem.
 */
const reconcileData = <T extends { id: string, updatedAt?: string }>(local: T[], cloud: T[], deletedIds: string[]): T[] => {
  const cloudMap = new Map<string, T>();
  cloud.forEach(item => cloudMap.set(String(item.id), item));

  const now = Date.now();
  const result: T[] = [];

  // 1. Process all Cloud items (They are the source of truth for existing data)
  cloud.forEach(cloudItem => {
    // If explicitly deleted on this device but not yet synced securely, omit it
    if (deletedIds.includes(String(cloudItem.id))) return;

    const localItem = local.find(l => String(l.id) === String(cloudItem.id));
    // If local was updated more recently, keep local
    if (localItem && localItem.updatedAt && cloudItem.updatedAt && String(localItem.updatedAt) > String(cloudItem.updatedAt)) {
      result.push(localItem);
    } else {
      result.push(cloudItem);
    }
  });

  // 2. Handle Local-Only items (Potential New items OR Deleted-In-Cloud items)
  local.forEach(localItem => {
    if (!cloudMap.has(String(localItem.id))) {
      // Don't resurrect deleted things
      if (deletedIds.includes(String(localItem.id))) return;

      const createdEpoch = parseInt(String(localItem.id));
      
      // If we can parse a valid timestamp (after year 2000) from ID
      if (!isNaN(createdEpoch) && createdEpoch > 946684800000) {
        const ageInHours = (now - createdEpoch) / (1000 * 60 * 60);

        // Keep local items if created recently (< 24 hrs) and not synced yet.
        // Gives wide berth for slow syncs, but ignores cloud-deleted items after 24H.
        if (ageInHours < 24) {
          result.push(localItem);
        }
      } else {
        // Fallback: If ID is not a timestamp, keep it to be safe (e.g. static data)
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
    // Detect deletes
    const currentList = StorageService.getUsers();
    currentList.forEach(curr => {
      if (!users.some(u => String(u.id) === String(curr.id))) addDeletedId(String(curr.id));
    });

    localStorage.setItem(KEYS.USERS, JSON.stringify(users));

    // Fetch before save merging
    if (GoogleSheetsService.isEnabled()) {
      try {
        const cloudRaw = await GoogleSheetsService.fetchData<any[]>('getUsers');
        if (cloudRaw && Array.isArray(cloudRaw)) {
          const cloudData = cloudRaw.map(normalizeUser);
          const merged = reconcileData(users, cloudData, getDeletedIds());
          localStorage.setItem(KEYS.USERS, JSON.stringify(merged));
          return await GoogleSheetsService.saveData('saveUsers', merged);
        }
      } catch {}
    }
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
    // Detect deletes
    const currentList = StorageService.getProductionData();
    currentList.forEach(curr => {
      if (!data.some(u => String(u.id) === String(curr.id))) addDeletedId(String(curr.id));
    });

    const cleaned = data.map(normalizeProduction).filter(p => p.date);
    localStorage.setItem(KEYS.PRODUCTION, JSON.stringify(cleaned));

    // Fetch before save merging - fixes concurrent missing inputs bug
    if (GoogleSheetsService.isEnabled()) {
      try {
        const cloudRaw = await GoogleSheetsService.fetchData<any[]>('getProduction');
        if (cloudRaw && Array.isArray(cloudRaw)) {
          const cloudData = cloudRaw.map(normalizeProduction);
          const merged = reconcileData(cleaned, cloudData, getDeletedIds());
          localStorage.setItem(KEYS.PRODUCTION, JSON.stringify(merged));
          return await GoogleSheetsService.saveData('saveProduction', merged);
        }
      } catch (err) {
        console.error("Fetch before save failed", err);
      }
    }
    return await GoogleSheetsService.saveData('saveProduction', cleaned);
  },

  deleteProductionEntry: async (id: string): Promise<{ updatedData: ProductionEntry[], deletedItem: ProductionEntry | null }> => {
    addDeletedId(String(id));
    const data = StorageService.getProductionData();
    const targetItem = data.find(p => String(p.id) === String(id)) || null;
    const updatedData = data.filter(p => String(p.id) !== String(id));
    
    setWriteLock();
    localStorage.setItem(KEYS.PRODUCTION, JSON.stringify(updatedData));
    
    if (GoogleSheetsService.isEnabled()) {
      try {
        const cloudRaw = await GoogleSheetsService.fetchData<any[]>('getProduction');
        if (cloudRaw && Array.isArray(cloudRaw)) {
          const cloudData = cloudRaw.map(normalizeProduction);
          const merged = reconcileData(updatedData, cloudData, getDeletedIds());
          localStorage.setItem(KEYS.PRODUCTION, JSON.stringify(merged));
          await GoogleSheetsService.saveData('saveProduction', merged);
          return { updatedData: merged, deletedItem: targetItem };
        }
      } catch {}
    }

    await GoogleSheetsService.saveData('saveProduction', updatedData);
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
    const currentList = StorageService.getOffDays();
    currentList.forEach(curr => {
      if (!days.some(u => String(u.id) === String(curr.id))) addDeletedId(String(curr.id));
    });

    localStorage.setItem(KEYS.OFF_DAYS, JSON.stringify(days));

    if (GoogleSheetsService.isEnabled()) {
      try {
        const cloudRaw = await GoogleSheetsService.fetchData<any[]>('getOffDays');
        if (cloudRaw && Array.isArray(cloudRaw)) {
          const merged = reconcileData(days, cloudRaw as any, getDeletedIds());
          localStorage.setItem(KEYS.OFF_DAYS, JSON.stringify(merged));
          return await GoogleSheetsService.saveData('saveOffDays', merged);
        }
      } catch {}
    }
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
        const merged = reconcileData(localProduction, cloudProduction, getDeletedIds());
        localStorage.setItem(KEYS.PRODUCTION, JSON.stringify(merged));
      }
      
      if (results[2] && Array.isArray(results[2]) && results[2].length > 0) {
        const cloudUsers = results[2].map(normalizeUser);
        const localUsers = StorageService.getUsers();
        const mergedUsers = reconcileData(localUsers, cloudUsers, getDeletedIds());
        localStorage.setItem(KEYS.USERS, JSON.stringify(mergedUsers));
      }

      if (results[1] && Array.isArray(results[1]) && results[1].length > 0) {
        const cloudOffDays = results[1];
        const localOffDays = StorageService.getOffDays();
        // Assume OffDays share similar shapes
        const mergedOffDays = reconcileData(localOffDays as any, cloudOffDays as any, getDeletedIds());
        localStorage.setItem(KEYS.OFF_DAYS, JSON.stringify(mergedOffDays));
      }

      if (results[3] && Array.isArray(results[3])) {
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
