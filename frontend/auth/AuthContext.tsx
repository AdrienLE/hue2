import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import {
  exchangeCodeAsync,
  makeRedirectUri,
  refreshAsync,
  ResponseType,
  revokeAsync,
  TokenTypeHint,
  useAuthRequest,
} from 'expo-auth-session';
import { useRouter } from 'expo-router';
import jwtDecode from 'jwt-decode';
import { APP_CONFIG } from '@/lib/config';
import { clearWidgetAuthContext, syncWidgetAuthContext } from '@/lib/widgetBridge';

// Close the Auth0 popup on web if a redirect back to the app occurred.
WebBrowser.maybeCompleteAuthSession();

interface AuthContextValue {
  token: string | null;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  validateToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  loading: true,
  login: () => {},
  logout: async () => {},
  validateToken: async () => false,
});

const AUTH0_DOMAIN = process.env.EXPO_PUBLIC_AUTH0_DOMAIN ?? '';
const AUTH0_CLIENT_ID = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID ?? '';
const AUTH0_AUDIENCE = process.env.EXPO_PUBLIC_AUTH0_AUDIENCE ?? '';
const AUTH_SCOPES = ['openid', 'profile', 'email', 'offline_access'];

const discovery = {
  authorizationEndpoint: `https://${AUTH0_DOMAIN}/authorize`,
  tokenEndpoint: `https://${AUTH0_DOMAIN}/oauth/token`,
  revocationEndpoint: `https://${AUTH0_DOMAIN}/oauth/revoke`,
};

const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const EXPIRES_AT_KEY = 'auth_expires_at';
const LEGACY_TOKEN_KEY = 'auth_token';
const REFRESH_MARGIN_MS = 60 * 1000;
const AUTH_OVERRIDE_TOKEN = __DEV__ ? process.env.EXPO_PUBLIC_AUTH_OVERRIDE_TOKEN : undefined;

// Must match expo.scheme in app.config.ts and Auth0 native callback/logout URLs.
const URL_SCHEME = process.env.EXPO_PUBLIC_URL_SCHEME || 'hue2';

type RedirectUriOptionsWithProxy = NonNullable<Parameters<typeof makeRedirectUri>[0]> & {
  useProxy?: boolean;
};

type StoredAuth = {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
};

const makeRedirectUriWithProxy = (options: RedirectUriOptionsWithProxy) =>
  makeRedirectUri(options as unknown as Parameters<typeof makeRedirectUri>[0]);

const hasWindowStorage = () => Platform.OS === 'web' && typeof window !== 'undefined';

