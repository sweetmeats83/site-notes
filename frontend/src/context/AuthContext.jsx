import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '../api/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = still checking, null = not logged in, object = logged in
  const [user, setUser] = useState(undefined);

  // Check session on mount
  useEffect(() => {
    authApi.me()
      .then(u => setUser(u))
      .catch(() => setUser(null));
  }, []);

  // Any API call that returns 401 dispatches this event
  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, []);

  const login = useCallback(async (password) => {
    const u = await authApi.login(password);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
