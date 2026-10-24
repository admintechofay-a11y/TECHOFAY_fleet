import React from 'react';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate?: (path: string) => void;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, onNavigate }) => {
  if (!items || items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        marginBottom: '1rem'
      }}
    >
      <span
        onClick={() => onNavigate && onNavigate('/app/dashboard')}
        style={{
          cursor: onNavigate ? 'pointer' : 'default',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem'
        }}
      >
        <span>🏠</span>
        <span>Home</span>
      </span>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            <span style={{ color: 'var(--border-medium)', userSelect: 'none' }}>/</span>
            {isLast || !item.path ? (
              <span aria-current="page" style={{ color: '#38bdf8', fontWeight: 600 }}>
                {item.label}
              </span>
            ) : (
              <span
                onClick={() => onNavigate && item.path && onNavigate(item.path)}
                style={{
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  textDecoration: 'none'
                }}
              >
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
