


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
  REMEMBER_ME: 'halagel_remember_session',
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

/**
 * USER RECONCILIATION LOGIC
 * User accounts are authoritative in the cloud (Google Sheets) when connected.
 * This guarantees:
 * 1. Usernames are unique primary keys (case-insensitive).
 * 2. Cloud updates/deletes take precedence over stale local cache.
 * 3. Local accounts deleted in the cloud are purged, never resurrected.
 * 4. Local accounts created offline recently (< 15 mins) on this device are preserved.
 */
const reconcileUsers = (local: User[], cloud: User[]): User[] => {
  const userMap = new Map<string, User>();

  // 1. Cloud users represent the authoritative database accounts
  cloud.forEach(c => {
    if (!c.username) return;
    const cleanUser = normalizeUser(c);
    const key = cleanUser.username.toLowerCase();
    const existing = userMap.get(key);
    if (!existing || String(cleanUser.updatedAt || '') >= String(existing.updatedAt || '')) {
      userMap.set(key, cleanUser);
    }
  });

  // 2. Only keep local users if they are not in the cloud AND were created offline on this device in the last 15 minutes
  // (Prevents resurrecting accounts that were deleted in the cloud by an admin on another device)
  const now = Date.now();
  local.forEach(l => {
    if (!l.username) return;
    const key = l.username.toLowerCase();
    if (!userMap.has(key)) {
      const createdEpoch = parseInt(String(l.id));
      if (!isNaN(createdEpoch) && (now - createdEpoch) < (15 * 60 * 1000)) {
        userMap.set(key, normalizeUser(l));
      }
    }
  });

  // Ensure default admin is present if missing
  if (!userMap.has('admin')) {
    const adminUser = INITIAL_USERS.find(u => u.username === 'admin');
    if (adminUser) userMap.set('admin', adminUser);
  }

  return Array.from(userMap.values());
};

/**
 * DEDUPLICATION LOGIC FOR ACTIVITY LOGS
 * Removes duplicate log entries by unique ID or matching content signature
 * (timestamp + action + user + details), sorting newest first.
 */
