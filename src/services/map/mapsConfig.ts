/**
 * Centralized Google Maps configuration and runtime resolution helper.
 * Ensures consistent Google Maps API key & Map ID access across Vite Web,
 * Capacitor Android APK runtime, and window/localStorage overrides.
 */

// Fallback Google Maps API Key provisioned for this application
const EMBEDDED_GOOGLE_MAPS_KEY = 'AIzaSyDbdfuBJ-enovDoxL-HyglYn_91nbK9wnA';

const cleanValue = (val: unknown): string => {
  if (!val || typeof val !== 'string') return '';
  return val.replace(/^["']|["']$/g, '').trim();
};

/**
 * Resolves the Google Maps JavaScript API key across all runtime environments:
 * 1. Window-level runtime override (Capacitor Android native injections)
 * 2. LocalStorage override
 * 3. Android-specific environment variable (VITE_GOOGLE_MAPS_API_KEY_ANDROID)
 * 4. Standard environment variable (VITE_GOOGLE_MAPS_API_KEY)
 * 5. Built-in embedded fallback key
 */
export const getGoogleMapsApiKey = (): string => {
  if (typeof window !== 'undefined') {
    const win = window as any;
    const winKey = cleanValue(win.GOOGLE_MAPS_API_KEY || win.VITE_GOOGLE_MAPS_API_KEY || win.GMP_API_KEY);
    if (winKey.startsWith('AIzaSy') && winKey.length > 20) {
      return winKey;
    }

    try {
      const storedKey = cleanValue(
        localStorage.getItem('VITE_GOOGLE_MAPS_API_KEY') || localStorage.getItem('GOOGLE_MAPS_API_KEY')
      );
      if (storedKey.startsWith('AIzaSy') && storedKey.length > 20) {
        return storedKey;
      }
    } catch {
      // localStorage may fail in restricted webviews
    }
  }

  const androidKey = cleanValue(import.meta.env.VITE_GOOGLE_MAPS_API_KEY_ANDROID);
  if (androidKey.startsWith('AIzaSy') && androidKey.length > 20) {
    return androidKey;
  }

  const standardKey = cleanValue(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
  if (standardKey.startsWith('AIzaSy') && standardKey.length > 20) {
    return standardKey;
  }

  return EMBEDDED_GOOGLE_MAPS_KEY;
};

/**
 * Resolves the Google Maps Vector Map ID across environments.
 */
export const getGoogleMapsMapId = (): string => {
  if (typeof window !== 'undefined') {
    const win = window as any;
    const winMapId = cleanValue(win.GOOGLE_MAPS_MAP_ID || win.VITE_GOOGLE_MAPS_MAP_ID);
    if (winMapId) return winMapId;
  }

  const envMapId = cleanValue(import.meta.env.VITE_GOOGLE_MAPS_MAP_ID);
  return envMapId || 'DEMO_MAP_ID';
};

/**
 * Checks if a valid Google Maps API Key is available.
 */
export const hasValidGoogleMapsKey = (): boolean => {
  const key = getGoogleMapsApiKey();
  return key.startsWith('AIzaSy') && key.length > 20;
};
