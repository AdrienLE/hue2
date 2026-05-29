import { createAuthStorage } from '@/auth/storage';

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = { ...initial };
  const calls = {
    setItem: [] as Array<[string, string]>,
    removeItem: [] as string[],
  };

  return {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => {
      calls.setItem.push([key, value]);
      values[key] = value;
    },
    removeItem: (key: string) => {
      calls.removeItem.push(key);
      delete values[key];
    },
    values,
    calls,
  };
}

describe('auth storage', () => {
  it('persists web tokens in localStorage', async () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage({ auth_access_token: 'old-session-token' });
    const storage = createAuthStorage({
      platformOS: 'web',
      getWindow: () => ({ localStorage, sessionStorage }),
    });

    await storage.setItem('auth_access_token', 'fresh-token');

    expect(localStorage.calls.setItem).toEqual([['auth_access_token', 'fresh-token']]);
    expect(sessionStorage.calls.removeItem).toEqual(['auth_access_token']);
    expect(await storage.getItem('auth_access_token')).toBe('fresh-token');
  });

  it('migrates existing web session tokens to localStorage', async () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage({ auth_refresh_token: 'session-refresh' });
    const storage = createAuthStorage({
      platformOS: 'web',
      getWindow: () => ({ localStorage, sessionStorage }),
    });

    await expect(storage.getItem('auth_refresh_token')).resolves.toBe('session-refresh');

    expect(localStorage.calls.setItem).toEqual([['auth_refresh_token', 'session-refresh']]);
    expect(sessionStorage.calls.removeItem).toEqual(['auth_refresh_token']);
  });

  it('falls back to SecureStore outside web', async () => {
    const secureStoreCalls = {
      setItemAsync: [] as Array<[string, string]>,
      deleteItemAsync: [] as string[],
    };
    const secureStore = {
      getItemAsync: async () => 'native-token',
      setItemAsync: async (key: string, value: string) => {
        secureStoreCalls.setItemAsync.push([key, value]);
      },
      deleteItemAsync: async (key: string) => {
        secureStoreCalls.deleteItemAsync.push(key);
      },
    };
    const storage = createAuthStorage({ platformOS: 'ios', secureStore });

    await expect(storage.getItem('auth_access_token')).resolves.toBe('native-token');
    await storage.setItem('auth_access_token', 'next-token');
    await storage.removeItem('auth_access_token');

    expect(secureStoreCalls.setItemAsync).toEqual([['auth_access_token', 'next-token']]);
    expect(secureStoreCalls.deleteItemAsync).toEqual(['auth_access_token']);
  });
});