const authStorage = {
  async getItem(key: string): Promise<string | null> {
    if (hasWindowStorage()) {
      return window.sessionStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (hasWindowStorage()) {
      window.sessionStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (hasWindowStorage()) {
      window.sessionStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

const readStoredAuth = async (): Promise<StoredAuth> => {
  const [accessToken, refreshToken, expiresAtRaw] = await Promise.all([
    authStorage.getItem(ACCESS_TOKEN_KEY),
    authStorage.getItem(REFRESH_TOKEN_KEY),
    authStorage.getItem(EXPIRES_AT_KEY),
  ]);
  const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : null;

  return {
    accessToken,
    refreshToken,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
  };
};

const removeStoredAuth = async () => {
  await Promise.all([
    authStorage.removeItem(ACCESS_TOKEN_KEY),
    authStorage.removeItem(REFRESH_TOKEN_KEY),
    authStorage.removeItem(EXPIRES_AT_KEY),
    authStorage.removeItem(LEGACY_TOKEN_KEY),
    clearWidgetAuthContext(),
  ]);
};

const isAccessTokenFresh = (accessToken: string, expiresAt?: number | null): boolean => {
  if (expiresAt) {
    return expiresAt - REFRESH_MARGIN_MS > Date.now();
  }

  try {
    const payload: { exp?: number } = jwtDecode(accessToken);
    return payload.exp ? payload.exp * 1000 - REFRESH_MARGIN_MS > Date.now() : true;
  } catch {
    return false;
  }
};

const authExtraParams = AUTH0_AUDIENCE ? { audience: AUTH0_AUDIENCE } : undefined;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  // Allow override via env; default to native deep links on iOS/Android.
  const authUseProxyEnv = process.env.EXPO_PUBLIC_AUTH_USE_PROXY;
  const forcedUseProxy =
    authUseProxyEnv === 'true' ? true : authUseProxyEnv === 'false' ? false : undefined;
  const useProxy = Platform.select({ web: false, default: forcedUseProxy ?? false });
  const redirectUriWeb = makeRedirectUriWithProxy({ useProxy: false });
  const redirectUriProxy = makeRedirectUriWithProxy({
    scheme: URL_SCHEME,
    useProxy: true,
    path: 'redirect',
  });
  const redirectUriNative = makeRedirectUriWithProxy({
    scheme: URL_SCHEME,
    useProxy: false,
    path: 'redirect',
  });
  const redirectUri =
    Platform.select({
      web: redirectUriWeb,
      default: useProxy ? redirectUriProxy : redirectUriNative,
    }) ?? redirectUriNative;

  const persistTokens = async (
    accessToken: string,
    refreshToken?: string | null,
    expiresAt?: number | null
  ) => {
    await authStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      await authStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    if (expiresAt) {
      await authStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
    } else {
      await authStorage.removeItem(EXPIRES_AT_KEY);
    }
    await authStorage.removeItem(LEGACY_TOKEN_KEY);
    await syncWidgetAuthContext(accessToken, APP_CONFIG.api.baseUrl);
  };

  const refreshAccessToken = async (): Promise<string | null> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    refreshPromiseRef.current = (async () => {
      const stored = await readStoredAuth();
      if (!stored.refreshToken) {
        await removeStoredAuth();
        setTokenState(null);
        return null;
      }

      try {
        const tokenResponse = await refreshAsync(
          {
            clientId: AUTH0_CLIENT_ID,
            refreshToken: stored.refreshToken,
          },
          discovery
        );
        const refreshedAccessToken = tokenResponse.accessToken;
        const refreshedRefreshToken = tokenResponse.refreshToken ?? stored.refreshToken;
        const expiresAt = tokenResponse.expiresIn
          ? (tokenResponse.issuedAt + tokenResponse.expiresIn) * 1000
          : null;

        await persistTokens(refreshedAccessToken, refreshedRefreshToken, expiresAt);
        setTokenState(refreshedAccessToken);
        return refreshedAccessToken;
      } catch (error) {
        console.warn('Failed to refresh Auth0 token', error);
        await removeStoredAuth();
        setTokenState(null);
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  };

  useEffect(() => {
    const loadToken = async () => {
      try {
        if (AUTH_OVERRIDE_TOKEN) {
          await syncWidgetAuthContext(AUTH_OVERRIDE_TOKEN, APP_CONFIG.api.baseUrl);
          setTokenState(AUTH_OVERRIDE_TOKEN);
          return;
        }

        const stored = await readStoredAuth();

        if (stored.accessToken && isAccessTokenFresh(stored.accessToken, stored.expiresAt)) {
          await syncWidgetAuthContext(stored.accessToken, APP_CONFIG.api.baseUrl);
          setTokenState(stored.accessToken);
          return;
        }

        if (stored.refreshToken) {
          await refreshAccessToken();
          return;
        }

        await removeStoredAuth();
        setTokenState(null);
      } catch (error) {
        console.warn('Failed to load Auth0 tokens', error);
        await removeStoredAuth();
        setTokenState(null);
      } finally {
        setLoading(false);
      }
    };

    loadToken();
  }, []);

  // Listen for auth expired events from API calls and refresh once before logging out locally.
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;

    const handleAuthExpired = () => {
      refreshAccessToken().catch(() => {});
    };

    window.addEventListener('auth-expired', handleAuthExpired);
    return () => {
      window.removeEventListener('auth-expired', handleAuthExpired);
    };
  }, []);

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: AUTH0_CLIENT_ID,
      scopes: AUTH_SCOPES,
      responseType: ResponseType.Code,
      redirectUri,
      usePKCE: true,
      extraParams: authExtraParams,
    },
    discovery
  );

  useEffect(() => {
    let cancelled = false;

    const exchangeCode = async () => {
      if (response?.type !== 'success') return;

      const code = response.params.code;
      const codeVerifier = request?.codeVerifier;
      if (!code || !codeVerifier) {
        console.warn('Auth0 code response did not include a usable PKCE verifier');
        return;
      }

      try {
        const tokenResponse = await exchangeCodeAsync(
          {
            clientId: AUTH0_CLIENT_ID,
            code,
            redirectUri,
            extraParams: {
              code_verifier: codeVerifier,
            },
          },
          discovery
        );
        const accessToken = tokenResponse.accessToken;
        const expiresAt = tokenResponse.expiresIn
          ? (tokenResponse.issuedAt + tokenResponse.expiresIn) * 1000
          : null;

        await persistTokens(accessToken, tokenResponse.refreshToken, expiresAt);

        if (!cancelled) {
          setTokenState(accessToken);
        }
      } catch (error) {
        console.warn('Failed to exchange Auth0 authorization code', error);
        await removeStoredAuth();
        if (!cancelled) {
          setTokenState(null);
        }
      }
    };

    exchangeCode();
    return () => {
      cancelled = true;
    };
  }, [response, request, redirectUri]);

  const login = () => {
    promptAsync({
      useProxy,
      preferEphemeralSession: false,
    } as unknown as Parameters<typeof promptAsync>[0]).catch(error => {
      console.warn('Auth0 login failed', error);
    });
  };

  const validateToken = async (): Promise<boolean> => {
    if (AUTH_OVERRIDE_TOKEN && token === AUTH_OVERRIDE_TOKEN) {
      return true;
    }

    if (token && isAccessTokenFresh(token)) {
      return true;
    }

    const refreshedToken = await refreshAccessToken();
    return Boolean(refreshedToken);
  };

  const logout = async () => {
    const storedRefreshToken = await authStorage.getItem(REFRESH_TOKEN_KEY);

    setTokenState(null);
    await removeStoredAuth();

    if (storedRefreshToken) {
      try {
        await revokeAsync(
          {
            clientId: AUTH0_CLIENT_ID,
            token: storedRefreshToken,
            tokenTypeHint: TokenTypeHint.RefreshToken,
          },
          discovery
        );
      } catch (error) {
        console.warn('Refresh token revoke failed; continuing logout', error);
      }
    }

    const returnTo =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? `${window.location.origin}/`
        : redirectUriNative;
    const logoutUrl =
      `https://${AUTH0_DOMAIN}/v2/logout?` +
      new URLSearchParams({
        client_id: AUTH0_CLIENT_ID,
        returnTo,
      }).toString();

    if (Platform.OS === 'web') {
      window.location.href = logoutUrl;
      return;
    }

    try {
      await WebBrowser.openAuthSessionAsync(logoutUrl, redirectUriNative);
    } catch (error) {
      console.warn('Logout session failed, but local tokens were cleared:', error);
    }

    router.replace('/');
  };

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && !token) {
        refreshAccessToken().catch(() => {});
      }
    });

    return () => subscription.remove();
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, loading, login, logout, validateToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
