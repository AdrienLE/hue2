import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

type WebStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type WebWindow = {
  localStorage?: WebStorage;
  sessionStorage?: WebStorage;
};
type SecureStoreAdapter = Pick<
  typeof SecureStore,
  'getItemAsync' | 'setItemAsync' | 'deleteItemAsync'
>;

type AuthStorageOptions = {
  platformOS?: string;
  getWindow?: () => WebWindow | undefined;
  secureStore?: SecureStoreAdapter;
};

export type AuthStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const defaultGetWindow = () => (typeof window === 'undefined' ? undefined : window);

function getSafeStorage(
  getWindow: () => WebWindow | undefined,
  storageKey: 'localStorage' | 'sessionStorage'
): WebStorage | null {
  try {
    return getWindow()?.[storageKey] ?? null;
  } catch {
    return null;
  }
}

function safeGet(storage: WebStorage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(storage: WebStorage | null, key: string, value: string): boolean {
  try {
    storage?.setItem(key, value);
    return Boolean(storage);
  } catch {
    return false;
  }
}

function safeRemove(storage: WebStorage | null, key: string) {
  try {
    storage?.removeItem(key);
  } catch {}
}

export function createAuthStorage({
  platformOS = Platform.OS,
  getWindow = defaultGetWindow,
  secureStore = SecureStore,
}: AuthStorageOptions = {}): AuthStorage {
  const isWeb = platformOS === 'web';

  return {
    async getItem(key: string): Promise<string | null> {
      if (!isWeb) {
        return secureStore.getItemAsync(key);
      }

      const localStorage = getSafeStorage(getWindow, 'localStorage');
      const localValue = safeGet(localStorage, key);
      if (localValue !== null) {
        return localValue;
      }

      const sessionStorage = getSafeStorage(getWindow, 'sessionStorage');
      const sessionValue = safeGet(sessionStorage, key);
      if (sessionValue !== null && safeSet(localStorage, key, sessionValue)) {
        safeRemove(sessionStorage, key);
      }

      return sessionValue;
    },

    async setItem(key: string, value: string): Promise<void> {
      if (!isWeb) {
        await secureStore.setItemAsync(key, value);
        return;
      }

      const localStorage = getSafeStorage(getWindow, 'localStorage');
      const sessionStorage = getSafeStorage(getWindow, 'sessionStorage');
      if (safeSet(localStorage, key, value)) {
        safeRemove(sessionStorage, key);
        return;
      }

      safeSet(sessionStorage, key, value);
    },

    async removeItem(key: string): Promise<void> {
      if (!isWeb) {
        await secureStore.deleteItemAsync(key);
        return;
      }

      safeRemove(getSafeStorage(getWindow, 'localStorage'), key);
      safeRemove(getSafeStorage(getWindow, 'sessionStorage'), key);
    },
  };
}

export const authStorage = createAuthStorage();
