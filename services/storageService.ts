


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
  DELETED_IDS: 'halagel_deleted_ids',
  BACKUP_LATEST: 'halagel_production_backup_latest'
};

const getDeletedIds = (): string[] => {
  try { return JSON.parse(localStorage.getItem(KEYS.DELETED_IDS) || '[]'); } catch { return []; }
};

const addDeletedId = (id: string) => {
  const ids = getDeletedIds();
  if (!ids.includes(String(id))) {
    ids.push(String(id));
    if (ids.length > 500) ids.shift();
    localStorage.setItem(KEYS.DELETED_IDS, JSON.stringify(ids));
  }
};

const saveLocalBackup = (entries: ProductionEntry[]) => {
  try {
    if (Array.isArray(entries) && entries.length > 0) {
      localStorage.setItem(KEYS.BACKUP_LATEST, JSON.stringify({
        timestamp: new Date().toISOString(),
        count: entries.length,
        data: entries
      }));
    }
  } catch {}
};

const normalizeUnit = (u: any): UnitType => {
  if (u === undefined || u === null || u === '') return 'KG';
  const upper = String(u).trim().toUpperCase();
  const validUnits = UNITS as unknown as string[];
  return validUnits.includes(upper) ? (upper as UnitType) : 'KG';
};

/**
 * Normalizes any date string (DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, or YYYY-MM-DD) to ISO YYYY-MM-DD
 */
