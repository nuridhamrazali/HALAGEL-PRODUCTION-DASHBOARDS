
/**
 * HALAGEL DATE UTILITIES
 * Strictly enforces Malaysia Time (UTC+8) to prevent the "Yesterday Bug".
 */

import { OffDayType } from "../types";

/**
 * Returns YYYY-MM-DD based on Malaysia Timezone.
 * Safe for use in <input type="date">
 */
export const getTodayISO = (): string => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
};

/**
 * Helper to convert YYYY-MM-DD to DD-MM-YYYY for display
 */
export const formatDateToDMY = (dateStr: string): string => {
  if (!dateStr) return '';
  const clean = dateStr.split(' ')[0];
  const parts = clean.split('-');
  if (parts.length !== 3) return clean;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

/**
 * Helper to convert YYYY-MM-DD to DD/MM/YYYY for input/display
 */
export const formatDateToDMYSlash = (dateStr: string): string => {
  if (!dateStr) return '';
  const clean = dateStr.split(' ')[0].split('T')[0];
  const parts = clean.split('-');
  if (parts.length !== 3) return clean;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

/**
 * Parse DD/MM/YYYY or DD-MM-YYYY string to YYYY-MM-DD (ISO)
 */
export const parseDMYToISO = (dmyStr: string): string | null => {
  if (!dmyStr) return null;
  const clean = dmyStr.trim();
  const parts = clean.includes('/') ? clean.split('/') : clean.split('-');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;

  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
};

/**
 * Checks if a given date string is a weekly rest day (Friday or Saturday).
 */
export const isWeeklyRestDay = (dateStr: string): boolean => {
  const parts = dateStr.split(' ')[0].split('-');
  if (parts.length !== 3) return false;
  // Use UTC-8 relative date construction
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  const day = d.getDay();
  return day === 5 || day === 6;
};

/**
 * Returns the automatic type for a day of the week.
 * Friday = Rest Day, Saturday = Off Day.
 */
export const getWeeklyOffDayType = (dateStr: string): OffDayType | null => {
  const parts = dateStr.split(' ')[0].split('-');
  if (parts.length !== 3) return null;
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  const day = d.getDay();
  if (day === 5) return 'Off Day';
  if (day === 6) return 'Rest Day';
  return null;
};

/**
 * Returns YYYY-MM based on Malaysia Timezone.
 */
export const getCurrentMonthISO = (): string => {
  return getTodayISO().substring(0, 7);
};

/**
 * Returns the current date and time in the format YYYY-MM-DD HH:mm:ss
 * tailored for database/sheet storage.
 */
export const getDbTimestamp = (): string => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const find = (type: string) => parts.find(p => p.type === type)?.value;
  
  return `${find('year')}-${find('month')}-${find('day')} ${find('hour')}:${find('minute')}:${find('second')}`;
};

/**
 * Formats ISO or DB timestamp string to DD-MM-YYYY HH:mm:ss in Malaysia Time.
 */
export const formatFullTimestamp = (isoStr: string): string => {
  if (!isoStr) return '';
  
  const date = new Date(isoStr.includes(' ') ? isoStr.replace(' ', 'T') : isoStr);
  if (isNaN(date.getTime())) return isoStr;
  
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const find = (type: string) => parts.find(p => p.type === type)?.value;
  
  return `${find('day')}-${find('month')}-${find('year')} ${find('hour')}:${find('minute')}:${find('second')}`;
};

/**
 * Formats YYYY-MM-DD for display (e.g., "28-12-2025 SUNDAY").
 */
export const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return 'Invalid Date';

  const cleanDate = dateStr.split(' ')[0].split('T')[0];
  const parts = cleanDate.split('-');
  
  if (parts.length !== 3) return cleanDate;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  
  const localDate = new Date(year, month - 1, day, 12, 0, 0);
  
  if (isNaN(localDate.getTime())) return cleanDate;

  const dayName = new Intl.DateTimeFormat('en-MY', { 
    weekday: 'long', 
    timeZone: 'Asia/Kuala_Lumpur' 
  }).format(localDate).toUpperCase();
  
  return `${day.toString().padStart(2, '0')}-${month.toString().padStart(2, '0')}-${year} ${dayName}`;
};

/**
 * Validates if a string is a valid YYYY-MM-DD format
 */
export const isValidISODate = (dateStr: string): boolean => {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
};
