import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { useRealtimeEvents, RealtimeEvent } from '../hooks/useRealtimeEvents';

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

interface TelematicsStatus {
  isConfigured: boolean;
  provider: string;
  status: 'CONFIGURED' | 'UNAVAILABLE';
  supportedProtocols: string[];
  dependencyMessage: string;
}

export function DashboardPage({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { user, tenant } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [trends, setTrends] = useState<TrendDay[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [telematicsStatus, setTelematicsStatus] = useState<TelematicsStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recentNotification, setRecentNotification] = useState<{ id: string; message: string; type: string } | null>(null);

  const fetchDashboardData = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const [metricsRes, trendsRes, alertsRes, telematicsRes] = await Promise.allSettled([
        apiRequest('/dashboard/metrics'),
        apiRequest('/dashboard/trends?days=7'),
        apiRequest('/dashboard/alerts'),
        apiRequest('/telematics/status')
      ]);

      if (metricsRes.status === 'fulfilled' && metricsRes.value?.data) {
        setMetrics(metricsRes.value.data);
      }
      if (trendsRes.status === 'fulfilled' && trendsRes.value?.data) {
        setTrends(trendsRes.value.data);
      }
      if (alertsRes.status === 'fulfilled' && alertsRes.value?.data) {
        setAlerts(alertsRes.value.data);
      }
      if (telematicsRes.status === 'fulfilled' && telematicsRes.value?.data) {
        setTelematicsStatus(telematicsRes.value.data);
      }
      setLastRefreshed(new Date());
      setElapsedSeconds(0);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  // Real-time Event Subscription with Automatic Refresh and Notification
  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    const eventLabels: Record<string, string> = {
      TRIP_DISPATCHED: `Trip Dispatched: ${event.payload?.tripNumber || ''}`,
      TRIP_CLOSED: `Trip Closed: ${event.payload?.tripNumber || ''}`,
      TRIP_DELIVERED: `Trip Delivered: ${event.payload?.tripNumber || ''}`,
      TRIP_STATUS_UPDATED: `Trip Status Updated: ${event.payload?.tripNumber || ''}`,
      STOP_DELIVERED: `Stop Completed on Trip ${event.payload?.tripNumber || ''}`,
      LOAD_CREATED: `New Load Created: ${event.payload?.loadNumber || ''}`,
      LOAD_STATUS_UPDATED: `Load Status: ${event.payload?.loadNumber || ''} -> ${event.payload?.newStatus || ''}`,
      POD_UPLOADED: `POD Uploaded: ${event.payload?.podNumber || ''}`,
      POD_VERIFIED: `POD ${event.payload?.podNumber || ''} Verified`,
      TELEMATICS_PING: `Vehicle ${event.payload?.plateNumber || ''} GPS Ping Received`
    };

    const label = eventLabels[event.eventType] || `Live Event: ${event.eventType}`;
    setRecentNotification({
      id: event.eventId,
      message: label,
      type: event.eventType
    });

    setTimeout(() => {
      setRecentNotification(current => (current?.id === event.eventId ? null : current));
    }, 6000);

    if (event.eventType !== 'TELEMATICS_PING') {
      fetchDashboardData(true);
    }
  }, [fetchDashboardData]);

  const { connectionState, reconnect } = useRealtimeEvents(handleRealtimeEvent);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Track elapsed seconds to flag stale data (> 60s)
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - lastRefreshed.getTime()) / 1000));
    }, 2000);
    return () => clearInterval(timer);
  }, [lastRefreshed]);

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
      {/* Real-time Push Notification Banner */}
      {recentNotification && (
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderRadius: '10px',
            background: 'rgba(37, 99, 235, 0.12)',
            border: '1px solid rgba(37, 99, 235, 0.35)',
            color: '#1d4ed8',
            fontSize: '0.85rem',
            fontWeight: 600,
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⚡</span>
            <span>Real-Time Dispatch Update:</span>
            <span style={{ color: 'var(--text-primary)' }}>{recentNotification.message}</span>
          </div>
          <button
            onClick={() => setRecentNotification(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#1d4ed8', fontSize: '0.9rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Banner: Greeting, Live State & Refresh */}
      <div
        className="glass-panel"
        style={{
          padding: '1.75rem 2rem',
          borderRadius: '16px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          marginBottom: '1.25rem',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Operations Command Center
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              Real-time fleet telemetry, cargo dispatch, and financial overview for {tenant?.legalName || 'Techofay Global Logistics'}.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => fetchDashboardData()}
              className="btn btn-secondary"
              disabled={isLoading}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}
            >
              <span>{isLoading ? '⏳' : '🔄'}</span>
              <span>Refresh Metrics</span>
            </button>
            <div style={{ textAlign: 'right' }}>
              {/* Dynamic SSE Live Connection Badge */}
              {connectionState === 'CONNECTED' && (
                <span className="badge badge-success" style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                  Live Connected (SSE)
                </span>
              )}
              {connectionState === 'RECONNECTING' && (
                <span className="badge badge-warning" style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
                  Reconnecting...
                </span>
              )}
              {connectionState === 'CONNECTING' && (
                <span className="badge" style={{ fontSize: '0.72rem', background: '#3b82f6', color: '#ffffff' }}>
                  Connecting...
                </span>
              )}
              {connectionState === 'DISCONNECTED' && (
                <button
                  onClick={reconnect}
                  className="badge"
                  style={{ fontSize: '0.72rem', background: '#64748b', color: '#ffffff', cursor: 'pointer', border: 'none' }}
                >
                  Offline • Click Reconnect
                </button>
              )}

              {/* Stale Data Detector */}
              {elapsedSeconds >= 60 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      color: '#d97706',
                      background: 'rgba(245, 158, 11, 0.15)',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      fontWeight: 700
                    }}
                  >
                    ⚠️ Stale ({Math.floor(elapsedSeconds / 60)}m ago)
                  </span>
                  <button
                    onClick={() => fetchDashboardData()}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '0.68rem',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0
                    }}
                  >
                    Refresh
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Updated: {lastRefreshed.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Operational Shortcuts */}
        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--border-subtle)',
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

      {/* Honest Telematics Hardware Gateway Status Banner */}
      <div
        style={{
          padding: '0.75rem 1.25rem',
          borderRadius: '12px',
          background: telematicsStatus?.isConfigured ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
          border: `1px solid ${telematicsStatus?.isConfigured ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
          marginBottom: '1.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          boxShadow: 'var(--shadow-xs)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.82rem' }}>
          <span style={{ fontSize: '1.1rem' }}>{telematicsStatus?.isConfigured ? '🛰️' : '📡'}</span>
          <div>
            <strong style={{ color: telematicsStatus?.isConfigured ? '#047857' : '#b45309', marginRight: '0.5rem' }}>
              GPS Telematics Subsystem:
            </strong>
            <span style={{ color: 'var(--text-secondary)' }}>
              {telematicsStatus?.dependencyMessage ||
                'Physical AIS-140/Teltonika GPS gateway unconfigured. Vehicle positions resolve to geocoded freight corridor hubs.'}
            </span>
          </div>
        </div>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            padding: '0.25rem 0.65rem',
            borderRadius: '6px',
            background: telematicsStatus?.isConfigured ? '#d1fae5' : '#fef3c7',
            color: telematicsStatus?.isConfigured ? '#065f46' : '#92400e',
            textTransform: 'uppercase'
          }}
        >
          {telematicsStatus?.isConfigured ? 'HARDWARE ONLINE' : 'CORRIDOR GEOCODE FALLBACK'}
        </span>
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
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)',
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
            <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#2563eb' }}>
              {metrics?.loads.today ?? 0}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              today / {metrics?.loads.total ?? 0} total
            </span>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>In-Transit: <strong style={{ color: '#2563eb' }}>{metrics?.loads.byStatus.IN_TRANSIT ?? 0}</strong></span>
            <span>Delivered: <strong style={{ color: '#16a36a' }}>{metrics?.loads.byStatus.DELIVERED ?? 0}</strong></span>
            <span>Tonnage: <strong>{metrics?.loads.totalWeightMt ?? 0} MT</strong></span>
          </div>
        </div>

        {/* Card 2: Active Trips Dispatched */}
        <div
          className="glass-card"
          style={{
            padding: '1.4rem',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
              Trips on Road
            </span>
            <span style={{ fontSize: '1.2rem' }}>🛣️</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#d97706' }}>
              {metrics?.trips.active ?? 0}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              active / {metrics?.trips.total ?? 0} total
            </span>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>Loading: <strong>{metrics?.trips.byStatus.LOADING ?? 0}</strong></span>
            <span>In-Transit: <strong style={{ color: '#d97706' }}>{metrics?.trips.byStatus.IN_TRANSIT ?? 0}</strong></span>
            <span>Closed: <strong style={{ color: '#16a36a' }}>{metrics?.trips.closed ?? 0}</strong></span>
          </div>
        </div>

        {/* Card 3: Fleet Vehicle Readiness */}
        <div
          className="glass-card"
          style={{
            padding: '1.4rem',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
              Fleet Availability
            </span>
            <span style={{ fontSize: '1.2rem' }}>🚚</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#16a36a' }}>
              {metrics?.fleet.vehicles.available ?? 0}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              available / {metrics?.fleet.vehicles.total ?? 0} trucks
            </span>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>On Trip: <strong style={{ color: '#d97706' }}>{metrics?.fleet.vehicles.onTrip ?? 0}</strong></span>
            <span>Workshop: <strong style={{ color: '#dc2626' }}>{metrics?.fleet.vehicles.maintenance ?? 0}</strong></span>
            <span>Drivers Ready: <strong style={{ color: '#16a36a' }}>{metrics?.fleet.drivers.available ?? 0}</strong></span>
          </div>
        </div>

        {/* Card 4: Financial Operations & Balance Due */}
        <div
          className="glass-card"
          style={{
            padding: '1.4rem',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
              Freight Outstanding
            </span>
            <span style={{ fontSize: '1.2rem' }}>💰</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#4f46e5' }}>
              {formatCurrency(metrics?.financials.balanceOutstanding)}
            </span>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>Billed: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(metrics?.financials.freightBilled)}</strong></span>
            <span>Advance: <strong style={{ color: '#16a36a' }}>{formatCurrency(metrics?.financials.advanceReceived)}</strong></span>
          </div>
        </div>

        {/* Card 5: Compliance Health & Alerts */}
        <div
          className="glass-card"
          style={{
            padding: '1.4rem',
            background: 'var(--bg-surface)',
            border: `1px solid ${
              (metrics?.compliance.expired ?? 0) > 0 ? '#fecaca' : 'var(--border-subtle)'
            }`,
            boxShadow: 'var(--shadow-sm)'
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
                color: (metrics?.compliance.expired ?? 0) > 0 ? '#dc2626' : '#16a36a'
              }}
            >
              {metrics?.compliance.expired ?? 0}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              expired documents
            </span>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>Due ≤ 15d: <strong style={{ color: '#d97706' }}>{metrics?.compliance.expiring15Days ?? 0}</strong></span>
            <span>Due ≤ 30d: <strong style={{ color: '#2563eb' }}>{metrics?.compliance.expiring30Days ?? 0}</strong></span>
            <button
              onClick={() => handleNav('/app/compliance')}
              style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
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
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
              PODs & Notifications
            </span>
            <span style={{ fontSize: '1.2rem' }}>📱</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#9333ea' }}>
              {metrics?.pod.pending ?? 0}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              PODs pending sign-off
            </span>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>Verified: <strong style={{ color: '#16a36a' }}>{metrics?.pod.verified ?? 0}</strong></span>
            <span>WA Delivery: <strong style={{ color: '#2563eb' }}>{metrics?.whatsapp.deliveryRate ?? 100}%</strong></span>
            <button
              onClick={() => handleNav('/app/deliveries')}
              style={{ background: 'none', border: 'none', color: '#9333ea', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
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
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
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
                    <div style={{ flex: 1, backgroundColor: '#f1f5f9', borderRadius: '6px', height: '26px', overflow: 'hidden', position: 'relative' }}>
                      <div
                        style={{
                          width: `${Math.max(6, percent)}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #2563eb, #3b82f6)',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          paddingLeft: '0.5rem',
                          transition: 'width 0.5s ease'
                        }}
                      >
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ffffff' }}>
                          {day.loadCount > 0 ? `${day.loadCount} loads` : ''}
                        </span>
                      </div>
                    </div>
                    <div style={{ width: '110px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#2563eb' }}>
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
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
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
              <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>All Systems Compliant</div>
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
                        ? '#fef2f2'
                        : alert.severity === 'WARNING'
                        ? '#fffbeb'
                        : '#eff6ff',
                    border: `1px solid ${
                      alert.severity === 'CRITICAL'
                        ? '#fecaca'
                        : alert.severity === 'WARNING'
                        ? '#fde68a'
                        : '#bfdbfe'
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
                            ? '#dc2626'
                            : alert.severity === 'WARNING'
                            ? '#d97706'
                            : '#2563eb',
                        textTransform: 'uppercase'
                      }}
                    >
                      {alert.severity} • {alert.type}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Action →</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
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
