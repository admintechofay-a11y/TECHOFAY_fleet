import React from 'react';
import { useAuth } from '../context/AuthContext';

export function Sidebar({ currentPath, onNavigate }) {
  const { user, tenant, hasPermission, isSuperAdmin } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', path: '/app/dashboard', icon: '📊' },
    { id: 'loads', label: 'Loads Management', path: '/app/loads', icon: '📦', module: 'loads' },
    { id: 'lr', label: 'LR Numbers', path: '/app/lr', icon: '📄', module: 'lr' },
    { id: 'bilties', label: 'Bilty / Consignments', path: '/app/bilties', icon: '📝', module: 'bilties' },
    { id: 'trips', label: 'Trips & Dispatch', path: '/app/trips', icon: '🚚', module: 'trips' },
    { id: 'vehicles', label: 'Fleet & Vehicles', path: '/app/vehicles', icon: '🚛', module: 'vehicles' },
    { id: 'drivers', label: 'Drivers & Compliance', path: '/app/drivers', icon: '👤', module: 'drivers' },
    { id: 'compliance', label: 'Expiry & Compliance', path: '/app/compliance', icon: '🛡️', module: 'vehicles' },
    { id: 'maintenance', label: 'Fleet Maintenance', path: '/app/maintenance', icon: '🔧', module: 'vehicles' },
    { id: 'customers', label: 'Customers & Parties', path: '/app/customers', icon: '🏢', module: 'customers' },
    { id: 'locations', label: 'Location Master', path: '/app/locations', icon: '📍', module: 'locations' },
    { id: 'deliveries', label: 'Deliveries & POD', path: '/app/deliveries', icon: '✅', module: 'pod' },
    { id: 'billing', label: 'Freight & Billing', path: '/app/billing', icon: '💰', module: 'billing' },
    { id: 'bulk', label: 'Bulk Data & Excel', path: '/app/bulk-data', icon: '📥', module: 'import_export' },
    { id: 'whatsapp', label: 'WhatsApp Dispatch', path: '/app/whatsapp', icon: '💬', module: 'whatsapp' },
    { id: 'reports', label: 'Reports & Analytics', path: '/app/reports', icon: '📈', module: 'reports' }
  ];

  const adminItems = [
    { id: 'users', label: 'User Management', path: '/app/admin/users', icon: '👥', module: 'users' },
    { id: 'roles', label: 'Roles & Matrix', path: '/app/admin/roles', icon: '🛡️', module: 'roles' },
    { id: 'audit', label: 'Audit Trail', path: '/app/admin/audit', icon: '🔍', module: 'audit' },
    { id: 'settings', label: 'System Settings', path: '/app/admin/settings', icon: '⚙️', module: 'settings' }
  ];

  // Filter items by user permissions
  const visibleNav = navItems.filter((item) => !item.module || hasPermission(item.module, 'view'));
  const visibleAdmin = adminItems.filter((item) => isSuperAdmin() || hasPermission(item.module, 'view'));

  return (
    <aside
      style={{
        width: '260px',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '1.25rem 1rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #06b6d4, #0284c7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            boxShadow: 'var(--shadow-glow)'
          }}
        >
          🚚
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc', letterSpacing: '-0.01em' }}>
            {tenant?.tradeName || 'Technofay Fleet'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontWeight: 500 }}>
            HAULAGE OS v1.0
          </div>
        </div>
      </div>

      {/* Nav List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 0.75rem' }}>
        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
          Operations
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {visibleNav.map((item) => {
            const isActive = currentPath === item.path;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.6rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isActive ? 'var(--accent-cyan-subtle)' : 'transparent',
                  color: isActive ? '#38bdf8' : 'var(--text-secondary)',
                  border: isActive ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid transparent',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {visibleAdmin.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
              Administration
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {visibleAdmin.map((item) => {
                const isActive = currentPath === item.path;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.path)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.6rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isActive ? 'var(--accent-cyan-subtle)' : 'transparent',
                      color: isActive ? '#38bdf8' : 'var(--text-secondary)',
                      border: isActive ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid transparent',
                      fontWeight: isActive ? 600 : 500,
                      fontSize: '0.825rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* User Footer Profile */}
      <div
        style={{
          padding: '0.875rem 1rem',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: '#0a0f1d'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#1e293b',
              border: '1px solid var(--border-medium)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#38bdf8'
            }}
          >
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              {user?.roleId?.name || 'Operator'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
