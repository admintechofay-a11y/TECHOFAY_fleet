import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest, setAccessToken } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initial Auth Check on Mount
  useEffect(() => {
    async function initAuth() {
      try {
        const res = await apiRequest('/auth/me');
        if (res && res.data) {
          setUser(res.data.user);
          setTenant(res.data.tenant);
        }
      } catch (err) {
        // Not authenticated
        setUser(null);
        setTenant(null);
      } finally {
        setIsLoading(false);
      }
    }
    initAuth();
  }, []);

  const login = async (email, password) => {
    setError(null);
    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (res && res.data) {
        setAccessToken(res.data.accessToken);
        setUser(res.data.user);
        // Fetch full profile with tenant
        const meRes = await apiRequest('/auth/me');
        if (meRes && meRes.data) {
          setTenant(meRes.data.tenant);
        }
        return res.data.user;
      }
    } catch (err) {
      setError(err.message || 'Login failed');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore logout errors
    } finally {
      setAccessToken(null);
      setUser(null);
      setTenant(null);
    }
  };

  const hasPermission = (module, action) => {
    if (!user || !user.roleId) return false;
    const role = user.roleId;
    if (role.slug === 'super_admin') return true;

    if (!role.permissions || !Array.isArray(role.permissions)) return false;
    const rule = role.permissions.find((p) => p.module === module);
    if (!rule) return false;

    return rule.actions.includes(action) || rule.actions.includes('admin');
  };

  const isSuperAdmin = () => {
    return user && user.roleId && user.roleId.slug === 'super_admin';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        isLoading,
        error,
        isAuthenticated: !!user,
        login,
        logout,
        hasPermission,
        isSuperAdmin
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
