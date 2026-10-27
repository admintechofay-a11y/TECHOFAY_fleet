import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface NavigationContextType {
  currentPath: string;
  navigate: (path: string, options?: { replace?: boolean }) => void;
  goBack: () => void;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

const PAGE_TITLES: Record<string, string> = {
  '/app/dashboard': 'Dashboard — Technofay Fleet',
  '/app/loads': 'Loads Management — Technofay Fleet',
  '/app/lr': 'LR Numbers — Technofay Fleet',
  '/app/bilties': 'Bilty / Consignments — Technofay Fleet',
  '/app/trips': 'Trips & Dispatch — Technofay Fleet',
  '/app/vehicles': 'Fleet & Vehicles — Technofay Fleet',
  '/app/drivers': 'Drivers & Compliance — Technofay Fleet',
  '/app/compliance': 'Expiry & Compliance — Technofay Fleet',
  '/app/maintenance': 'Fleet Maintenance — Technofay Fleet',
  '/app/customers': 'Customers & Parties — Technofay Fleet',
  '/app/locations': 'Location Master — Technofay Fleet',
  '/app/deliveries': 'Deliveries & POD — Technofay Fleet',
  '/app/billing': 'Freight & Billing — Technofay Fleet',
  '/app/bulk-data': 'Bulk Data & Excel — Technofay Fleet',
  '/app/whatsapp': 'WhatsApp Dispatch — Technofay Fleet',
  '/app/messages': 'WhatsApp Dispatch — Technofay Fleet',
  '/app/reports': 'Reports & Analytics — Technofay Fleet',
  '/app/admin/users': 'User Management — Technofay Fleet',
  '/app/admin/roles': 'Roles & Matrix — Technofay Fleet',
  '/app/admin/audit': 'Audit Trail — Technofay Fleet',
  '/app/admin/settings': 'System Settings — Technofay Fleet',
  '/track': 'Public Tracking — Technofay Fleet',
  '/login': 'Sign In — Technofay Fleet',
  '/register': 'Register Fleet — Technofay Fleet',
  '/signup': 'Register Fleet — Technofay Fleet',
  '/privacy': 'Privacy Policy — Technofay Fleet',
  '/terms': 'Terms of Service — Technofay Fleet',
  '/contact': 'Contact Support — Technofay Fleet'
};

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window !== 'undefined' && window.location.pathname && window.location.pathname !== '/') {
      return window.location.pathname;
    }
    return '/app/dashboard';
  });

  const updateTitle = useCallback((path: string) => {
    if (typeof document !== 'undefined') {
      const basePath = path.split('?')[0];
      if (PAGE_TITLES[basePath]) {
        document.title = PAGE_TITLES[basePath];
      } else if (basePath.startsWith('/track/')) {
        document.title = 'Live Consignment Tracking — Technofay Fleet';
      } else {
        document.title = 'Technofay Fleet OS — Enterprise Logistics';
      }
    }
  }, []);

  const navigate = useCallback((path: string, options?: { replace?: boolean }) => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (typeof window !== 'undefined') {
      const currentUrl = window.location.pathname + window.location.search;
      if (cleanPath !== currentUrl) {
        if (options?.replace) {
          window.history.replaceState({ path: cleanPath }, '', cleanPath);
        } else {
          window.history.pushState({ path: cleanPath }, '', cleanPath);
        }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    const pureRoute = cleanPath.split('?')[0];
    setCurrentPath(pureRoute);
    updateTitle(pureRoute);
  }, [updateTitle]);

  const goBack = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname || '/app/dashboard';
        setCurrentPath(path);
        updateTitle(path);
      }
    };

    window.addEventListener('popstate', handlePopState);
    updateTitle(currentPath);

    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentPath, updateTitle]);

  return (
    <NavigationContext.Provider value={{ currentPath, navigate, goBack }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
};
