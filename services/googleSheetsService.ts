import { ProductionEntry, OffDay, User } from '../types';

/**
 * GOOGLE SHEETS CONFIGURATION
 * 
 * 1. To make the database work for EVERYONE, paste your URL below.
 * 2. IMPORTANT: Your Google Apps Script must be deployed as a "Web App" 
 *    with access set to "Anyone" (including anonymous).
 */
export const HARDCODED_URL = "https://script.google.com/macros/s/AKfycby89ZKqdlsZilyBVQHUT7DLrvKdmethDA_BnNeLYmEJlvzL0vQdMzQycB9PcTf-DGp_/exec"; // <-- REPLACE THIS WITH YOUR REAL URL

const getSheetUrl = () => {
  // 1. Priority: Manual override in current browser's localStorage
  const savedUrl = localStorage.getItem('halagel_sheets_api_url');
  if (savedUrl && savedUrl.startsWith('https://script.google.com') && !savedUrl.includes('EXAMPLE_URL')) {
    return savedUrl;
  }
  
  // 2. Fallback: The central URL defined in the code
  if (HARDCODED_URL && HARDCODED_URL.startsWith('https://script.google.com') && !HARDCODED_URL.includes('EXAMPLE_URL')) {
    return HARDCODED_URL;
  }
  
  return null;
};

export const GoogleSheetsService = {
  isEnabled: () => !!getSheetUrl(),
  
  getActiveUrl: () => getSheetUrl(),

  fetchData: async <T>(action: string): Promise<T | null> => {
    const url = getSheetUrl();
    if (!url) return null;

    try {
      // Use a timestamp and random seed to prevent aggressive caching
      const seed = Math.random().toString(36).substring(7);
      const response = await fetch(`${url}?action=${action}&_t=${Date.now()}&_s=${seed}`, {
        method: 'GET',
        mode: 'cors', // Explicitly use cors for GET
        credentials: 'omit'
      });
      
      if (!response.ok) {
        console.warn(`Sheets API returned status: ${response.status}`);
        return null;
      }
      
      return await response.json();
    } catch (error) {
      // "Failed to fetch" usually means the URL is invalid, the script is not deployed to "Anyone",
      // or there's a CORS issue.
      console.error(`Google Sheets Connection Error (${action}):`, error);
      return null;
    }
  },

  saveData: async (action: string, payload: any): Promise<boolean> => {
    const url = getSheetUrl();
    if (!url) return false;

    try {
      /**
       * Note: Google Apps Script Web Apps handle POST requests but browser CORS 
       * policies can be strict. Sending as 'text/plain' bypasses preflight checks 
       * while still allowing us to send JSON. Your script's doPost(e) should 
       * use JSON.parse(e.postData.contents).
       */
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors', // Use no-cors to avoid preflight issues with Google Script redirects
        headers: {
          'Content-Type': 'text/plain', // Use text/plain to avoid preflight
        },
        body: JSON.stringify({ 
          action, 
          data: payload, 
          timestamp: Date.now() 
        })
      });
      return true;
    } catch (error) {
      console.error(`Google Sheets Save Error (${action}):`, error);
      return false;
    }
  }
};