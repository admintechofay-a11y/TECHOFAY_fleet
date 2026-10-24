import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersAdminPage } from './pages/UsersAdminPage';
import { RolesAdminPage } from './pages/RolesAdminPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { CustomersPage } from './pages/CustomersPage';
import { LocationsPage } from './pages/LocationsPage';
import { VehiclesPage } from './pages/VehiclesPage';
import { DriversPage } from './pages/DriversPage';
import { CompliancePage } from './pages/CompliancePage';
import { LoadsPage } from './pages/LoadsPage';
import { LrPage } from './pages/LrPage';
import { BiltiesPage } from './pages/BiltiesPage';
import { TripsPage } from './pages/TripsPage';
import { DeliveriesPodPage } from './pages/DeliveriesPodPage';
import { BulkDataPage } from './pages/BulkDataPage';
import { WhatsAppPage } from './pages/WhatsAppPage';
import { ReportsPage } from './pages/ReportsPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { ContactPage } from './pages/ContactPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PublicTrackingPage } from './pages/PublicTrackingPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { analytics } from './lib/analytics';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window !== 'undefined' && window.location.pathname && window.location.pathname !== '/') {
      return window.location.pathname;
    }
    return '/app/dashboard';
  });
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Track privacy-aware analytics on path change
  useEffect(() => {
    analytics.trackPageView(currentPath);
  }, [currentPath]);

  // Global Ctrl+K / Cmd+K shortcut for quick command palette
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f1d' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'spin 1s linear infinite' }}>
            🔄
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Verifying secure session...
          </div>
        </div>
      </div>
    );
  }

  // Public Routes (Accessible without login)
  if (currentPath === '/privacy') {
    return <PrivacyPage onNavigateHome={() => setCurrentPath(isAuthenticated ? '/app/dashboard' : '/login')} />;
  }
  if (currentPath === '/terms') {
    return <TermsPage onNavigateHome={() => setCurrentPath(isAuthenticated ? '/app/dashboard' : '/login')} />;
  }
  if (currentPath === '/contact') {
    return <ContactPage onNavigateHome={() => setCurrentPath(isAuthenticated ? '/app/dashboard' : '/login')} />;
  }
  if (currentPath === '/track' || currentPath.startsWith('/track/')) {
    return <PublicTrackingPage />;
  }

  if (!isAuthenticated) {
    return <LoginPage onNavigatePublic={(path) => setCurrentPath(path)} />;
  }

  const renderCurrentView = () => {
    switch (currentPath) {
      case '/app/dashboard':
        return <DashboardPage />;
      case '/app/loads':
        return <LoadsPage />;
      case '/app/lr':
        return <LrPage />;
      case '/app/bilties':
        return <BiltiesPage />;
      case '/app/trips':
        return <TripsPage />;
      case '/app/deliveries':
        return <DeliveriesPodPage />;
      case '/app/bulk-data':
        return <BulkDataPage />;
      case '/app/whatsapp':
      case '/app/messages':
        return <WhatsAppPage />;
      case '/app/reports':
        return <ReportsPage />;
      case '/app/customers':
        return <CustomersPage />;
      case '/app/locations':
        return <LocationsPage />;
      case '/app/vehicles':
        return <VehiclesPage />;
      case '/app/drivers':
        return <DriversPage />;
      case '/app/compliance':
        return <CompliancePage />;
      case '/app/maintenance':
        return <MaintenancePage />;
      case '/app/admin/users':
        return <UsersAdminPage />;
      case '/app/admin/roles':
        return <RolesAdminPage />;
      case '/app/admin/audit':
        return <AuditLogPage />;
      case '/app/admin/settings':
        return <AdminSettingsPage />;
      default:
        return (
          <NotFoundPage
            onNavigateHome={() => setCurrentPath('/app/dashboard')}
            onNavigateContact={() => setCurrentPath('/contact')}
          />
        );
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-app)' }}>
      {/* Navigation Sidebar */}
      <Sidebar currentPath={currentPath} onNavigate={(path: string) => setCurrentPath(path)} />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Navbar onOpenSearch={() => setIsSearchOpen(true)} />
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {renderCurrentView()}
        </main>
      </div>

      {/* Global Command Palette Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={(path: string) => setCurrentPath(path)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
