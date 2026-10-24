import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../lib/api';

interface SearchResultItem {
  id: string;
  type: 'LOAD' | 'LR' | 'BILTY' | 'TRIP' | 'VEHICLE' | 'DRIVER' | 'CUSTOMER' | 'LOCATION';
  title: string;
  subtitle: string;
  status: string;
  url: string;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

export function GlobalSearchModal({ isOpen, onClose, onNavigate }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setExecutionTimeMs(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        const res = await apiRequest(`/search?q=${encodeURIComponent(query.trim())}`);
        if (res && res.data) {
          setResults(res.data.results || []);
          setExecutionTimeMs(res.data.executionTimeMs);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard navigation: Escape, ArrowDown, ArrowUp, Enter
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          const item = results[selectedIndex];
          onNavigate(item.url);
          onClose();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onNavigate, onClose]);

  if (!isOpen) return null;

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'LOAD':
        return { label: 'LOAD', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' };
      case 'LR':
        return { label: 'LR #', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.15)' };
      case 'BILTY':
        return { label: 'BILTY', color: '#f472b6', bg: 'rgba(244, 114, 182, 0.15)' };
      case 'TRIP':
        return { label: 'TRIP', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' };
      case 'VEHICLE':
        return { label: 'VEHICLE', color: '#34d399', bg: 'rgba(52, 211, 153, 0.15)' };
      case 'DRIVER':
        return { label: 'DRIVER', color: '#2dd4bf', bg: 'rgba(45, 212, 191, 0.15)' };
      case 'CUSTOMER':
        return { label: 'PARTY', color: '#818cf8', bg: 'rgba(129, 140, 248, 0.15)' };
      case 'LOCATION':
        return { label: 'HUB', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)' };
      default:
        return { label: type, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' };
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh'
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '680px',
          maxWidth: '92vw',
          maxHeight: '75vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          background: 'rgba(24, 30, 49, 0.95)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 24px rgba(6, 182, 212, 0.25)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            gap: '0.75rem'
          }}
        >
          <span style={{ fontSize: '1.25rem', color: '#38bdf8' }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search loads, LR, Bilty, trips, vehicles, drivers, customers, hubs..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f8fafc',
              fontSize: '1rem',
              fontWeight: 500
            }}
          />
          {isLoading && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Searching...</span>
          )}
          <span
            style={{
              fontSize: '0.7rem',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '4px',
              padding: '0.2rem 0.5rem',
              color: 'var(--text-secondary)'
            }}
          >
            ESC to close
          </span>
        </div>

        {/* Search Results List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {query.trim().length < 2 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚡</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Type at least 2 characters to search across all transport entities
              </div>
              <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                Supports Load #, LR #, Bilty #, Trip #, Vehicle Plate, Driver DL, GSTIN, and Hubs
              </div>
            </div>
          ) : results.length === 0 && !isLoading ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
              <div style={{ fontSize: '0.9rem', color: '#f8fafc' }}>
                No records matching "{query}"
              </div>
              <div style={{ fontSize: '0.75rem', marginTop: '0.35rem', color: 'var(--text-secondary)' }}>
                Check spelling or search by registration number, phone, or sequence ID
              </div>
            </div>
          ) : (
            results.map((item, index) => {
              const isSelected = index === selectedIndex;
              const badge = getTypeBadge(item.type);
              return (
                <div
                  key={`${item.type}_${item.id}`}
                  onClick={() => {
                    onNavigate(item.url);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    border: isSelected
                      ? '1px solid rgba(56, 189, 248, 0.35)'
                      : '1px solid transparent',
                    cursor: 'pointer',
                    marginBottom: '0.25rem',
                    transition: 'all 0.1s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        color: badge.color,
                        backgroundColor: badge.bg,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        letterSpacing: '0.05em'
                      }}
                    >
                      {badge.label}
                    </span>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {item.status && (
                      <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                        {item.status}
                      </span>
                    )}
                    <span style={{ fontSize: '0.75rem', color: isSelected ? '#38bdf8' : 'var(--text-muted)' }}>
                      ↵
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info bar */}
        {executionTimeMs !== null && results.length > 0 && (
          <div
            style={{
              padding: '0.6rem 1.25rem',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.72rem',
              color: 'var(--text-muted)'
            }}
          >
            <span>
              Found {results.length} matches in {executionTimeMs}ms
            </span>
            <span>Use ↑ ↓ to navigate, Enter to select</span>
          </div>
        )}
      </div>
    </div>
  );
}
