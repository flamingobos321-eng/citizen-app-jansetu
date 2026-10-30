import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { apiRequest, ApiError, type Citizen } from '@/lib/api';
import { unregisterPushTokenOnSignOut } from '@/lib/pushNotifications';

const TOKEN_KEY = 'jansetu_token';

async function readToken() {
  return Platform.OS === 'web'
    ? AsyncStorage.getItem(TOKEN_KEY)
    : SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getStoredAuthToken() {
  return readToken();
}

async function writeToken(token: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

async function removeToken() {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

type AuthContextValue = {
  user: Citizen | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  signIn: (token: string, user: Citizen) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [user, setUser] = useState<Citizen | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const savedToken = await readToken();
      if (!savedToken) {
        setToken(null);
        setUser(null);
        return;
      }
      setToken(savedToken);
      const currentUser = await apiRequest<Citizen>('/auth/me', {
        token: savedToken,
      });
      setUser(currentUser);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await removeToken();
        setToken(null);
        setUser(null);
      } else {
        setError(err instanceof Error ? err.message : 'Could not verify your session.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const signIn = useCallback(async (newToken: string, newUser: Citizen) => {
    await writeToken(newToken);
    setToken(newToken);
    setUser(newUser);
    setError(null);
  }, []);

  const signOut = useCallback(async () => {
    if (token && user?.id) {
      await unregisterPushTokenOnSignOut(user.id, token);
    }
    await removeToken();
    setToken(null);
    setUser(null);
    setError(null);
  }, [token, user?.id]);

  const value = useMemo(
    () => ({ user, token, loading, error, signIn, signOut, refreshSession }),
    [user, token, loading, error, signIn, signOut, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
