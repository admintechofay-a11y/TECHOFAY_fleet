import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

interface DashboardMetrics {
  loads: {
    total: number;
    today: number;
    byStatus: Record<string, number>;
    totalWeightMt: number;
  };
  trips: {
    total: number;
    active: number;
    closed: number;
    byStatus: Record<string, number>;
    totalExpenses: number;
  };
  fleet: {
    vehicles: {
      total: number;
      available: number;
      onTrip: number;
      maintenance: number;
      byStatus: Record<string, number>;
    };
    drivers: {
      total: number;
      available: number;
      onTrip: number;
      onLeave: number;
      byStatus: Record<string, number>;
    };
  };
  financials: {
    freightBilled: number;
    advanceReceived: number;
    balanceOutstanding: number;
    tripExpenses: number;
    netOperationalProfit: number;
  };
  compliance: {
    expired: number;
    expiring15Days: number;
    expiring30Days: number;
  };
  pod: {
    total: number;
    pending: number;
    verified: number;
    rejected: number;
  };
  whatsapp: {
    total: number;
    success: number;
    failed: number;
    deliveryRate: number;
  };
}

interface TrendDay {
  date: string;
  loadCount: number;
  freight: number;
  weightMt: number;
  tripCount: number;
  expenses: number;
}

interface AlertItem {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  type: string;
  title: string;
  message: string;
  link: string;
}

