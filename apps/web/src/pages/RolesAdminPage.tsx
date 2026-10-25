import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';

export function RolesAdminPage() {
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRoles() {
      try {
        setIsLoading(true);
        const res = await apiRequest('/admin/roles');
        if (res && res.data) {
          setRoles(res.data);
        }
      } catch (e) {
        // Ignored
      } finally {
        setIsLoading(false);
      }
    }
    fetchRoles();
  }, []);

  return (
    <div className="animate-fade-in" style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Roles & Permissions Matrix
        </h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
          Configured system and custom roles with fine-grained module privileges
        </p>
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--text-muted)', padding: '2rem' }}>Loading roles...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {roles.map((role) => (
            <div key={role._id} className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {role.name}
                  </h3>
                  <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', marginTop: '0.2rem' }}>
                    slug: {role.slug}
                  </div>
                </div>
                {role.isSystemRole && (
                  <span className="badge badge-info" style={{ fontSize: '0.625rem' }}>
                    System Role
                  </span>
                )}
              </div>

              <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                {role.description || 'Custom organizational operational role.'}
              </p>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Module Permissions:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {role.permissions && role.permissions.length > 0 ? (
                    role.permissions.map((p, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '0.675rem',
                          padding: '0.2rem 0.5rem',
                          backgroundColor: '#f1f5f9',
                          borderRadius: '4px',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)'
                        }}
                      >
                        <strong style={{ color: 'var(--accent-cyan)' }}>{p.module}</strong>: {p.actions.join(', ')}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                      All modules authorized (Master Access)
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
