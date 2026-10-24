import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';

export const CompliancePage: React.FC = () => {
  const [overview, setOverview] = useState<any | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const fetchComplianceData = async () => {
    setLoading(true);
    try {
      const [overviewRes, notifRes] = await Promise.all([
        apiRequest('/compliance/overview'),
        apiRequest('/compliance/notifications?limit=50')
      ]);

      setOverview(overviewRes.data);
      setNotifications(notifRes.data.items);
    } catch (err: any) {
      console.error('Failed to load compliance data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplianceData();
  }, []);

  const handleRunScan = async () => {
    setScanning(true);
    setScanMessage(null);
    try {
      const res = await apiRequest('/compliance/scan', { method: 'POST' });
      setScanMessage(
        `Audit completed: Scanned ${res.data.scannedVehicleDocuments} vehicle docs and ${res.data.scannedDrivers} drivers. Created ${res.data.notificationsCreated} new alerts.`
      );
      fetchComplianceData();
    } catch (err: any) {
      setScanMessage(`Scan error: ${err.message}`);
    } finally {
      setScanning(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await apiRequest(`/compliance/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications(prev =>
        prev.map(n => (n._id === id ? { ...n, isRead: true } : n))
      );
    } catch (err: any) {
      console.error('Failed to mark read:', err.message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('/compliance/notifications/read-all', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err: any) {
      console.error('Failed to mark all read:', err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Compliance & Expiry Monitoring Center</h1>
          <p className="text-xs text-slate-400 mt-1">
            Automated audits for Vehicle RC, Insurance, PUC, Fitness and Driver Licences
          </p>
        </div>
        <div>
          <button
            onClick={handleRunScan}
            disabled={scanning}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm disabled:opacity-50 flex items-center gap-2"
          >
            <span>⚡</span>
            {scanning ? 'Auditing Regulatory Expiries...' : 'Run Compliance Scan Now'}
          </button>
        </div>
      </div>

      {scanMessage && (
        <div className="p-3 bg-blue-950/70 border border-blue-800 text-blue-200 text-xs rounded-xl flex items-center justify-between">
          <span>{scanMessage}</span>
          <button onClick={() => setScanMessage(null)} className="text-blue-400 hover:text-white">✕</button>
        </div>
      )}

      {/* KPI Cards */}
      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fleet Documents</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white">{overview.documents.total}</span>
              <span className="text-xs text-emerald-400 font-semibold">{overview.documents.valid} Valid</span>
            </div>
            <div className="mt-2 flex gap-2 text-[11px]">
              <span className="text-amber-400">{overview.documents.expiringSoon} Expiring Soon</span>
              <span className="text-slate-600">•</span>
              <span className="text-red-400">{overview.documents.expired} Expired</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Driver Licences</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white">{overview.drivers.total}</span>
              <span className="text-xs text-emerald-400 font-semibold">{overview.drivers.valid} Valid</span>
            </div>
            <div className="mt-2 flex gap-2 text-[11px]">
              <span className="text-amber-400">{overview.drivers.expiringSoon} Expiring Soon</span>
              <span className="text-slate-600">•</span>
              <span className="text-red-400">{overview.drivers.expired} Expired</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Critical Expiries</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-red-400">
                {overview.documents.expired + overview.drivers.expired}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-red-950 text-red-300 border border-red-800">
                Ground Vehicle
              </span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Vehicles or drivers with expired documents must not be assigned to loads.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">30-Day Expiry Window</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-amber-400">
                {overview.documents.expiringSoon + overview.drivers.expiringSoon}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-amber-950 text-amber-300 border border-amber-800">
                Action Required
              </span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Initiate RTO fitness, national permit, and commercial insurance renewals.
            </p>
          </div>
        </div>
      )}

      {/* Operational Alerts & Notifications Feed */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white">Active Operational Alerts & Notifications</h2>
            <p className="text-xs text-slate-400">
              Deduplicated alerts triggered by scheduled audits and daily compliance checks
            </p>
          </div>
          {notifications.some(n => !n.isRead) && (
            <button
              onClick={handleMarkAllRead}
              className="px-3 py-1 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Mark All as Read
            </button>
          )}
        </div>

        <div className="mt-4 divide-y divide-slate-800">
          {loading ? (
            <p className="py-6 text-center text-xs text-slate-500">Loading alerts...</p>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              <span className="text-2xl block mb-2">🎉</span>
              No pending compliance alerts. All vehicles and drivers are fully regulatory compliant!
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n._id}
                className={`py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                  !n.isRead ? 'bg-slate-850/40' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`text-base mt-0.5 ${n.severity === 'CRITICAL' ? 'text-red-400' : 'text-amber-400'}`}>
                    {n.severity === 'CRITICAL' ? '🚨' : '⚠️'}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{n.title}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                        n.severity === 'CRITICAL'
                          ? 'bg-red-950 text-red-300 border border-red-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        {n.severity}
                      </span>
                      {!n.isRead && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{n.message}</p>
                    <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                      {new Date(n.createdAt).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {!n.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(n._id)}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
