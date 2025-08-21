import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest, ResponseType } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import jwtDecode from 'jwt-decode';

// Close the Auth0 popup on web if a redirect back to the app occurred
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

const discovery = {
  authorizationEndpoint: `https://${process.env.EXPO_PUBLIC_AUTH0_DOMAIN}/authorize`,
  tokenEndpoint: `https://${process.env.EXPO_PUBLIC_AUTH0_DOMAIN}/oauth/token`,
  revocationEndpoint: `https://${process.env.EXPO_PUBLIC_AUTH0_DOMAIN}/oauth/revoke`,
};

const TOKEN_KEY = 'auth_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const useProxy = Platform.select({ web: false, default: true });
  const redirectUri = Platform.select({
    web: makeRedirectUri({ useProxy: false }), // Uses current web URL
    default: makeRedirectUri({
      scheme: 'baseapp',
      useProxy,
      path: 'redirect',
    }), // Uses baseapp://redirect for mobile
  });

  useEffect(() => {
    console.log(`Auth redirect URI: ${redirectUri}`);
    console.log(`Auth useProxy: ${useProxy}`);
  }, [redirectUri, useProxy]);

  // Load any stored token on start and handle Auth0 redirect
  useEffect(() => {
    const loadToken = async () => {
      try {
        // On web, check for Auth0 redirect token in URL hash
        if (Platform.OS === 'web' && window.location.hash.includes('access_token=')) {
          const params = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = params.get('access_token');

          if (accessToken) {
            console.log('Found access token in URL hash');
            setTokenState(accessToken);
            await AsyncStorage.setItem(TOKEN_KEY, accessToken);

            // Clean up the URL hash
            window.history.replaceState({}, document.title, window.location.pathname);
            setLoading(false);
            return;
          }
        }

        // Otherwise, load from stored token
        const stored = await AsyncStorage.getItem(TOKEN_KEY);
        if (stored) {
          try {
            const payload: { exp?: number } = jwtDecode(stored);
            if (!payload.exp || payload.exp * 1000 > Date.now()) {
              setTokenState(stored);
            } else {
              // Token is expired - clear it completely
              console.log('Token expired, clearing authentication');
              await AsyncStorage.removeItem(TOKEN_KEY);
              setTokenState(null); // Clear the state too!
            }
          } catch {
            // Invalid token - clear it completely
            console.log('Invalid token, clearing authentication');
            await AsyncStorage.removeItem(TOKEN_KEY);
            setTokenState(null); // Clear the state too!
          }
        }
      } catch (e) {
        console.warn('Failed to load token', e);
      } finally {
        setLoading(false);
      }
    };
    loadToken();
  }, []);

  // Listen for auth expired events from API calls
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleAuthExpired = () => {
        console.log('Auth expired event received - clearing authentication');
        setTokenState(null);
        AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
      };

      window.addEventListener('auth-expired', handleAuthExpired);
      return () => {
        window.removeEventListener('auth-expired', handleAuthExpired);
      };
    }
  }, []);

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID ?? '',
      scopes: ['openid', 'profile', 'email'],
      responseType: ResponseType.Token,
      redirectUri,
      extraParams: {
        audience: process.env.EXPO_PUBLIC_AUTH0_AUDIENCE ?? '',
      },
    },
    discovery
  );

  useEffect(() => {
    if (response?.type === 'success') {
      const newToken = response.params.access_token;
      setTokenState(newToken);
      AsyncStorage.setItem(TOKEN_KEY, newToken).catch(() => {});
    }
  }, [response]);

  const login = () => {
    console.log(`Starting login with redirectUri=${redirectUri}, useProxy=${useProxy}`);

    // On web, redirect directly to Auth0 (no popup)
    if (Platform.OS === 'web') {
      const auth0Domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN;
      const clientId = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID;
      const audience = process.env.EXPO_PUBLIC_AUTH0_AUDIENCE;

      const loginUrl =
        `https://${auth0Domain}/authorize?` +
        new URLSearchParams({
          response_type: 'token',
          client_id: clientId ?? '',
          redirect_uri: redirectUri,
          scope: 'openid profile email',
          audience: audience ?? '',
        }).toString();

      window.location.href = loginUrl;
      return;
    }

    // On mobile, use the existing popup approach
    promptAsync({ useProxy });
  };

  // Simple token validation - just checks if expired
  const validateToken = async (): Promise<boolean> => {
    if (!tokenState) return false;

    try {
      const payload: { exp?: number } = jwtDecode(tokenState);
      const now = Date.now() / 1000;
      return payload.exp ? payload.exp > now : true;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    // Clear local token first
    setTokenState(null);
    AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});

    // Construct Auth0 logout URL to clear Auth0 session
    const auth0Domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN;
    // Redirect to home page after logout
    const returnTo = Platform.select({
      web: encodeURIComponent(`${window.location.origin}/`),
      default: encodeURIComponent(redirectUri),
    });
    const logoutUrl = `https://${auth0Domain}/v2/logout?client_id=${process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID}&returnTo=${returnTo}`;

    // On web, redirect directly to Auth0 logout (no popup)
    if (Platform.OS === 'web') {
      window.location.href = logoutUrl;
      return;
    }

    // On mobile, use WebBrowser for logout
    try {
      await WebBrowser.openAuthSessionAsync(logoutUrl, redirectUri);
    } catch (error) {
      console.warn('Logout session failed, but local token cleared:', error);
    }

    // Navigate to home page (mobile only, web will redirect via Auth0)
    router.replace('/');
  };

  return (
    <AuthContext.Provider value={{ token, loading, login, logout, validateToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
