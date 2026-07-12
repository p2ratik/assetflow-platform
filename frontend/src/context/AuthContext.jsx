import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('assetflow_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('assetflow_token'));
  const [loading, setLoading] = useState(true);

  // Validate token on mount
  useEffect(() => {
    async function validate() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await client.get('/auth/me');
        setUser(res.data);
        localStorage.setItem('assetflow_user', JSON.stringify(res.data));
      } catch {
        setToken(null);
        setUser(null);
        localStorage.removeItem('assetflow_token');
        localStorage.removeItem('assetflow_user');
      } finally {
        setLoading(false);
      }
    }
    validate();
  }, [token]);

  const _persist = (access_token, userData) => {
    setToken(access_token);
    setUser(userData);
    localStorage.setItem('assetflow_token', access_token);
    localStorage.setItem('assetflow_user', JSON.stringify(userData));
  };

  const login = useCallback(async (email, password) => {
    const res = await client.post('/auth/login', { email, password });
    const { access_token, user: userData } = res.data;
    _persist(access_token, userData);
    return userData;
  }, []);

  const signup = useCallback(async (name, email, password, departmentId) => {
    const res = await client.post('/auth/signup', {
      name, email, password,
      department_id: departmentId || null,
    });
    const { access_token, user: userData } = res.data;
    _persist(access_token, userData);
    return userData;
  }, []);

  // First-run only: creates admin account — returns 409 if admin already exists
  const setupAdmin = useCallback(async (name, email, password) => {
    const res = await client.post('/auth/setup', { name, email, password });
    const { access_token, user: userData } = res.data;
    _persist(access_token, userData);
    return userData;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('assetflow_token');
    localStorage.removeItem('assetflow_user');
  }, []);

  const value = {
    user,
    token,
    role: user?.role || null,
    isAuthenticated: !!user && !!token,
    loading,
    login,
    signup,
    setupAdmin,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export default AuthContext;
