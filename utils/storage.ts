import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { encryptForWeb, decryptForWeb } from './encryption';

/**
 * Cross-platform key–value storage abstraction.
 *
 * Native (iOS/Android): expo-secure-store
 * Web: `window.localStorage` (falls back to AsyncStorage on server-side rendering)
 */

export interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem?(key: string): Promise<void>;
}

let storage: Storage;

if (Platform.OS === 'web') {
  storage = {
    async getItem(key: string) {
      try {
        if (typeof window !== 'undefined' && 'localStorage' in window) {
          return window.localStorage.getItem(key);
        }
        return await AsyncStorage.getItem(key);
      } catch {
        return null;
      }
    },
    async setItem(key: string, value: string) {
      try {
        if (typeof window !== 'undefined' && 'localStorage' in window) {
          window.localStorage.setItem(key, value);
        } else {
          await AsyncStorage.setItem(key, value);
        }
      } catch {
        /* noop */
      }
    },
    async deleteItem(key: string) {
      try {
        if (typeof window !== 'undefined' && 'localStorage' in window) {
          window.localStorage.removeItem(key);
        } else {
          await AsyncStorage.removeItem(key);
        }
      } catch {
        /* noop */
      }
    },
  };
} else {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const SecureStore = require('expo-secure-store');
  storage = {
    getItem: SecureStore.getItemAsync,
    setItem: SecureStore.setItemAsync,
    deleteItem: SecureStore.deleteItemAsync ?? (async (key: string) => {
      // Fallback for older versions that may not expose deleteItemAsync
      await SecureStore.setItemAsync(key, '');
    }),
  };
}

// Secure storage methods with encryption for sensitive data
export const getItem = (key: string) => storage.getItem(key);
export const setItem = (key: string, value: string) => storage.setItem(key, value);
export const deleteItem = (key: string) => storage.deleteItem?.(key);

// Special methods for API keys with encryption on web
export const getSecureItem = async (key: string): Promise<string | null> => {
  const value = await storage.getItem(key);
  if (!value) return null;
  
  // Decrypt on web platforms
  return await decryptForWeb(value);
};

export const setSecureItem = async (key: string, value: string): Promise<void> => {
  // Encrypt on web platforms before storing
  const encryptedValue = await encryptForWeb(value);
  return storage.setItem(key, encryptedValue);
};

export default { getItem, setItem, deleteItem };
