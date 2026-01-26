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
    const actualQty = Number(data.actualQuantity || 0);
    entry = {
      ...data,
      id: String(data.id || Date.now()),
      date: String(data.date || '').split(' ')[0],
      productName: String(data.productName || 'Unknown'),
      planQuantity: Number(data.planQuantity || 0),
      actualQuantity: actualQty,
      unit: normalizeUnit(data.unit),
      manpower: Number(data.manpower || 0),
      batchNo: String(data.batchNo || ''),
      remark: String(data.remark || ''),
      planRemark: String(data.planRemark || ''),
      actualRemark: String(data.actualRemark || ''),
      process: String(data.process || 'Mixing') as any,
      category: String(data.category || 'Healthcare') as any,
      status: actualQty > 0 ? 'Completed' : 'In Progress',
      updatedAt: String(data.updatedAt || getDbTimestamp())
    };
  }
  return entry as ProductionEntry;
};

const normalizeLog = (data: any): ActivityLog => {
  if (!data) return {} as ActivityLog;
  if (Array.isArray(data)) {
    return {
      id: String(data[0] || Date.now()),
      timestamp: String(data[1] || getDbTimestamp()),
      userId: String(data[2] || ''),
      userName: String(data[3] || 'System'),
      action: String(data[4] || 'LOG'),
      details: String(data[5] || '')
    };
  }
  return {
    ...data,
    id: String(data.id || Date.now()),
    timestamp: String(data.timestamp || getDbTimestamp()),
    userName: String(data.userName || 'Unknown'),
    details: String(data.details || '')
  };
};

const normalizeOffDay = (data: any): OffDay => {
  if (!data) return {} as OffDay;
  if (Array.isArray(data)) {
    return {
      id: String(data[0] || Date.now()),
      date: String(data[1] || '').split(' ')[0],
      description: String(data[2] || 'Holiday'),
      createdBy: String(data[3] || 'System'),
      type: (data[4] as OffDayType) || 'Off Day'
    };
  }
  return {
    ...data,
    id: String(data.id || Date.now()),
    date: String(data.date || '').split(' ')[0],
    description: String(data.description || 'Holiday'),
    type: (data.type as OffDayType) || 'Off Day'
  };
};

const init = () => {
  if (!localStorage.getItem(KEYS.USERS)) {
    localStorage.setItem(KEYS.USERS, JSON.stringify(INITIAL_USERS));
  }
  if (!localStorage.getItem(KEYS.OFF_DAYS)) {
    localStorage.setItem(KEYS.OFF_DAYS, JSON.stringify(INITIAL_OFF_DAYS));
  }
  if (!localStorage.getItem(KEYS.PRODUCTION)) {
    localStorage.setItem(KEYS.PRODUCTION, JSON.stringify([]));
  }
  if (!localStorage.getItem(KEYS.LOGS)) {
    localStorage.setItem(KEYS.LOGS, JSON.stringify([]));
  }
};

init();

export const StorageService = {
  getUsers: (): User[] => {
    try {
      const data = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  },
  saveUsers: (users: User[]) => {
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    GoogleSheetsService.saveData('saveUsers', users);
  },
  
  getProductionData: (): ProductionEntry[] => {
    try {
      const data = JSON.parse(localStorage.getItem(KEYS.PRODUCTION) || '[]');
      return Array.isArray(data) ? data.map(normalizeProduction).filter((p: ProductionEntry) => p.date && p.date.length > 0) : [];
    } catch { return []; }
  },
  saveProductionData: (data: ProductionEntry[]) => {
    const cleaned = data.map(normalizeProduction).filter((p: ProductionEntry) => p.date && p.date.length > 0);
    localStorage.setItem(KEYS.PRODUCTION, JSON.stringify(cleaned));
    GoogleSheetsService.saveData('saveProduction', cleaned);
  },

  deleteProductionEntry: (id: string): { updatedData: ProductionEntry[], deletedItem: ProductionEntry | null } => {
    try {
      const data = StorageService.getProductionData();
      const targetId = String(id);
      const targetItem = data.find((p: ProductionEntry) => String(p.id) === targetId) || null;
      const updatedData = data.filter((p: ProductionEntry) => String(p.id) !== targetId);
      StorageService.saveProductionData(updatedData);
      return { updatedData, deletedItem: targetId ? targetItem : null };
    } catch (err) {
      console.error("Storage delete error:", err);
      return { updatedData: StorageService.getProductionData(), deletedItem: null };
    }
  },
  
  getOffDays: (): OffDay[] => {
    try {
      const data = JSON.parse(localStorage.getItem(KEYS.OFF_DAYS) || '[]');
      return Array.isArray(data) ? data.map(normalizeOffDay).filter((od: OffDay) => od.date && od.date.length > 0) : [];
    } catch { return []; }
  },
  saveOffDays: (days: OffDay[]) => {
    const cleaned = days.map(normalizeOffDay).filter((od: OffDay) => od.date && od.date.length > 0);
    localStorage.setItem(KEYS.OFF_DAYS, JSON.stringify(cleaned));
    GoogleSheetsService.saveData('saveOffDays', cleaned);
  },

  syncWithSheets: async () => {
    if (!GoogleSheetsService.isEnabled()) return;
    
    try {
      const results = await Promise.all([
        GoogleSheetsService.fetchData<any[]>('getProduction'),
        GoogleSheetsService.fetchData<any[]>('getOffDays'),
        GoogleSheetsService.fetchData<any[]>('getLogs'),
        GoogleSheetsService.fetchData<User[]>('getUsers')
      ]);

      if (results[0] && Array.isArray(results[0])) {
          const cleaned = results[0].map(normalizeProduction).filter((p: ProductionEntry) => p.date && p.date.length > 0);
          localStorage.setItem(KEYS.PRODUCTION, JSON.stringify(cleaned));
      }
      
      if (results[1] && Array.isArray(results[1])) {
          const cleaned = results[1].map(normalizeOffDay).filter((od: OffDay) => od.date && od.date.length > 0);
          localStorage.setItem(KEYS.OFF_DAYS, JSON.stringify(cleaned));
      }

      if (results[2] && Array.isArray(results[2])) {
          const cleanedLogs = results[2].map(normalizeLog).filter((l: ActivityLog) => l.timestamp);
          localStorage.setItem(KEYS.LOGS, JSON.stringify(cleanedLogs));
      }

      if (results[3] && Array.isArray(results[3])) {
          localStorage.setItem(KEYS.USERS, JSON.stringify(results[3]));
      }
    } catch (err) {
      console.error("Critical Sync Failure:", err);
      throw err;
    }
  },
  
  getLogs: (): ActivityLog[] => {
    try {
      const data = JSON.parse(localStorage.getItem(KEYS.LOGS) || '[]');
      return Array.isArray(data) ? data.map(normalizeLog) : [];
    } catch { return []; }
  },
  addLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => {
    try {
      const logs = StorageService.getLogs();
      const newLog: ActivityLog = {
        ...log,
        id: Date.now().toString(),
        timestamp: getDbTimestamp(),
      };
      logs.unshift(newLog);
      if (logs.length > 500) logs.pop(); 
      
      localStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
      GoogleSheetsService.saveData('saveLogs', logs);
    } catch (err) {
      console.error("Logging error:", err);
    }
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