export const deduplicateLogs = (logs: any[]): ActivityLog[] => {
  if (!Array.isArray(logs)) return [];
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();
  const result: ActivityLog[] = [];

  for (const item of logs) {
    if (!item) continue;
    
    const id = String(item.id || '').trim();
    const userId = String(item.userId || '').trim();
    const userName = String(item.userName || '').trim();
    const action = String(item.action || '').trim().toUpperCase();
    const details = String(item.details || '').trim();
    const timestamp = String(item.timestamp || '').trim();

    const log: ActivityLog = {
      id: id || `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      userName: userName || userId || 'System',
      action,
      details,
      timestamp
    };

    const userKey = (userName || userId).toLowerCase();
    // Normalize timestamp (e.g., removing any extra whitespace)
    const signature = `${timestamp}:::${action}:::${userKey}:::${details}`;
    const idKey = log.id ? `ID:::${log.id}` : null;

    if (idKey && seenIds.has(idKey)) {
      continue;
    }
    if (seenSignatures.has(signature)) {
      continue;
    }

    if (idKey) seenIds.add(idKey);
    seenSignatures.add(signature);
    result.push(log);
  }

  // Sort descending by timestamp (newest first)
  return result.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
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
      if (!list.some(u => u.username === 'admin')) list = INITIAL_USERS;

      // Strictly deduplicate by username (case-insensitive) - preserve latest updatedAt
      const userMap = new Map<string, User>();
      list.forEach(u => {
        if (!u.username) return;
        const key = u.username.toLowerCase();
        const existing = userMap.get(key);
        if (!existing || String(u.updatedAt || '') >= String(existing.updatedAt || '')) {
          userMap.set(key, u);
        }
      });
      return Array.from(userMap.values());
    } catch { 
      return INITIAL_USERS; 
    }
  },
  
  saveUsers: async (users: User[]): Promise<boolean> => {
    setWriteLock();

    // Deduplicate by username (case-insensitive)
    const userMap = new Map<string, User>();
    users.forEach(u => {
      if (!u.username) return;
      const key = u.username.toLowerCase();
      userMap.set(key, normalizeUser(u));
    });
    const cleanedUsers = Array.from(userMap.values());

    localStorage.setItem(KEYS.USERS, JSON.stringify(cleanedUsers));

    // Update session if current user was updated or deleted
    const session = StorageService.getSession();
    if (session) {
      const match = cleanedUsers.find(u => u.username.toLowerCase() === session.username.toLowerCase());
      if (match) {
        StorageService.setSession(match);
      } else {
        StorageService.setSession(null);
      }
    }

    // Direct save to Google Sheets (authoritative push, prevents zombie re-merge)
    if (GoogleSheetsService.isEnabled()) {
      try {
        return await GoogleSheetsService.saveData('saveUsers', cleanedUsers);
      } catch (e) {
        console.warn('Failed to save users to Google Sheets:', e);
        return false;
      }
    }
    return true;
  },

  syncUsers: async (): Promise<User[]> => {
    if (!GoogleSheetsService.isEnabled()) {
      return StorageService.getUsers();
    }
    try {
      const cloudRaw = await GoogleSheetsService.fetchData<any[]>('getUsers');
      if (cloudRaw && Array.isArray(cloudRaw) && cloudRaw.length > 0) {
        const cloudUsers = cloudRaw.map(normalizeUser);
        const localUsers = StorageService.getUsers();
        const mergedUsers = reconcileUsers(localUsers, cloudUsers);
        
        localStorage.setItem(KEYS.USERS, JSON.stringify(mergedUsers));
        
        // Sync active session if the user's role or info changed in cloud
        const currentSession = StorageService.getSession();
        if (currentSession) {
          const fresh = mergedUsers.find(u => u.username.toLowerCase() === currentSession.username.toLowerCase());
          if (!fresh) {
            StorageService.setSession(null);
            window.dispatchEvent(new CustomEvent('user-session-invalidated', {
              detail: { message: 'Your account was deleted by an administrator.' }
            }));
          } else if (fresh.role !== currentSession.role || fresh.name !== currentSession.name) {
            StorageService.setSession(fresh);
            window.dispatchEvent(new CustomEvent('user-session-updated', {
              detail: { user: fresh }
            }));
          }
        }

        return mergedUsers;
      }
    } catch (err) {
      console.warn("Failed to sync users with cloud:", err);
    }
    return StorageService.getUsers();
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
        console.warn("Fetch before save failed:", err?.toString() || 'Network failure');
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
        const mergedUsers = reconcileUsers(localUsers, cloudUsers);
        localStorage.setItem(KEYS.USERS, JSON.stringify(mergedUsers));

        // Sync active session if role or details updated in cloud
        const currentSession = StorageService.getSession();
        if (currentSession) {
          const fresh = mergedUsers.find(u => u.username.toLowerCase() === currentSession.username.toLowerCase());
          if (!fresh) {
            StorageService.setSession(null);
            window.dispatchEvent(new CustomEvent('user-session-invalidated', {
              detail: { message: 'Your account was deleted by an administrator.' }
            }));
          } else if (fresh.role !== currentSession.role || fresh.name !== currentSession.name) {
            StorageService.setSession(fresh);
            window.dispatchEvent(new CustomEvent('user-session-updated', {
              detail: { user: fresh }
            }));
          }
        }
      }

      if (results[1] && Array.isArray(results[1]) && results[1].length > 0) {
        const cloudOffDays = results[1];
        const localOffDays = StorageService.getOffDays();
        // Assume OffDays share similar shapes
        const mergedOffDays = reconcileData(localOffDays as any, cloudOffDays as any, getDeletedIds());
        localStorage.setItem(KEYS.OFF_DAYS, JSON.stringify(mergedOffDays));
      }

      if (results[3] && Array.isArray(results[3])) {
        const localLogs = StorageService.getLogs();
        const cloudLogs = results[3];
        const mergedLogs = deduplicateLogs([...localLogs, ...cloudLogs]).slice(0, 500);
        localStorage.setItem(KEYS.LOGS, JSON.stringify(mergedLogs));

        // If cloud had duplicates or was out of sync, write back the cleaned list
        if (results[3].length !== mergedLogs.slice(0, results[3].length).length) {
          GoogleSheetsService.saveData('saveLogs', mergedLogs.slice(0, 50)).catch(() => {});
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('activity-log-updated', { detail: { logs: mergedLogs } }));
        }
      }
    } catch (err) {
      console.warn("Background Sync Failure:", err?.toString() || 'Network failure');
    }
  },
  
  getLogs: (): ActivityLog[] => {
    try {
      const raw = localStorage.getItem(KEYS.LOGS);
      if (!raw) return [];
      const logs = JSON.parse(raw);
      if (!Array.isArray(logs)) return [];
      const clean = deduplicateLogs(logs);
      if (clean.length !== logs.length) {
        localStorage.setItem(KEYS.LOGS, JSON.stringify(clean));
      }
      return clean;
    } catch { return []; }
  },
  
  addLog: async (log: Omit<ActivityLog, 'id' | 'timestamp'>) => {
    setWriteLock();
    const newLog: ActivityLog = { 
        ...log, 
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, 
        timestamp: getDbTimestamp() 
    };

    const currentLogs = StorageService.getLogs();
    const updatedLogs = deduplicateLogs([newLog, ...currentLogs]).slice(0, 500);
    localStorage.setItem(KEYS.LOGS, JSON.stringify(updatedLogs));

    // Instantly notify current tab and other open components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('activity-log-updated', { detail: { log: newLog, logs: updatedLogs } }));
      window.dispatchEvent(new CustomEvent('halagel-data-updated'));
    }

    // Save to Google Sheets: send updatedLogs.slice(0, 50) directly (single entry, no double prepend)
    if (GoogleSheetsService.isEnabled()) {
      try {
        await GoogleSheetsService.saveData('saveLogs', updatedLogs.slice(0, 50));
      } catch (err) {
        console.warn("Failed to sync log to cloud:", err?.toString() || 'Network failure');
      }
    }
    return true;
  },

  getSession: (): User | null => {
    try {
      // 1. Check sessionStorage first (active tab/window/PWA session)
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const sessionStr = sessionStorage.getItem(KEYS.CURRENT_USER);
        if (sessionStr) {
          return JSON.parse(sessionStr);
        }
      }

      // 2. Check if user explicitly enabled "Remember me on this device"
      if (typeof window !== 'undefined' && window.localStorage) {
        const isRemembered = localStorage.getItem(KEYS.REMEMBER_ME) === 'true';
        if (isRemembered) {
          const localStr = localStorage.getItem(KEYS.CURRENT_USER);
          if (localStr) {
            const parsed = JSON.parse(localStr);
            // Hydrate sessionStorage for the current tab/session
            if (window.sessionStorage) {
              sessionStorage.setItem(KEYS.CURRENT_USER, localStr);
            }
            return parsed;
          }
        } else {
          // Purge any stale, non-remembered persistent sessions in localStorage
          localStorage.removeItem(KEYS.CURRENT_USER);
        }
      }
      return null;
    } catch { 
      return null; 
    }
  },
  
  setSession: (user: User | null, rememberMe?: boolean) => {
    try {
      if (typeof window === 'undefined') return;

      if (user) {
        const userJson = JSON.stringify(user);
        // Active session is always placed in sessionStorage
        if (window.sessionStorage) {
          sessionStorage.setItem(KEYS.CURRENT_USER, userJson);
        }

        // Determine persistence across browser/PWA closure
        const shouldRemember = rememberMe !== undefined
          ? rememberMe
          : (localStorage.getItem(KEYS.REMEMBER_ME) === 'true');

        if (shouldRemember) {
          localStorage.setItem(KEYS.REMEMBER_ME, 'true');
          localStorage.setItem(KEYS.CURRENT_USER, userJson);
        } else {
          localStorage.removeItem(KEYS.REMEMBER_ME);
          localStorage.removeItem(KEYS.CURRENT_USER);
        }
      } else {
        if (window.sessionStorage) {
          sessionStorage.removeItem(KEYS.CURRENT_USER);
        }
        localStorage.removeItem(KEYS.REMEMBER_ME);
        localStorage.removeItem(KEYS.CURRENT_USER);
      }
    } catch (e) {
      console.warn('Session storage operation failed:', e);
    }
  }
};
