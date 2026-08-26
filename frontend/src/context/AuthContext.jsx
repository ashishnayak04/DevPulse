import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(localStorage.getItem('accessToken'));
  const [loading, setLoading] = useState(true);

  const decodeUserFromToken = (token) => {
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return { id: decoded.id, email: decoded.email, username: decoded.username, role: decoded.role, plan: decoded.plan };
    } catch (e) {
      return null;
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        const decodedUser = decodeUserFromToken(token);
        if (decodedUser) {
          setUser(decodedUser);
          setAccessToken(token);
          // Fetch the full profile so fields like onboardingCompleted / totpEnabled
          // (not stored in the JWT) are available to the app.
          try {
            const data = await api.get('/auth/me');
            if (data?.user) setUser(data.user);
          } catch (e) {
            /* keep decoded fallback */
          }
        } else {
          localStorage.removeItem('accessToken');
          setAccessToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const refreshUser = async () => {
    try {
      const data = await api.get('/auth/me');
      if (data?.user) {
        setUser(data.user);
        return data.user;
      }
    } catch (e) {
      /* ignore */
    }
    return null;
  };

  const updateUser = (patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    localStorage.setItem('accessToken', data.accessToken);
    setAccessToken(data.accessToken);
    setUser(data.user);
  };

  const register = async (email, username, password) => {
    const data = await api.post('/auth/register', { email, username, password });
    localStorage.setItem('accessToken', data.accessToken);
    setAccessToken(data.accessToken);
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      console.error('Logout failed:', e);
    } finally {
      localStorage.removeItem('accessToken');
      setAccessToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      accessToken,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'ADMIN',
      loading,
      login,
      register,
      logout,
      refreshUser,
      updateUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
