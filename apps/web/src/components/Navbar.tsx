import React from 'react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  onOpenSearch?: () => void;
}

export function Navbar({ onOpenSearch }: NavbarProps) {
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
            {tenant?.legalName || tenant?.tradeName || 'Techofay Global Logistics'}
          </span>
        </div>
        {tenant?.gstin && (
          <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
            GSTIN: {tenant.gstin}
          </span>
        )}
      </div>

      {/* Global Quick Search Button */}
      {onOpenSearch && (
        <button
          onClick={onOpenSearch}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.45rem 1rem',
            borderRadius: '20px',
            border: '1px solid var(--border-medium)',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title="Search across all entities (Ctrl + K)"
        >
          <span style={{ fontSize: '0.9rem', color: '#38bdf8' }}>🔍</span>
          <span>Search loads, LR, bilties, trips, fleet...</span>
          <kbd
            style={{
              padding: '0.15rem 0.4rem',
              fontSize: '0.65rem',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '4px',
              color: 'var(--text-muted)'
            }}
          >
            Ctrl K
          </kbd>
        </button>
      )}

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

