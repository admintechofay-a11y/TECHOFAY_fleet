import React, { useState, useEffect } from 'react';
import { apiRequest, apiDownload } from '../lib/api';

type ReportTab = 'loads' | 'trips' | 'freight' | 'compliance';

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('loads');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [datePreset, setDatePreset] = useState<'all' | 'today' | '7d' | '30d' | 'month'>('30d');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('');

  // Data States
  const [loadsData, setLoadsData] = useState<any[]>([]);
  const [loadsSummary, setLoadsSummary] = useState<any>({});
  const [loadsMeta, setLoadsMeta] = useState<any>({ page: 1, limit: 25, total: 0, totalPages: 1 });

  const [tripsData, setTripsData] = useState<any[]>([]);
  const [tripsSummary, setTripsSummary] = useState<any>({});
  const [tripsMeta, setTripsMeta] = useState<any>({ page: 1, limit: 25, total: 0, totalPages: 1 });

  const [freightData, setFreightData] = useState<any[]>([]);
  const [freightSummary, setFreightSummary] = useState<any>({});

  const [complianceData, setComplianceData] = useState<any[]>([]);
  const [complianceSummary, setComplianceSummary] = useState<any>({});

  // Export State
  const [isExporting, setIsExporting] = useState(false);

  // Handle Preset Changes
  const handlePresetChange = (preset: 'all' | 'today' | '7d' | '30d' | 'month') => {
    setDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === '30d') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Fetch Report Data
  const fetchReport = async (page = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      if (activeTab === 'loads') {
        if (statusFilter) params.append('status', statusFilter);
        params.append('page', String(page));
        params.append('limit', '25');
        const res = await apiRequest(`/reports/loads?${params.toString()}`);
        setLoadsData(res.data || []);
        setLoadsSummary(res.summary || {});
        setLoadsMeta(res.meta || { page: 1, limit: 25, total: 0, totalPages: 1 });
      } else if (activeTab === 'trips') {
        if (statusFilter) params.append('status', statusFilter);
        params.append('page', String(page));
        params.append('limit', '25');
        const res = await apiRequest(`/reports/trips?${params.toString()}`);
        setTripsData(res.data || []);
        setTripsSummary(res.summary || {});
        setTripsMeta(res.meta || { page: 1, limit: 25, total: 0, totalPages: 1 });
      } else if (activeTab === 'freight') {
        const res = await apiRequest(`/reports/freight?${params.toString()}`);
        setFreightData(res.data || []);
        setFreightSummary(res.summary || {});
      } else if (activeTab === 'compliance') {
        if (statusFilter) params.append('status', statusFilter);
        if (entityTypeFilter) params.append('entityType', entityTypeFilter);
        const res = await apiRequest(`/reports/compliance?${params.toString()}`);
        setComplianceData(res.data || []);
        setComplianceSummary(res.summary || {});
      }
    } catch (err: any) {
      console.error('Failed to load report:', err);
      setError(err.message || 'Failed to generate operational report');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(1);
  }, [activeTab, startDate, endDate, statusFilter, entityTypeFilter]);

  // Export Report
  const handleExport = async (format: 'xlsx' | 'csv') => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      params.append('format', format);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (statusFilter) params.append('status', statusFilter);
      if (entityTypeFilter) params.append('entityType', entityTypeFilter);

      const endpoint = `/reports/export/${activeTab}?${params.toString()}`;
      const filename = `${activeTab}_report_${new Date().toISOString().split('T')[0]}.${format}`;
      await apiDownload(endpoint, filename);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const formatCurrency = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return '₹0';
    return `₹${Math.round(val).toLocaleString('en-IN')}`;
  };

  const formatDate = (val: string | undefined) => {
    if (!val) return '—';
    try {
      const d = new Date(val);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return val;
    }
  };

  return (
    <div style={{ padding: '1.75rem 2rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header & Global Export Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.75rem' }}>📈</span>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em', margin: 0 }}>
              Reports & Operational Intelligence Hub
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Multi-criteria transport audits, freight ledger (SAC 9965 / GTA 5% GST), and compliance tracking.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => handleExport('xlsx')}
            disabled={isExporting || isLoading}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'rgba(34, 197, 94, 0.12)',
              borderColor: 'rgba(34, 197, 94, 0.3)',
              color: '#4ade80'
            }}
          >
            <span>📊</span>
            <span>{isExporting ? 'Exporting...' : 'Export Excel (.xlsx)'}</span>
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={isExporting || isLoading}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              borderColor: 'rgba(56, 189, 248, 0.3)',
              color: '#38bdf8'
            }}
          >
            <span>📄</span>
            <span>{isExporting ? 'Exporting...' : 'Export CSV (.csv)'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '1.5rem',
          overflowX: 'auto'
        }}
      >
        {[
          { id: 'loads', label: 'Loads Operational Report', icon: '📦' },
          { id: 'trips', label: 'Trips & Expenses Report', icon: '🚚' },
          { id: 'freight', label: 'Freight & GTA GST Ledger', icon: '💰' },
          { id: 'compliance', label: 'Compliance Audit Report', icon: '🛡️' }
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as ReportTab);
                setStatusFilter('');
                setEntityTypeFilter('');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.25rem',
                border: 'none',
                borderBottom: isActive ? '2px solid #38bdf8' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: isActive ? '#38bdf8' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filters Strip */}
      <div
        className="glass-panel"
        style={{
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          borderRadius: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}
      >
        {/* Date presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Period:
          </span>
          {[
            { id: 'today', label: 'Today' },
            { id: '7d', label: 'Last 7 Days' },
            { id: '30d', label: 'Last 30 Days' },
            { id: 'month', label: 'This Month' },
            { id: 'all', label: 'All Time' }
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetChange(preset.id as any)}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                borderRadius: '6px',
                border: datePreset === preset.id ? '1px solid #38bdf8' : '1px solid var(--border-medium)',
                backgroundColor: datePreset === preset.id ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                color: datePreset === preset.id ? '#38bdf8' : 'var(--text-secondary)',
                fontWeight: datePreset === preset.id ? 700 : 500,
                cursor: 'pointer'
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Custom Range & Status Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDatePreset('all');
              }}
              style={{
                padding: '0.35rem 0.6rem',
                fontSize: '0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-medium)',
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                color: '#f8fafc'
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDatePreset('all');
              }}
              style={{
                padding: '0.35rem 0.6rem',
                fontSize: '0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-medium)',
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                color: '#f8fafc'
              }}
            />
          </div>

          {/* Conditional Status Dropdowns */}
          {activeTab === 'loads' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-medium)',
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                color: '#f8fafc'
              }}
            >
              <option value="">All Load Statuses</option>
              <option value="NEW">New</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="DELIVERED">Delivered</option>
              <option value="BILLED">Billed</option>
              <option value="PAID">Paid</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          )}

          {activeTab === 'trips' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-medium)',
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                color: '#f8fafc'
              }}
            >
              <option value="">All Trip Statuses</option>
              <option value="PLANNED">Planned</option>
              <option value="DISPATCHED">Dispatched</option>
              <option value="LOADING">Loading</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="UNLOADING">Unloading</option>
              <option value="COMPLETED">Completed</option>
              <option value="CLOSED">Closed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          )}

          {activeTab === 'compliance' && (
            <>
              <select
                value={entityTypeFilter}
                onChange={(e) => setEntityTypeFilter(e.target.value)}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-medium)',
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  color: '#f8fafc'
                }}
              >
                <option value="">All Entities</option>
                <option value="VEHICLE">Vehicles</option>
                <option value="DRIVER">Drivers</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-medium)',
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  color: '#f8fafc'
                }}
              >
                <option value="">All Audit Statuses</option>
                <option value="EXPIRED">Expired</option>
                <option value="EXPIRING_15">Expiring ≤ 15 Days</option>
                <option value="EXPIRING_30">Expiring ≤ 30 Days</option>
                <option value="VALID">Valid</option>
              </select>
            </>
          )}

          <button
            onClick={() => fetchReport(1)}
            className="btn btn-primary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        {activeTab === 'loads' && (
          <>
            <div className="glass-panel" style={{ padding: '1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL LOADS</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.25rem' }}>
                {loadsSummary.totalLoads || loadsMeta.total || 0}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL WEIGHT</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.25rem' }}>
                {(loadsSummary.totalWeightMt || 0).toFixed(2)} MT
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL FREIGHT</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4ade80', marginTop: '0.25rem' }}>
                {formatCurrency(loadsSummary.totalFreight)}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ADVANCES COLLECTED</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.25rem' }}>
                {formatCurrency(loadsSummary.totalAdvance)}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>BALANCE OUTSTANDING</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f87171', marginTop: '0.25rem' }}>
                {formatCurrency(loadsSummary.totalBalance)}
              </div>
            </div>
          </>
        )}

        {activeTab === 'trips' && (
          <>
            <div className="glass-panel" style={{ padding: '1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL TRIPS</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.25rem' }}>
                {tripsSummary.totalTrips || tripsMeta.total || 0}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL ROUTE EXPENSES</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f87171', marginTop: '0.25rem' }}>
                {formatCurrency(tripsSummary.totalExpenses)}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>DRIVER ADVANCES</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.25rem' }}>
                {formatCurrency(tripsSummary.totalAdvance)}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>NET SETTLEMENT DUE</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.25rem' }}>
                {formatCurrency(tripsSummary.totalBalance)}
              </div>
            </div>
          </>
        )}

        {activeTab === 'freight' && (
          <>
            <div className="glass-panel" style={{ padding: '1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>CONSIGNMENTS</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.25rem' }}>
                {freightSummary.totalRecords || freightData.length || 0}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TAXABLE FREIGHT</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4ade80', marginTop: '0.25rem' }}>
                {formatCurrency(freightSummary.totalTaxable)}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>GTA GST (5%) SAC 9965</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#a78bfa', marginTop: '0.25rem' }}>
                {formatCurrency(freightSummary.totalGst)}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL INVOICE VALUE</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.25rem' }}>
                {formatCurrency(freightSummary.totalAmount)}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>OUTSTANDING DUE</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f87171', marginTop: '0.25rem' }}>
                {formatCurrency(freightSummary.totalBalance)}
              </div>
            </div>
          </>
        )}

        {activeTab === 'compliance' && (
          <>
            <div className="glass-panel" style={{ padding: '1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL AUDITED</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.25rem' }}>
                {complianceSummary.totalAudited || complianceData.length || 0}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>EXPIRED (ACTION REQ.)</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f87171', marginTop: '0.25rem' }}>
                {complianceSummary.expired || 0}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>EXPIRING ≤ 15 DAYS</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fb923c', marginTop: '0.25rem' }}>
                {complianceSummary.expiring15 || 0}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>EXPIRING ≤ 30 DAYS</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.25rem' }}>
                {complianceSummary.expiring30 || 0}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>COMPLIANT / VALID</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4ade80', marginTop: '0.25rem' }}>
                {complianceSummary.valid || 0}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Table Content */}
      <div className="glass-panel" style={{ borderRadius: '14px', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '2rem', animation: 'spin 1s linear infinite', marginBottom: '1rem' }}>🔄</div>
            <div>Synthesizing transport intelligence report...</div>
          </div>
        ) : error ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#f87171' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
            <div>{error}</div>
            <button onClick={() => fetchReport(1)} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
              Retry
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            {activeTab === 'loads' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-medium)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>LOAD #</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>DATE</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>CUSTOMER / PARTY</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>VEHICLE</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>DRIVER</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>WEIGHT</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>FREIGHT</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>ADVANCE</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>BALANCE</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {loadsData.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No loads found for the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    loadsData.map((row) => (
                      <tr key={row._id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#38bdf8' }}>
                          {row.loadNumber || row.orderNumber || row._id.slice(-6)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                          {formatDate(row.createdAt)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#f8fafc', fontWeight: 500 }}>
                          {row.consignorId?.name || row.customer?.name || '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                          {row.assignedVehicleId?.plateNumber || 'Unassigned'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                          {row.assignedDriverId?.name || 'Unassigned'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#f8fafc' }}>
                          {row.actualWeightTonnage || row.weight || 0} MT
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#4ade80', fontWeight: 600 }}>
                          {formatCurrency(
                            row.financials?.totalFreightPaise
                              ? row.financials.totalFreightPaise / 100
                              : row.charges?.totalAmount || 0
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#fbbf24' }}>
                          {formatCurrency(
                            row.financials?.advancePaise
                              ? row.financials.advancePaise / 100
                              : row.charges?.advanceAmount || 0
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#f87171', fontWeight: 600 }}>
                          {formatCurrency(
                            row.financials?.balancePaise
                              ? row.financials.balancePaise / 100
                              : (row.charges?.totalAmount || 0) - (row.charges?.advanceAmount || 0)
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'trips' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-medium)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>TRIP #</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>DATE</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>VEHICLE</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>DRIVER</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>LOADS</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL EXPENSES</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>DRIVER ADVANCE</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>BALANCE DUE</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {tripsData.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No trips found for the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    tripsData.map((row) => (
                      <tr key={row._id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#38bdf8' }}>
                          {row.tripNumber || row._id.slice(-6)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                          {formatDate(row.createdAt)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#f8fafc', fontWeight: 500 }}>
                          {row.vehicleId?.plateNumber || '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                          {row.driverId?.name || '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#f8fafc' }}>
                          {row.loadIds?.length || 0}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#f87171', fontWeight: 600 }}>
                          {formatCurrency(
                            row.financials?.totalExpensesPaise
                              ? row.financials.totalExpensesPaise / 100
                              : row.expensesTotal || 0
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#fbbf24' }}>
                          {formatCurrency(
                            row.financials?.driverAdvancePaise
                              ? row.financials.driverAdvancePaise / 100
                              : row.advancePaid || 0
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#38bdf8' }}>
                          {formatCurrency(
                            row.financials?.settlementBalancePaise
                              ? row.financials.settlementBalancePaise / 100
                              : (row.expensesTotal || 0) - (row.advancePaid || 0)
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'freight' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-medium)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>CONSIGNMENT / LR</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>DATE</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>CUSTOMER</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>GSTIN</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>TAXABLE BASE</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>GTA GST (5%)</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL VALUE</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>BALANCE DUE</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {freightData.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No freight ledger entries found for the selected period.
                      </td>
                    </tr>
                  ) : (
                    freightData.map((row) => (
                      <tr key={row._id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#38bdf8' }}>
                          {row.loadNumber || row.lrNumber || row._id.slice(-6)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                          {formatDate(row.createdAt)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#f8fafc', fontWeight: 500 }}>
                          {row.consignorId?.name || row.customer?.name || '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                          {row.consignorId?.gstin || '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#4ade80' }}>
                          {formatCurrency(
                            row.financials?.baseFreightPaise
                              ? row.financials.baseFreightPaise / 100
                              : row.charges?.baseFreight || 0
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#a78bfa' }}>
                          {formatCurrency(
                            row.financials?.gstPaise
                              ? row.financials.gstPaise / 100
                              : row.charges?.gstAmount || 0
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#38bdf8', fontWeight: 600 }}>
                          {formatCurrency(
                            row.financials?.totalFreightPaise
                              ? row.financials.totalFreightPaise / 100
                              : row.charges?.totalAmount || 0
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#f87171', fontWeight: 600 }}>
                          {formatCurrency(
                            row.financials?.balancePaise
                              ? row.financials.balancePaise / 100
                              : (row.charges?.totalAmount || 0) - (row.charges?.advanceAmount || 0)
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'compliance' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-medium)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>ENTITY</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>REGISTRATION / ID</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>DOCUMENT TYPE</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>DOCUMENT #</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>EXPIRY DATE</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>REMAINING DAYS</th>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {complianceData.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No compliance audit items found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    complianceData.map((row, idx) => {
                      const isExpired = row.daysRemaining < 0;
                      const isWarning = row.daysRemaining >= 0 && row.daysRemaining <= 15;
                      const isCaution = row.daysRemaining > 15 && row.daysRemaining <= 30;

                      let statusBadge = (
                        <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                          VALID
                        </span>
                      );
                      if (isExpired) {
                        statusBadge = (
                          <span className="badge badge-error" style={{ fontSize: '0.65rem' }}>
                            EXPIRED
                          </span>
                        );
                      } else if (isWarning) {
                        statusBadge = (
                          <span className="badge badge-warning" style={{ fontSize: '0.65rem', backgroundColor: 'rgba(249, 115, 22, 0.2)', color: '#fb923c' }}>
                            CRITICAL (≤15d)
                          </span>
                        );
                      } else if (isCaution) {
                        statusBadge = (
                          <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>
                            EXPIRING SOON
                          </span>
                        );
                      }

                      return (
                        <tr key={row._id || idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span
                              style={{
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                color: row.entityType === 'VEHICLE' ? '#38bdf8' : '#2dd4bf',
                                backgroundColor: row.entityType === 'VEHICLE' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(45, 212, 191, 0.15)',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px'
                              }}
                            >
                              {row.entityType}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#f8fafc' }}>
                            {row.entityIdentifier}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                            {row.documentType?.replace(/_/g, ' ')}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                            {row.documentNumber || '—'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: isExpired ? '#f87171' : '#f8fafc', fontWeight: isExpired ? 700 : 500 }}>
                            {formatDate(row.expiryDate)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: isExpired ? '#f87171' : isWarning ? '#fb923c' : '#4ade80' }}>
                            {row.daysRemaining < 0
                              ? `${Math.abs(row.daysRemaining)} days ago`
                              : `${row.daysRemaining} days`}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {statusBadge}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Pagination Bar for Paginated Tabs */}
        {(activeTab === 'loads' || activeTab === 'trips') && (
          <div
            style={{
              padding: '0.85rem 1.25rem',
              borderTop: '1px solid var(--border-subtle)',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.78rem',
              color: 'var(--text-muted)'
            }}
          >
            <div>
              Showing page{' '}
              <strong style={{ color: '#f8fafc' }}>
                {activeTab === 'loads' ? loadsMeta.page : tripsMeta.page}
              </strong>{' '}
              of{' '}
              <strong style={{ color: '#f8fafc' }}>
                {activeTab === 'loads' ? loadsMeta.totalPages : tripsMeta.totalPages}
              </strong>{' '}
              ({activeTab === 'loads' ? loadsMeta.total : tripsMeta.total} total records)
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                disabled={activeTab === 'loads' ? loadsMeta.page <= 1 : tripsMeta.page <= 1}
                onClick={() => fetchReport(activeTab === 'loads' ? loadsMeta.page - 1 : tripsMeta.page - 1)}
                className="btn btn-secondary"
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
              >
                Previous
              </button>
              <button
                disabled={
                  activeTab === 'loads'
                    ? loadsMeta.page >= loadsMeta.totalPages
                    : tripsMeta.page >= tripsMeta.totalPages
                }
                onClick={() => fetchReport(activeTab === 'loads' ? loadsMeta.page + 1 : tripsMeta.page + 1)}
                className="btn btn-secondary"
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
