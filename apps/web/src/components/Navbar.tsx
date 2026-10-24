import React from 'react';
import { useAuth } from '../context/AuthContext';

export function Navbar() {
  const { user, tenant, logout } = useAuth();

  return (
    <header
      style={{
        height: '60px',
        backgroundColor: 'var(--bg-app)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}
    >
      {/* Organization Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Organization:
          </span>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc' }}>
            {tenant?.legalName || 'Techofay Global Logistics'}
          </span>
        </div>
        {tenant?.gstin && (
          <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
            GSTIN: {tenant.gstin}
          </span>
        )}
      </div>

      {/* Right Controls: Role Badge & Logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div className="badge badge-cyan" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
          {user?.roleId?.name || 'Authorized'}
        </div>

        <button
          onClick={logout}
          className="btn btn-secondary"
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
          title="Sign out of system"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
