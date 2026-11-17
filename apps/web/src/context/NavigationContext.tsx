import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface NavigationContextType {
  currentPath: string;
  navigate: (path: string, options?: { replace?: boolean }) => void;
  goBack: () => void;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

const PAGE_TITLES: Record<string, string> = {
  '/app/dashboard': 'Dashboard — Barkat Tempo Service',
  '/app/loads': 'Loads Management — Barkat Tempo Service',
  '/app/lr': 'LR Numbers & Receipts — Barkat Tempo Service',
  '/app/bilties': 'Bilty / Consignments — Barkat Tempo Service',
  '/app/trips': 'Trips & Dispatch — Barkat Tempo Service',
  '/app/vehicles': 'Fleet & Vehicles — Barkat Tempo Service',
  '/app/drivers': 'Drivers & Compliance — Barkat Tempo Service',
  '/app/compliance': 'Expiry & Compliance — Barkat Tempo Service',
  '/app/maintenance': 'Fleet Maintenance — Barkat Tempo Service',
  '/app/customers': 'Customers & Parties — Barkat Tempo Service',
  '/app/locations': 'Location Master — Barkat Tempo Service',
  '/app/deliveries': 'Deliveries & POD — Barkat Tempo Service',
  '/app/billing': 'Freight & Billing — Barkat Tempo Service',
  '/app/bulk-data': 'Bulk Data & Excel — Barkat Tempo Service',
  '/app/whatsapp': 'WhatsApp Dispatch — Barkat Tempo Service',
  '/app/messages': 'WhatsApp Dispatch — Barkat Tempo Service',
  '/app/reports': 'Reports & Analytics — Barkat Tempo Service',
  '/app/admin/users': 'User Management — Barkat Tempo Service',
  '/app/admin/roles': 'Roles & Matrix — Barkat Tempo Service',
  '/app/admin/audit': 'Audit Trail — Barkat Tempo Service',
  '/app/admin/settings': 'System Settings — Barkat Tempo Service',
  '/track': 'Public Tracking — Barkat Tempo Service',
  '/login': 'Sign In — Barkat Tempo Service',
  '/register': 'Register Fleet — Barkat Tempo Service',
  '/signup': 'Register Fleet — Barkat Tempo Service',
  '/privacy': 'Privacy Policy — Barkat Tempo Service',
  '/terms': 'Terms of Service — Barkat Tempo Service',
  '/contact': 'Contact Support — Barkat Tempo Service'
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
        document.title = 'Live Consignment Tracking — Barkat Tempo Service';
      } else {
        document.title = 'Barkat Tempo Service — Fleet & Transport OS';
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
