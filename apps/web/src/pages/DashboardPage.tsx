import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

export function DashboardPage() {
  const { user, tenant } = useAuth();
  const [healthStatus, setHealthStatus] = useState(null);

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await apiRequest('/health');
        if (res && res.data) {
          setHealthStatus(res.data);
        }
      } catch (e) {
        // Ignored
      }
    }
    checkHealth();
  }, []);

  return (
    <div className="animate-fade-in" style={{ padding: '2rem' }}>
      {/* Welcome Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '1.75rem 2rem',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.4) 0%, rgba(17, 24, 39, 0.8) 100%)',
          border: '1px solid rgba(6, 182, 212, 0.2)',
          marginBottom: '2rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em' }}>
              Welcome back, {user?.name || 'Dispatcher'}
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              Operational control center for {tenant?.legalName || 'Techofay Global Logistics'}.
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="badge badge-success">
              ● System Online
            </span>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              Uptime: {healthStatus ? `${Math.floor(healthStatus.uptime)}s` : 'Active'} | Env: {healthStatus?.environment || 'dev'}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2rem'
        }}
      >
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
            Active Fleet Status
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.5rem' }}>
            Ready
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Registry & compliance ready (Phase 3)
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
            Today's Loads
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34d399', marginTop: '0.5rem' }}>
            Phase 4
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Multi-stop & LR numbering
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
            Trips Dispatched
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.5rem' }}>
            Phase 5
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Freight billing & POD closure
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
            Active Security Scope
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#a78bfa', marginTop: '0.5rem' }}>
            RBAC v1
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            8 roles active & tenant isolated
          </div>
        </div>
      </div>

      {/* Architecture Verification Card */}
      <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.75rem' }}>
          Phase 2 Foundation Status
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: '#0b1329', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, color: '#38bdf8', fontSize: '0.85rem' }}>🔐 Authentication & Sessions</div>
            <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              JWT Access Tokens (15m) + Rotating HttpOnly Refresh Cookies (7d) + Session Revocation.
            </div>
          </div>

          <div style={{ padding: '1rem', background: '#0b1329', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, color: '#34d399', fontSize: '0.85rem' }}>🛡️ Role-Based Access Control</div>
            <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              8 standardized operational roles with server-enforced route permissions and zero backdoor bypasses.
            </div>
          </div>

          <div style={{ padding: '1rem', background: '#0b1329', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, color: '#fbbf24', fontSize: '0.85rem' }}>🏢 Multi-Tenant Data Isolation</div>
            <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              Every query scoped to verified Organization ID with zero cross-tenant leakage.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
