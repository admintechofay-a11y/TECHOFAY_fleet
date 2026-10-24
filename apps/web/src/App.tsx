import React, { useState } from 'react';
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
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentPath, setCurrentPath] = useState('/app/dashboard');

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

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderCurrentView = () => {
    switch (currentPath) {
      case '/app/dashboard':
        return <DashboardPage />;
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
      case '/app/admin/users':
        return <UsersAdminPage />;
      case '/app/admin/roles':
        return <RolesAdminPage />;
      case '/app/admin/audit':
        return <AuditLogPage />;
      default:
        return (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚧</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc' }}>
              Module Planned for Upcoming Phase
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', maxWidth: '500px', margin: '0.5rem auto' }}>
              This operational module is scheduled in accordance with the SOW phase roadmap.
            </p>
            <button onClick={() => setCurrentPath('/app/dashboard')} className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
              Return to Dashboard
            </button>
          </div>
        );
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-app)' }}>
      {/* Navigation Sidebar */}
      <Sidebar currentPath={currentPath} onNavigate={(path) => setCurrentPath(path)} />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Navbar />
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {renderCurrentView()}
        </main>
      </div>
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
