import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    try {
      setIsSubmitting(true);
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 20%, #172554 0%, #0a0f1d 80%)',
        padding: '1.5rem'
      }}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '2.5rem',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* Brand Logo & Title */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)',
              margin: '0 auto 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              boxShadow: 'var(--shadow-glow)'
            }}
          >
            🚚
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em' }}>
            Technofay Fleet OS
          </h1>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Enterprise Transport & Logistics Management
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              backgroundColor: 'var(--status-error-subtle)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem',
              marginBottom: '1.25rem',
              fontSize: '0.825rem',
              color: '#fca5a5'
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Work Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. dispatcher@technofay.com"
              className="input-field"
              required
              autoFocus
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Account Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="input-field"
              required
            />
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              Minimum 8 characters required
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}
          >
            {isSubmitting ? 'Authenticating...' : 'Sign In to Workspace'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
          <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
            Protected enterprise portal. Unauthorized access is strictly logged and audited.
          </p>
        </div>
      </div>
    </div>
  );
}
