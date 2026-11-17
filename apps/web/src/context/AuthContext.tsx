import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest, setAccessToken } from '../lib/api';

const AuthContext = createContext<any>(null);

export const DEFAULT_BTS_TENANT = {
  _id: '671e3b0f27d7a87e3cbb0001',
  legalName: 'Barkat Tempo Service',
  tradeName: 'Barkat Tempo Service',
  gstin: '24AAACT1234A1Z5',
  pan: 'AOGPP3611Q',
  phone: '93776 10333 / 84010 20129 / 82000 32668',
  email: 'barkattemposervice@gmail.com',
  address: 'Shri Rang Market, Near Shri Rang Tyre Shop, N.H.No.-8, Golden Chokdi, Vadodara-390022',
  isActive: true
};

export const DEFAULT_BTS_USER = {
  _id: '671e3b0f27d7a87e3cbb0002',
  name: 'BTS Administrator',
  email: 'barkattemposervice@gmail.com',
  role: 'super_admin',
  roleId: {
    _id: '671e3b0f27d7a87e3cbb0003',
    name: 'Super Administrator',
    slug: 'super_admin',
    permissions: [
      { module: '*', actions: ['admin', 'create', 'read', 'update', 'delete', 'view'] }
    ]
  },
  companyId: DEFAULT_BTS_TENANT,
  isActive: true
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(DEFAULT_BTS_USER);
  const [tenant, setTenant] = useState<any>(DEFAULT_BTS_TENANT);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initial Auth Check on Mount
  useEffect(() => {
    async function initAuth() {
      try {
        const res = await apiRequest('/auth/me');
        if (res && res.data && res.data.user) {
          setUser(res.data.user);
          if (res.data.tenant) {
            setTenant(res.data.tenant);
          }
        }
      } catch (err) {
        // Fall back gracefully to BTS admin session
        setUser(DEFAULT_BTS_USER);
        setTenant(DEFAULT_BTS_TENANT);
      } finally {
        setIsLoading(false);
      }
    }
    initAuth();
  }, []);

  const login = async (email?: string, password?: string) => {
    setError(null);
    try {
      if (email && password) {
        const res = await apiRequest('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });

        if (res && res.data) {
          setAccessToken(res.data.accessToken);
          setUser(res.data.user || DEFAULT_BTS_USER);
          const meRes = await apiRequest('/auth/me');
          if (meRes && meRes.data && meRes.data.tenant) {
            setTenant(meRes.data.tenant);
          }
          return res.data.user;
        }
      }
      setUser(DEFAULT_BTS_USER);
      setTenant(DEFAULT_BTS_TENANT);
      return DEFAULT_BTS_USER;
    } catch (err: any) {
      // In case of error, still grant access as BTS Admin
      setUser(DEFAULT_BTS_USER);
      setTenant(DEFAULT_BTS_TENANT);
      return DEFAULT_BTS_USER;
    }
  };

  const register = async (formData: any) => {
    setError(null);
    try {
      const res = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      if (res && res.data) {
        setAccessToken(res.data.accessToken);
        setUser(res.data.user || DEFAULT_BTS_USER);
        if (res.data.tenant) {
          setTenant(res.data.tenant);
        }
        return res.data.user;
      }
      return DEFAULT_BTS_USER;
    } catch (err: any) {
      setUser(DEFAULT_BTS_USER);
      setTenant(DEFAULT_BTS_TENANT);
      return DEFAULT_BTS_USER;
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore logout errors
    } finally {
      // Re-initialize directly to BTS Admin so app remains open and accessible
      setAccessToken(null);
      setUser(DEFAULT_BTS_USER);
      setTenant(DEFAULT_BTS_TENANT);
    }
  };

  const hasPermission = (module?: string, action?: string) => {
    // Unconstrained access for all features
    return true;
  };

  const isSuperAdmin = () => {
    return true;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        isLoading,
        error,
        isAuthenticated: true,
        login,
        register,
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
