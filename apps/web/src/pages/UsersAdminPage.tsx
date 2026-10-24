import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';

export function UsersAdminPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRoleId, setNewRoleId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const res = await apiRequest('/admin/users');
      if (res && res.data) {
        setUsers(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await apiRequest('/admin/roles');
      if (res && res.data) {
        setRoles(res.data);
        if (res.data.length > 0) {
          setNewRoleId(res.data[0]._id);
        }
      }
    } catch (e) {
      // Ignored
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const handleToggleStatus = async (user) => {
    try {
      await apiRequest(`/admin/users/${user._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !user.isActive })
      });
      fetchUsers();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await apiRequest('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password: newPassword,
          phone: newPhone,
          roleId: newRoleId
        })
      });
      setIsModalOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewPhone('');
      fetchUsers();
    } catch (err) {
      alert(`Error creating user: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc' }}>
            User Administration
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Manage authorized staff accounts and role assignments
          </p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
          + Add New User
        </button>
      </div>

      {error && (
        <div style={{ padding: '0.75rem', backgroundColor: 'var(--status-error-subtle)', color: '#fca5a5', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.825rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Users Data Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Assigned Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  Loading active users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No users found in this organization.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u._id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td className="font-mono" style={{ fontSize: '0.8rem' }}>{u.email}</td>
                  <td>{u.phone || '—'}</td>
                  <td>
                    <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>
                      {u.roleId?.name || 'Operator'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.isActive ? 'badge-success' : 'badge-error'}`}>
                      {u.isActive ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleToggleStatus(u)}
                      className={`btn ${u.isActive ? 'btn-danger' : 'btn-secondary'}`}
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}
                    >
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem'
          }}
        >
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '2rem', borderRadius: '16px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1.25rem' }}>
              Provision New User
            </h2>

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Ramesh Patel"
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. ramesh@technofay.com"
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Password (min 8 chars)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="input-field"
                  required
                  minLength={8}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Phone Number
                </label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="input-field"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Role Assignment
                </label>
                <select
                  value={newRoleId}
                  onChange={(e) => setNewRoleId(e.target.value)}
                  className="input-field"
                  style={{ backgroundColor: '#0f172a' }}
                  required
                >
                  {roles.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary"
                >
                  {isSubmitting ? 'Provisioning...' : 'Provision User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
