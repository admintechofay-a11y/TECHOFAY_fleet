import React, { useState } from 'react';
import { apiRequest } from '../lib/api';

interface ContactPageProps {
  onNavigateHome?: () => void;
}

export const ContactPage: React.FC<ContactPageProps> = ({ onNavigateHome }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    subject: 'Fleet Platform Inquiry',
    message: '',
    honeypot: '' // Anti-spam trap
  });

  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus(null);

    try {
      const res = await apiRequest('/contact', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      setStatus({
        type: 'success',
        message: res.message || 'Thank you! Your logistics inquiry has been received. Our haulage specialist will respond within 24 hours.'
      });

      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        subject: 'Fleet Platform Inquiry',
        message: '',
        honeypot: ''
      });
    } catch (err: any) {
      console.error('Contact submission error:', err);
      setStatus({
        type: 'error',
        message: err.message || 'Failed to submit inquiry. Please check your information or try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', padding: '3rem 1.5rem' }}>
      <div style={{ maxWidth: '780px', margin: '0 auto' }}>
        {/* Navigation Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.75rem' }}>🚚</span>
            <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em', color: 'var(--accent-cyan)' }}>
              TECHNOFAY FLEET OS
            </span>
          </div>
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}
            >
              ← Back to Portal
            </button>
          )}
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
            Contact Transport &amp; Fleet Operations
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '520px', margin: '0 auto' }}>
            Have questions regarding fleet deployment, consignment APIs, or transport onboarding? Our technical operations team is available 24/7.
          </p>
        </div>

        {/* Feedback Alert */}
        {status && (
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderRadius: '12px',
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              backgroundColor: status.type === 'success' ? '#eafaf1' : '#fdf2f2',
              border: status.type === 'success' ? '1px solid #bbf7d0' : '1px solid #fecaca',
              color: status.type === 'success' ? '#16a36a' : '#dc2626'
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>{status.type === 'success' ? '✅' : '⚠️'}</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{status.message}</span>
          </div>
        )}

        {/* Contact Form */}
        <div className="glass-panel" style={{ padding: '2.25rem', borderRadius: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Hidden honeypot field for bot suppression */}
            <input
              type="text"
              name="honeypot"
              tabIndex={-1}
              autoComplete="off"
              value={formData.honeypot}
              onChange={(e) => setFormData({ ...formData, honeypot: e.target.value })}
              style={{ display: 'none' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  YOUR NAME *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Ramesh Sharma"
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.9rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-medium)',
                    backgroundColor: '#ffffff',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  OFFICIAL EMAIL *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@company.com"
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.9rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-medium)',
                    backgroundColor: '#ffffff',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  CONTACT PHONE NUMBER
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.9rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-medium)',
                    backgroundColor: '#ffffff',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  COMPANY / TRANSPORTER NAME
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="e.g. Apex Haulage India"
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.9rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-medium)',
                    backgroundColor: '#ffffff',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                SUBJECT
              </label>
              <select
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.7rem 0.9rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-medium)',
                  backgroundColor: '#ffffff',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem'
                }}
              >
                <option value="Fleet Platform Inquiry">Fleet Platform Inquiry</option>
                <option value="Multi-Location Haulage Integration">Multi-Location Haulage Integration</option>
                <option value="WhatsApp Dispatch Integration">WhatsApp Dispatch Integration</option>
                <option value="Custom Document Template Support">Custom Document Template Support</option>
                <option value="Technical Support">Technical Operations Support</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                YOUR MESSAGE *
              </label>
              <textarea
                required
                rows={5}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Describe your haulage operations requirements, fleet size, or technical question..."
                style={{
                  width: '100%',
                  padding: '0.75rem 0.9rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-medium)',
                  backgroundColor: '#ffffff',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                  resize: 'vertical'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary"
              style={{
                padding: '0.85rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                marginTop: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              {isLoading ? (
                <>
                  <span style={{ animation: 'spin 1s linear infinite' }}>🔄</span>
                  <span>Transmitting Secure Inquiry...</span>
                </>
              ) : (
                <>
                  <span>📨</span>
                  <span>Send Operations Inquiry</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
