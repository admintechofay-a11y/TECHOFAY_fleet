import React from 'react';
import { useNavigation } from '../context/NavigationContext';

export interface BreadcrumbItem {
  label: string;
  path?: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate?: (path: string) => void;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, onNavigate }) => {
  const { navigate } = useNavigation();
  const handleNav = onNavigate || navigate;

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
        onClick={() => handleNav('/app/dashboard')}
        style={{
          cursor: 'pointer',
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
        const targetPath = item.path || item.href;
        return (
          <React.Fragment key={index}>
            <span style={{ color: 'var(--border-medium)', userSelect: 'none' }}>/</span>
            {isLast || !targetPath ? (
              <span aria-current="page" style={{ color: '#38bdf8', fontWeight: 600 }}>
                {item.label}
              </span>
            ) : (
              <span
                onClick={() => handleNav(targetPath)}
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