const normalizeToISODate = (dateStr: string): string => {
  if (!dateStr) return '';
  const clean = String(dateStr).trim().split(' ')[0].split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const parts = clean.includes('/') ? clean.split('/') : clean.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    if (p1 > 12 && p0 <= 12) {
      return `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
    return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return clean;
};

const normalizeProduction = (data: any): ProductionEntry => {
  if (!data) return {} as ProductionEntry;
  let entry: Partial<ProductionEntry> = {};
  if (Array.isArray(data)) {
    const actualQty = Number(data[6] || 0);
    const rawDate = String(data[1] || '').trim();
    const isoDate = normalizeToISODate(rawDate);
    const category = String(data[2] || 'Healthcare');
    const process = String(data[3] || 'Mixing');
    const productName = String(data[4] || 'Unknown');
    const batchNo = String(data[8] || '');
    const fallbackId = `${isoDate}_${category}_${process}_${productName}_${batchNo}`.replace(/[\s/:]+/g, '_');

    entry = {
      id: String(data[0] || fallbackId),
      date: isoDate,
      category: category as any,
      process: process as any,
      productName,
      planQuantity: Number(data[5] || 0),
      actualQuantity: actualQty,
      unit: normalizeUnit(data[7]),
      batchNo,
      manpower: Number(data[9] || 0),
      lastUpdatedBy: String(data[10] || ''),
      updatedAt: String(data[11] || getDbTimestamp()),
      remark: String(data[12] || ''),
      planRemark: String(data[13] || ''),
      actualRemark: String(data[14] || ''),
      status: (data[15] as ProductionStatus) || (actualQty > 0 ? 'Completed' : 'In Progress')
    };
  } else {
    const rawDate = String(data.date || '').trim();
    const isoDate = normalizeToISODate(rawDate);
    const category = String(data.category || 'Healthcare');
    const process = String(data.process || 'Mixing');
    const productName = String(data.productName || '');
    const batchNo = String(data.batchNo || '');
    const fallbackId = `${isoDate}_${category}_${process}_${productName}_${batchNo}`.replace(/[\s/:]+/g, '_');

    entry = {
      ...data,
      id: String(data.id || fallbackId),
      date: isoDate,
      category: category as any,
      process: process as any,
      productName,
      batchNo,
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
 * Uses explicit tombstone matching to solve the 'Ghost Data' problem and strictly prevents duplicate IDs.
 */
const reconcileData = <T extends { id: string, updatedAt?: string }>(local: T[], cloud: T[], deletedIds: string[]): T[] => {
  const cloudMap = new Map<string, T>();
  cloud.forEach(item => {
    if (item && item.id) cloudMap.set(String(item.id), item);
  });

  const now = Date.now();
  const seenIds = new Set<string>();
  const result: T[] = [];

  const addItem = (item: T) => {
    if (!item || !item.id) return;
    const key = String(item.id);
    if (seenIds.has(key)) return;
    seenIds.add(key);
    result.push(item);
  };

  // 1. Process all Cloud items (They are the source of truth for existing data)
  cloud.forEach(cloudItem => {
    if (!cloudItem || !cloudItem.id) return;
    // If explicitly deleted on this device but not yet synced securely, omit it
    if (deletedIds.includes(String(cloudItem.id))) return;

    const localItem = local.find(l => l && String(l.id) === String(cloudItem.id));
    // If local was updated more recently, keep local
    if (localItem && localItem.updatedAt && cloudItem.updatedAt && String(localItem.updatedAt) > String(cloudItem.updatedAt)) {
      addItem(localItem);
    } else {
      addItem(cloudItem);
    }
  });

  // 2. Handle Local-Only items (Potential New items OR Deleted-In-Cloud items)
  local.forEach(localItem => {
    if (!localItem || !localItem.id) return;
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
          addItem(localItem);
        }
      } else {
        // Fallback: If ID is not a timestamp, keep it to be safe (e.g. static data)
        addItem(localItem);
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
 * DEDUPLICATION LOGIC FOR PRODUCTION ENTRIES
 * Removes duplicate production entries by unique ID or matching content signature
 * (date + category + process + productName + batchNo), preserving the latest updated entry.
 */
export const deduplicateProductionEntries = (entries: ProductionEntry[]): ProductionEntry[] => {
  if (!Array.isArray(entries)) return [];
  const byId = new Map<string, ProductionEntry>();
  const byContent = new Map<string, ProductionEntry>();

  for (const item of entries) {
    if (!item || !item.date) continue;
    const clean = normalizeProduction(item);
    const id = String(clean.id).trim();

    // Content signature: date + category + process + productName + batchNo
    const contentKey = `${clean.date}:::${clean.category}:::${clean.process}:::${clean.productName.trim().toLowerCase()}:::${(clean.batchNo || '').trim().toLowerCase()}`;

    // Check if duplicate by ID
    const existingById = byId.get(id);
    if (existingById) {
      if (String(clean.updatedAt || '') >= String(existingById.updatedAt || '')) {
        byId.set(id, clean);
        byContent.set(contentKey, clean);
      }
      continue;
    }

    // Check if duplicate by Content Signature (catches duplicate items created with different IDs)
    const existingByContent = byContent.get(contentKey);
    if (existingByContent) {
      const cleanTime = String(clean.updatedAt || '');
      const existingTime = String(existingByContent.updatedAt || '');
      // Prefer newer update or completed entry
      if (cleanTime > existingTime || (clean.actualQuantity > 0 && existingByContent.actualQuantity === 0)) {
        byId.delete(String(existingByContent.id));
        byId.set(id, clean);
        byContent.set(contentKey, clean);
      }
      continue;
    }

    byId.set(id, clean);
    byContent.set(contentKey, clean);
  }

  // Sort descending by date (newest first)
  return Array.from(byId.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
};

/**
 * DEDUPLICATION LOGIC FOR ACTIVITY LOGS
 * Removes duplicate log entries by unique ID or matching content signature
 * (normalized timestamp + action + user + details), sorting newest first.
 */
export const deduplicateLogs = (logs: any[]): ActivityLog[] => {
  if (!Array.isArray(logs)) return [];
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();
  const result: ActivityLog[] = [];

  for (const item of logs) {
    if (!item) continue;
    
    let id = String(item.id || '').trim();
    const userId = String(item.userId || '').trim();
    const userName = String(item.userName || '').trim();
    const action = String(item.action || '').trim().toUpperCase();
    const details = String(item.details || '').trim();
    const timestamp = String(item.timestamp || '').trim();

    const userKey = (userName || userId).toLowerCase();
    // Normalize timestamp (e.g. YYYYMMDDHHmmss) to eliminate formatting differences across cloud/local
    const normTime = timestamp.replace(/[^\d]/g, '').slice(0, 14);
    const signature = `${normTime}:::${action}:::${userKey}:::${details.toLowerCase()}`;

    // Deterministic fallback ID
    if (!id) {
      id = `log_${normTime || Date.now()}_${userKey}_${action.slice(0, 4)}`;
    }

    const idKey = `ID:::${id}`;

    if (seenIds.has(idKey)) {
      continue;
    }
    if (normTime && seenSignatures.has(signature)) {
      continue;
    }

    seenIds.add(idKey);
    if (normTime) seenSignatures.add(signature);

    result.push({
      id,
      userId,
      userName: userName || userId || 'System',
      action,
      details,
      timestamp
    });
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
      if (!Array.isArray(data)) return [];
      const clean = deduplicateProductionEntries(data);
      if (clean.length !== data.length) {
        localStorage.setItem(KEYS.PRODUCTION, JSON.stringify(clean));
      }
      return clean;
    } catch { return []; }
  },
  
  saveProductionData: async (data: ProductionEntry[]) => {
    setWriteLock();

    const cleaned = deduplicateProductionEntries(data.map(normalizeProduction).filter(p => p.date));
    localStorage.setItem(KEYS.PRODUCTION, JSON.stringify(cleaned));
    saveLocalBackup(cleaned);

    // Fetch before save merging - fixes concurrent missing inputs bug
    if (GoogleSheetsService.isEnabled()) {
      try {
        const cloudRaw = await GoogleSheetsService.fetchData<any[]>('getProduction');
        if (cloudRaw && Array.isArray(cloudRaw) && cloudRaw.length > 0) {
          const cloudData = cloudRaw.map(normalizeProduction);
          const merged = deduplicateProductionEntries(reconcileData(cleaned, cloudData, getDeletedIds()));

          // SAFETY GUARD: Never allow a smaller local submission to truncate a larger cloud database!
          if (merged.length < cloudData.length) {
            console.warn("Safety Guard Active: Merged records count is less than existing cloud records. Cloud overwrite aborted to prevent data loss.");
            // Keep whatever local additions we have, but do not truncate the cloud spreadsheet
            return true;
          }

          localStorage.setItem(KEYS.PRODUCTION, JSON.stringify(merged));
          saveLocalBackup(merged);
          return await GoogleSheetsService.saveData('saveProduction', merged);
        } else if (cloudRaw && Array.isArray(cloudRaw) && cloudRaw.length === 0 && cleaned.length > 0) {
          // Cloud was empty, safe to initialize
          return await GoogleSheetsService.saveData('saveProduction', cleaned);
        }
      } catch (err) {
        console.warn("Fetch before save failed:", err?.toString() || 'Network failure');
      }

      // If cloud was temporarily unreachable, DO NOT overwrite cloud with partial local data!
      // Local changes are safely stored in localStorage and rolling backup.
      return true;
    }
    return true;
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

  forceSyncWithSheets: async () => {
    if (!GoogleSheetsService.isEnabled()) return;
    try {
      localStorage.removeItem(KEYS.DELETED_IDS);
      const cloudRaw = await GoogleSheetsService.fetchData<any[]>('getProduction');
      if (cloudRaw && Array.isArray(cloudRaw)) {
        const cloudProduction = cloudRaw.map(normalizeProduction);
        const clean = deduplicateProductionEntries(cloudProduction);
        localStorage.setItem(KEYS.PRODUCTION, JSON.stringify(clean));
        saveLocalBackup(clean);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('halagel-data-updated'));
        }
      }
      await StorageService.syncWithSheets();
    } catch (e) {
      console.warn("Force sync error:", e);
    }
  },

  getLocalBackup: () => {
    try {
      const raw = localStorage.getItem(KEYS.BACKUP_LATEST);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  restoreFromBackup: () => {
    try {
      const backup = StorageService.getLocalBackup();
      if (backup && Array.isArray(backup.data) && backup.data.length > 0) {
        localStorage.setItem(KEYS.PRODUCTION, JSON.stringify(backup.data));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('halagel-data-updated'));
        }
        return true;
      }
    } catch {}
    return false;
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
        const merged = deduplicateProductionEntries(reconcileData(localProduction, cloudProduction, getDeletedIds()));
        localStorage.setItem(KEYS.PRODUCTION, JSON.stringify(merged));
        saveLocalBackup(merged);
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
