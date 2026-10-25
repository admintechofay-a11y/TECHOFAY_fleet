import React from 'react';

interface NotFoundPageProps {
  onNavigateHome: () => void;
  onNavigateContact?: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onNavigateHome, onNavigateContact }) => {
  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        textAlign: 'center'
      }}
    >
      <div
        style={{
          maxWidth: '560px',
          padding: '3rem 2.5rem',
          borderRadius: '20px',
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xl)'
        }}
      >
        <div
          style={{
            fontSize: '4.5rem',
            fontWeight: 900,
            color: '#0284c7',
            letterSpacing: '-0.04em',
            lineHeight: 1,
            marginBottom: '0.75rem'
          }}
        >
          404
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
          Consignment Route Not Found
        </h1>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '2rem' }}>
          The requested operational resource, shipment waybill, or page destination does not exist or has been relocated within the fleet platform.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={onNavigateHome}
            className="btn btn-primary"
            style={{ padding: '0.7rem 1.4rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span>📊</span>
            <span>Return to Dashboard</span>
          </button>

          {onNavigateContact && (
            <button
              onClick={onNavigateContact}
              className="btn btn-secondary"
              style={{ padding: '0.7rem 1.4rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <span>💬</span>
              <span>Contact Support</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