export function DashboardPage({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { user, tenant } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [trends, setTrends] = useState<TrendDay[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  async function fetchDashboardData() {
    try {
      setIsLoading(true);
      const [metricsRes, trendsRes, alertsRes] = await Promise.all([
        apiRequest('/dashboard/metrics'),
        apiRequest('/dashboard/trends?days=7'),
        apiRequest('/dashboard/alerts')
      ]);

      if (metricsRes?.data) setMetrics(metricsRes.data);
      if (trendsRes?.data) setTrends(trendsRes.data);
      if (alertsRes?.data) setAlerts(alertsRes.data);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatCurrency = (amt: number = 0) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amt);
  };

  const handleNav = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.location.hash = path;
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: '2rem' }}>
      {/* Top Banner: Greeting, Live State & Refresh */}
      <div
        className="glass-panel"
        style={{
          padding: '1.75rem 2rem',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.45) 0%, rgba(15, 23, 42, 0.85) 100%)',
          border: '1px solid rgba(6, 182, 212, 0.25)',
          marginBottom: '2rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em', margin: 0 }}>
              Operations Command Center
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              Real-time fleet telemetry, cargo dispatch, and financial overview for {tenant?.legalName || 'Techofay Global Logistics'}.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={fetchDashboardData}
              className="btn btn-secondary"
              disabled={isLoading}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}
            >
              <span>{isLoading ? '⏳' : '🔄'}</span>
              <span>Refresh Metrics</span>
            </button>
            <div style={{ textAlign: 'right' }}>
              <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                ● Live Data Connected
              </span>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Updated: {lastRefreshed.toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Operational Shortcuts */}
        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap'
          }}
        >
          <button
            onClick={() => handleNav('/app/loads')}
            className="btn btn-primary"
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem' }}
          >
            ➕ Create Load
          </button>
          <button
            onClick={() => handleNav('/app/trips')}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem' }}
          >
            🚛 Dispatch Trip
          </button>
          <button
            onClick={() => handleNav('/app/whatsapp')}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem' }}
          >
            💬 WhatsApp Hub
          </button>
          <button
            onClick={() => handleNav('/app/reports')}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem' }}
          >
            📊 Operational Reports
          </button>
          <button
            onClick={() => handleNav('/app/bulk-data')}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem' }}
          >
            📥 Excel Importer
          </button>
        </div>
      </div>

      {/* 6 Rich KPI Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2rem'
        }}
      >
        {/* Card 1: Today's & Total Loads */}
        <div
          className="glass-card"
          style={{
            padding: '1.4rem',
            background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.7) 0%, rgba(30, 41, 59, 0.4) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
              Freight Cargo Loads
            </span>
            <span style={{ fontSize: '1.2rem' }}>📦</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#38bdf8' }}>
              {metrics?.loads.today ?? 0}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              today / {metrics?.loads.total ?? 0} total
            </span>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>In-Transit: <strong style={{ color: '#38bdf8' }}>{metrics?.loads.byStatus.IN_TRANSIT ?? 0}</strong></span>
            <span>Delivered: <strong style={{ color: '#34d399' }}>{metrics?.loads.byStatus.DELIVERED ?? 0}</strong></span>
            <span>Tonnage: <strong>{metrics?.loads.totalWeightMt ?? 0} MT</strong></span>
          </div>
        </div>

        {/* Card 2: Active Trips Dispatched */}
        <div
          className="glass-card"
          style={{
            padding: '1.4rem',
            background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.7) 0%, rgba(30, 41, 59, 0.4) 100%)',
            border: '1px solid rgba(251, 191, 36, 0.25)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
              Trips on Road
            </span>
            <span style={{ fontSize: '1.2rem' }}>🛣️</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fbbf24' }}>
              {metrics?.trips.active ?? 0}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              active / {metrics?.trips.total ?? 0} total
            </span>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>Loading: <strong>{metrics?.trips.byStatus.LOADING ?? 0}</strong></span>
            <span>In-Transit: <strong style={{ color: '#fbbf24' }}>{metrics?.trips.byStatus.IN_TRANSIT ?? 0}</strong></span>
            <span>Closed: <strong style={{ color: '#34d399' }}>{metrics?.trips.closed ?? 0}</strong></span>
          </div>
        </div>

        {/* Card 3: Fleet Vehicle Readiness */}
        <div
          className="glass-card"
          style={{
            padding: '1.4rem',
            background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.7) 0%, rgba(30, 41, 59, 0.4) 100%)',
            border: '1px solid rgba(52, 211, 153, 0.25)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
              Fleet Availability
            </span>
            <span style={{ fontSize: '1.2rem' }}>🚚</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#34d399' }}>
              {metrics?.fleet.vehicles.available ?? 0}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              available / {metrics?.fleet.vehicles.total ?? 0} trucks
            </span>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>On Trip: <strong style={{ color: '#fbbf24' }}>{metrics?.fleet.vehicles.onTrip ?? 0}</strong></span>
            <span>Workshop: <strong style={{ color: '#f87171' }}>{metrics?.fleet.vehicles.maintenance ?? 0}</strong></span>
            <span>Drivers Ready: <strong style={{ color: '#34d399' }}>{metrics?.fleet.drivers.available ?? 0}</strong></span>
          </div>
        </div>

        {/* Card 4: Financial Operations & Balance Due */}
        <div
          className="glass-card"
          style={{
            padding: '1.4rem',
            background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.7) 0%, rgba(30, 41, 59, 0.4) 100%)',
            border: '1px solid rgba(129, 140, 248, 0.25)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
              Freight Outstanding
            </span>
            <span style={{ fontSize: '1.2rem' }}>💰</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#818cf8' }}>
              {formatCurrency(metrics?.financials.balanceOutstanding)}
            </span>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>Billed: <strong style={{ color: '#f8fafc' }}>{formatCurrency(metrics?.financials.freightBilled)}</strong></span>
            <span>Advance: <strong style={{ color: '#34d399' }}>{formatCurrency(metrics?.financials.advanceReceived)}</strong></span>
          </div>
        </div>

        {/* Card 5: Compliance Health & Alerts */}
        <div
          className="glass-card"
          style={{
            padding: '1.4rem',
            background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.7) 0%, rgba(30, 41, 59, 0.4) 100%)',
            border: `1px solid ${
              (metrics?.compliance.expired ?? 0) > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(148, 163, 184, 0.25)'
            }`
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
              Regulatory Compliance
            </span>
            <span style={{ fontSize: '1.2rem' }}>🛡️</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.5rem' }}>
            <span
              style={{
                fontSize: '2.2rem',
                fontWeight: 800,
                color: (metrics?.compliance.expired ?? 0) > 0 ? '#ef4444' : '#34d399'
              }}
            >
              {metrics?.compliance.expired ?? 0}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              expired documents
            </span>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>Due ≤ 15d: <strong style={{ color: '#fbbf24' }}>{metrics?.compliance.expiring15Days ?? 0}</strong></span>
            <span>Due ≤ 30d: <strong style={{ color: '#38bdf8' }}>{metrics?.compliance.expiring30Days ?? 0}</strong></span>
            <button
              onClick={() => handleNav('/app/compliance')}
              style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
            >
              Audit →
            </button>
          </div>
        </div>

        {/* Card 6: POD Verification & WhatsApp */}
        <div
          className="glass-card"
          style={{
            padding: '1.4rem',
            background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.7) 0%, rgba(30, 41, 59, 0.4) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.25)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
              PODs & Notifications
            </span>
            <span style={{ fontSize: '1.2rem' }}>📱</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#c084fc' }}>
              {metrics?.pod.pending ?? 0}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              PODs pending sign-off
            </span>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>Verified: <strong style={{ color: '#34d399' }}>{metrics?.pod.verified ?? 0}</strong></span>
            <span>WA Delivery: <strong style={{ color: '#38bdf8' }}>{metrics?.whatsapp.deliveryRate ?? 100}%</strong></span>
            <button
              onClick={() => handleNav('/app/deliveries')}
              style={{ background: 'none', border: 'none', color: '#c084fc', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
            >
              Verify →
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: 7-Day Trend Chart & Actionable Alerts Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* 7-Day Dispatch Timeline */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                7-Day Dispatch & Revenue Velocity
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Daily load volume and gross freight billing breakdown
              </div>
            </div>
            <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>
              Last 7 Days
            </span>
          </div>

          {trends.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No operational trend data available yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {trends.map((day) => {
                const maxLoads = Math.max(...trends.map((t) => t.loadCount), 5);
                const percent = Math.min(100, Math.round((day.loadCount / maxLoads) * 100));
                return (
                  <div key={day.date} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="font-mono" style={{ width: '85px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {new Date(day.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    </div>
                    <div style={{ flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', height: '26px', overflow: 'hidden', position: 'relative' }}>
                      <div
                        style={{
                          width: `${Math.max(6, percent)}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          paddingLeft: '0.5rem',
                          transition: 'width 0.5s ease'
                        }}
                      >
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f172a' }}>
                          {day.loadCount > 0 ? `${day.loadCount} loads` : ''}
                        </span>
                      </div>
                    </div>
                    <div style={{ width: '110px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8' }}>
                      {day.freight > 0 ? formatCurrency(day.freight) : '₹0'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actionable Alerts Feed */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Actionable Operations Alerts
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Priority tasks requiring dispatcher intervention
              </div>
            </div>
            <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
              {alerts.length} Pending
            </span>
          </div>

          {alerts.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✨</div>
              <div style={{ fontSize: '0.85rem', color: '#f8fafc' }}>All Systems Compliant</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                No document expiries or overdue verification alerts.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto' }}>
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  onClick={() => handleNav(alert.link)}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    backgroundColor:
                      alert.severity === 'CRITICAL'
                        ? 'rgba(239, 68, 68, 0.12)'
                        : alert.severity === 'WARNING'
                        ? 'rgba(251, 191, 36, 0.12)'
                        : 'rgba(56, 189, 248, 0.12)',
                    border: `1px solid ${
                      alert.severity === 'CRITICAL'
                        ? 'rgba(239, 68, 68, 0.3)'
                        : alert.severity === 'WARNING'
                        ? 'rgba(251, 191, 36, 0.3)'
                        : 'rgba(56, 189, 248, 0.3)'
                    }`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        color:
                          alert.severity === 'CRITICAL'
                            ? '#ef4444'
                            : alert.severity === 'WARNING'
                            ? '#fbbf24'
                            : '#38bdf8',
                        textTransform: 'uppercase'
                      }}
                    >
                      {alert.severity} • {alert.type}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Action →</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', marginTop: '0.25rem' }}>
                    {alert.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {alert.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
