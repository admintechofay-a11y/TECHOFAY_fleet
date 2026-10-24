import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';

export function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      try {
        setIsLoading(true);
        const res = await apiRequest('/admin/audit-logs');
        if (res && res.data) {
          setLogs(res.data);
        }
      } catch (e) {
        // Ignored
      } finally {
        setIsLoading(false);
      }
    }
    fetchLogs();
  }, []);

  return (
    <div className="animate-fade-in" style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc' }}>
          Operational Audit Trail
        </h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
          Append-only, immutable record of authentication, dispatch events, and user modifications
        </p>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Module</th>
              <th>Action</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  Loading audit logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No audit logs recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log._id}>
                  <td className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {log.actorId ? `${log.actorId.name} (${log.actorId.email})` : 'System'}
                  </td>
                  <td>
                    <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>
                      {log.module}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        log.action.includes('SUCCESS')
                          ? 'badge-success'
                          : log.action.includes('FAILED')
                          ? 'badge-error'
                          : 'badge-info'
                      }`}
                      style={{ fontSize: '0.65rem' }}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="font-mono" style={{ fontSize: '0.75rem' }}>
                    {log.ipAddress || '127.0.0.1'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
