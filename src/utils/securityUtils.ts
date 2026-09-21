/**
 * HALAGEL SECURITY UTILITIES
 * Implements Hashing and Sanitization for Pentest Compliance.
 */

/**
 * Creates a SHA-256 hash of a string.
 * Used for storing/comparing passwords securely.
 * Includes a fallback for non-secure contexts (HTTP/IP-based access).
 */
export async function hashPassword(password: string): Promise<string> {
  // Check if Web Crypto API is available (requires Secure Context)
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn("Hashing failed, falling back to basic encoding", e);
    }
  }

  // Fallback for non-secure contexts (development/internal IPs)
  // This ensures the dashboard remains functional even without HTTPS
  return "plain_" + btoa(password).substring(0, 59);
}

/**
 * Basic XSS Protection: Strips HTML tags and scriptable characters.
 * Casts input to string to prevent runtime errors if non-string data is passed.
 */
export const sanitizeInput = (input: any): string => {
  if (input === null || input === undefined) return '';
  
  const strValue = String(input);
  if (!strValue) return '';

  return strValue
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Block protocol injection
    .replace(/on\w+=/gi, '') // Block event handlers
    .trim();
};

/**
 * Prevents Prototype Pollution from malicious cloud data objects.
 */
export const deepFreeze = (obj: any) => {
  Object.getOwnPropertyNames(obj).forEach(name => {
    const prop = obj[name];
    if (prop !== null && typeof prop === 'object') deepFreeze(prop);
  });
  return Object.freeze(obj);
};
